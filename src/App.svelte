<script lang="ts">
  import { onMount } from 'svelte';
  import {
    aggregateDailyProfile, aggregateProfileSummary, aggregateToolSummary,
    overallTotals, aggregateTimeSeries, aggregateTokenTimeSeries,
    aggregateByModel, aggregateTokenTypes, computeKpis,
  } from './lib/aggregate';
  import { applyFilters, extractFilterOptions, createDefaultFilter } from './lib/filter';
  import type { FilterState } from './lib/filter';
  import { parseUsageFile } from './lib/parsers';
  import { parseProfilexState, ProfileResolver } from './lib/profilex';
  import { loadPricingCatalog } from './lib/pricing';
  import type { NormalizedEvent, ProfilexState, Tool, UnifiedLocalBundle, TimeBucket } from './lib/types';
  import type { Tab } from './components/layout/TabBar.svelte';

  // Layout components
  import Header from './components/layout/Header.svelte';
  import TabBar from './components/layout/TabBar.svelte';
  import ImportPanel from './components/import/ImportPanel.svelte';

  // Dashboard components
  import KpiCards from './components/dashboard/KpiCards.svelte';
  import FilterBar from './components/dashboard/FilterBar.svelte';
  import AggregationToggle from './components/dashboard/AggregationToggle.svelte';
  import CostOverTimeChart from './components/dashboard/CostOverTimeChart.svelte';
  import TokenOverTimeChart from './components/dashboard/TokenOverTimeChart.svelte';
  import CostByToolChart from './components/dashboard/CostByToolChart.svelte';
  import CostByModelChart from './components/dashboard/CostByModelChart.svelte';
  import TokenTypeChart from './components/dashboard/TokenTypeChart.svelte';

  // Table components
  import DailyProfileTable from './components/tables/DailyProfileTable.svelte';
  import ProfileSummaryTable from './components/tables/ProfileSummaryTable.svelte';
  import ToolSummaryTable from './components/tables/ToolSummaryTable.svelte';

  // --- State ---
  let timezone = $state(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  let costMode = $state<'auto' | 'calculate' | 'display'>('auto');
  let toolHint = $state<Tool | 'auto'>('auto');

  let profilexState = $state<ProfilexState | null>(null);
  let pricingLoaded = $state(false);
  let pricingStatus = $state('Not loaded');
  let pricingEntries = $state(0);
  let localBundleStatus = $state('Not checked');

  let events = $state<NormalizedEvent[]>([]);
  let importLog = $state<string[]>([]);

  let activeTab = $state<Tab>('overview');
  let filter = $state<FilterState>(createDefaultFilter());
  let timeBucket = $state<TimeBucket>('daily');

  const LOCAL_UNIFIED_PATH = '/local-unified-usage.json';

  // --- Event helpers ---
  function eventKey(e: NormalizedEvent): string {
    return [
      e.tool, e.profileId, e.sourceFile, e.sessionId, e.timestampUtc,
      e.model, e.inputTokens, e.cachedInputTokens, e.outputTokens,
      e.cacheCreationTokens, e.cacheReadTokens, e.rawTotalTokens,
    ].join('||');
  }

  function mergeEvents(existing: NormalizedEvent[], incoming: NormalizedEvent[]): NormalizedEvent[] {
    const map = new Map<string, NormalizedEvent>();
    for (const e of existing) map.set(eventKey(e), e);
    for (const e of incoming) map.set(eventKey(e), e);
    return [...map.values()].sort((a, b) => a.timestampUtc.localeCompare(b.timestampUtc));
  }

  function mergeProfilexState(current: ProfilexState | null, incoming: ProfilexState | null): ProfilexState | null {
    if (!incoming) return current;
    if (!current) return incoming;
    const mergedProfiles = [...current.profiles];
    const seen = new Set(current.profiles.map((p) => `${p.tool}|${p.name}|${p.dir}`));
    for (const p of incoming.profiles) {
      const k = `${p.tool}|${p.name}|${p.dir}`;
      if (!seen.has(k)) { mergedProfiles.push(p); seen.add(k); }
    }
    return {
      version: incoming.version ?? current.version,
      defaults: { ...(current.defaults ?? {}), ...(incoming.defaults ?? {}) },
      profiles: mergedProfiles,
    };
  }

  function log(message: string) {
    importLog = [message, ...importLog].slice(0, 80);
  }

  // --- Derived data ---
  let filterOptions = $derived(extractFilterOptions(events));
  let filteredEvents = $derived(applyFilters(events, filter));

  let kpis = $derived(computeKpis(filteredEvents));
  let costTimeSeries = $derived(aggregateTimeSeries(filteredEvents, timeBucket));
  let tokenTimeSeries = $derived(aggregateTokenTimeSeries(filteredEvents, timeBucket));
  let modelBreakdown = $derived(aggregateByModel(filteredEvents));
  let toolRows = $derived(aggregateToolSummary(filteredEvents));
  let tokenTypes = $derived(aggregateTokenTypes(filteredEvents, timeBucket));

  let dailyRows = $derived(aggregateDailyProfile(filteredEvents));
  let profileRows = $derived(aggregateProfileSummary(filteredEvents));

  // --- Import handlers ---
  function isUnifiedLocalBundle(value: unknown): value is UnifiedLocalBundle {
    if (!value || typeof value !== 'object') return false;
    const bundle = value as Partial<UnifiedLocalBundle>;
    return Array.isArray(bundle.events) && Array.isArray(bundle.notes) && !!bundle.source;
  }

  async function onLoadLocalUnified() {
    localBundleStatus = 'Checking local unified file...';
    try {
      const response = await fetch(`${LOCAL_UNIFIED_PATH}?t=${Date.now()}`, { cache: 'no-store' });
      if (response.status === 404) {
        localBundleStatus = 'No local unified file found. Run `pnpm generate:local`, then refresh.';
        log(localBundleStatus);
        return;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = (await response.json()) as unknown;
      if (!isUnifiedLocalBundle(payload)) throw new Error('Invalid local unified file format');
      events = mergeEvents(events, payload.events);
      profilexState = mergeProfilexState(profilexState, payload.profilexState);
      if (payload.pricingLoaded) {
        pricingLoaded = true;
        pricingStatus = 'Loaded via local unified file';
      }
      localBundleStatus = `Auto-loaded ${payload.events.length} events from local unified file`;
      log(localBundleStatus);
    } catch (error) {
      localBundleStatus = `Local unified load failed: ${(error as Error).message}`;
      log(localBundleStatus);
    }
  }

  function isUsageFile(file: File): boolean {
    return file.name.toLowerCase().endsWith('.jsonl');
  }

  async function importUsageFiles(files: File[]) {
    if (files.length === 0) { log('No files selected'); return; }
    const usageFiles = files.filter(isUsageFile);
    if (usageFiles.length === 0) { log('No .jsonl usage files found in selection'); return; }
    if (usageFiles.length !== files.length) log(`Skipping ${files.length - usageFiles.length} non-.jsonl file(s)`);
    const pricingCatalog = ((window as any).__pricingCatalog ?? null) as any;
    if (!pricingCatalog) log('Tip: Load pricing first for calculated costs');
    const resolver = new ProfileResolver(profilexState);
    const imported: NormalizedEvent[] = [];
    for (const file of usageFiles) {
      try {
        const text = await file.text();
        const filePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
        const parsedRows = parseUsageFile({ fileText: text, filePath, options: { timezone, costMode, toolHint, pricingCatalog, profileResolver: resolver } });
        imported.push(...parsedRows);
        log(parsedRows.length === 0 ? `Parsed 0 events from ${filePath}` : `Imported ${parsedRows.length} events from ${filePath}`);
      } catch (error) {
        log(`Failed ${file.name}: ${(error as Error).message}`);
      }
    }
    events = mergeEvents(events, imported);
    log(`Total events: ${events.length}`);
  }

  async function onLoadPricing() {
    pricingStatus = 'Loading pricing catalog...';
    try {
      const catalog = await loadPricingCatalog();
      pricingEntries = Object.keys(catalog).length;
      (window as any).__pricingCatalog = catalog;
      pricingLoaded = true;
      pricingStatus = `Loaded ${pricingEntries} pricing rows`;
      log(pricingStatus);
    } catch (error) {
      pricingStatus = `Failed: ${(error as Error).message}`;
      log(pricingStatus);
    }
  }

  async function onProfilexStateUpload(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const state = parseProfilexState(text);
      profilexState = state;
      log(`Loaded ProfileX state with ${state.profiles.length} profiles`);
    } catch (error) {
      log(`ProfileX state parse error: ${(error as Error).message}`);
    }
  }

  async function onUsageFilesUpload(ev: Event) {
    const input = ev.target as HTMLInputElement;
    await importUsageFiles([...(input.files ?? [])]);
    input.value = '';
  }

  async function onUnifiedBundleUpload(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const files = [...(input.files ?? [])];
    if (files.length === 0) return;
    for (const file of files) {
      try {
        const text = await file.text();
        const payload = JSON.parse(text) as unknown;
        if (!isUnifiedLocalBundle(payload)) { log(`Skipped ${file.name}: not a unified bundle`); continue; }
        events = mergeEvents(events, payload.events);
        profilexState = mergeProfilexState(profilexState, payload.profilexState);
        if (payload.pricingLoaded) {
          pricingLoaded = true;
          if (pricingStatus === 'Not loaded') pricingStatus = 'Loaded via imported bundle';
        }
        log(`Imported bundle ${file.name}: +${payload.events.length} events`);
      } catch (error) {
        log(`Failed bundle ${file.name}: ${(error as Error).message}`);
      }
    }
    log(`Total events: ${events.length}`);
    input.value = '';
  }

  function clearAll() {
    events = [];
    importLog = [];
    filter = createDefaultFilter();
    log('Cleared all imported data');
  }

  onMount(() => {
    void onLoadLocalUnified();
  });
</script>

<div class="min-h-screen bg-[#080d19] text-slate-100">
  <!-- Subtle background atmosphere -->
  <div class="pointer-events-none fixed inset-0 opacity-30" style="background: radial-gradient(ellipse 80% 60% at 50% -20%, rgba(56, 189, 248, 0.03), transparent), radial-gradient(ellipse 60% 50% at 80% 100%, rgba(139, 92, 246, 0.03), transparent)"></div>

  <div class="relative mx-auto max-w-[1400px] px-6 py-6 space-y-5">
    <Header eventCount={events.length} />

    <div class="flex items-center justify-between gap-4">
      <TabBar bind:activeTab />
      {#if activeTab === 'overview'}
        <AggregationToggle bind:bucket={timeBucket} />
      {/if}
    </div>

    <!-- Overview Tab -->
    {#if activeTab === 'overview'}
      <FilterBar
        bind:filter
        availableTools={filterOptions.tools}
        availableModels={filterOptions.models}
        availableProfiles={filterOptions.profiles}
        minDate={filterOptions.minDate}
        maxDate={filterOptions.maxDate}
      />

      <KpiCards {kpis} />

      <div class="grid gap-4 lg:grid-cols-2">
        <CostOverTimeChart data={costTimeSeries} />
        <TokenOverTimeChart data={tokenTimeSeries} />
      </div>

      <div class="grid gap-4 lg:grid-cols-3">
        <CostByToolChart data={toolRows} />
        <CostByModelChart data={modelBreakdown} />
        <TokenTypeChart data={tokenTypes} />
      </div>
    {/if}

    <!-- Tables Tab -->
    {#if activeTab === 'tables'}
      <FilterBar
        bind:filter
        availableTools={filterOptions.tools}
        availableModels={filterOptions.models}
        availableProfiles={filterOptions.profiles}
        minDate={filterOptions.minDate}
        maxDate={filterOptions.maxDate}
      />

      <DailyProfileTable rows={dailyRows} />

      <div class="grid gap-4 lg:grid-cols-2">
        <ProfileSummaryTable rows={profileRows} />
        <ToolSummaryTable rows={toolRows} />
      </div>
    {/if}

    <!-- Import Tab -->
    {#if activeTab === 'import'}
      <ImportPanel
        bind:timezone
        bind:costMode
        bind:toolHint
        {profilexState}
        {pricingLoaded}
        {pricingStatus}
        {pricingEntries}
        {localBundleStatus}
        {importLog}
        {onLoadPricing}
        {onProfilexStateUpload}
        {onUsageFilesUpload}
        {onUnifiedBundleUpload}
        {onLoadLocalUnified}
        onClearAll={clearAll}
      />
    {/if}
  </div>
</div>
