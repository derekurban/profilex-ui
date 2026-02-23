<script lang="ts">
  import { aggregateDailyProfile, aggregateProfileSummary, aggregateToolSummary, overallTotals } from './lib/aggregate';
  import { parseUsageFile } from './lib/parsers';
  import { parseProfilexState, ProfileResolver } from './lib/profilex';
  import { loadPricingCatalog } from './lib/pricing';
  import type { NormalizedEvent, ProfilexState, Tool } from './lib/types';

  let timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  let costMode: 'auto' | 'calculate' | 'display' = 'auto';
  let toolHint: Tool | 'auto' = 'auto';

  let profilexState: ProfilexState | null = null;
  let pricingLoaded = false;
  let pricingStatus = 'Not loaded';
  let pricingEntries = 0;

  let events: NormalizedEvent[] = [];
  let importLog: string[] = [];

  const fmtNum = (n: number) => new Intl.NumberFormat().format(Math.round(n));
  const fmtUSD = (n: number) =>
    new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    }).format(n || 0);

  function log(message: string) {
    importLog = [message, ...importLog].slice(0, 80);
  }

  async function onLoadPricing() {
    pricingStatus = 'Loading pricing catalog…';
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
    const files = [...(input.files ?? [])];
    if (files.length === 0) return;

    const pricingCatalog = ((window as any).__pricingCatalog ?? null) as any;
    if (!pricingCatalog) {
      log('Tip: Load pricing first for calculated costs');
    }

    const resolver = new ProfileResolver(profilexState);
    const imported: NormalizedEvent[] = [];

    for (const file of files) {
      try {
        const text = await file.text();
        const filePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;

        const parsedRows = parseUsageFile({
          fileText: text,
          filePath,
          options: {
            timezone,
            costMode,
            toolHint,
            pricingCatalog,
            profileResolver: resolver,
          },
        });

        imported.push(...parsedRows);
        log(`Imported ${parsedRows.length} events from ${filePath}`);
      } catch (error) {
        log(`Failed ${file.name}: ${(error as Error).message}`);
      }
    }

    events = [...events, ...imported].sort((a, b) => a.timestampUtc.localeCompare(b.timestampUtc));
    log(`Total events: ${events.length}`);
    input.value = '';
  }

  function clearAll() {
    events = [];
    importLog = [];
    log('Cleared all imported data');
  }

  let dailyRows = aggregateDailyProfile(events);
  let profileRows = aggregateProfileSummary(events);
  let toolRows = aggregateToolSummary(events);
  let totals = overallTotals(events);

  $: dailyRows = aggregateDailyProfile(events);
  $: profileRows = aggregateProfileSummary(events);
  $: toolRows = aggregateToolSummary(events);
  $: totals = overallTotals(events);
</script>

<div class="min-h-screen bg-slate-950 text-slate-100">
  <div class="mx-auto max-w-7xl px-6 py-8">
    <header class="mb-8 rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 p-6 shadow-2xl shadow-indigo-950/20">
      <p class="mb-2 text-xs uppercase tracking-[0.2em] text-indigo-300">ProfileX-UI</p>
      <h1 class="text-3xl font-bold">Unified Claude + Codex Usage Intelligence</h1>
      <p class="mt-2 max-w-3xl text-sm text-slate-300">
        Implements the unified strategy: discover usage files, normalize events, map to ProfileX profiles (or default-*), and compute tabular usage/cost reports per day, per profile, and totals.
      </p>
    </header>

    <section class="mb-6 grid gap-4 lg:grid-cols-2">
      <div class="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
        <h2 class="mb-3 text-sm font-semibold text-slate-200">1) Configuration + Imports</h2>

        <div class="grid gap-3 md:grid-cols-2">
          <label class="text-xs text-slate-300">Timezone
            <input class="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm" bind:value={timezone} placeholder="America/Edmonton" />
          </label>

          <label class="text-xs text-slate-300">Cost mode
            <select class="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm" bind:value={costMode}>
              <option value="auto">auto (observed if available, else calculated)</option>
              <option value="calculate">calculate</option>
              <option value="display">display (observed only)</option>
            </select>
          </label>

          <label class="text-xs text-slate-300">Tool hint
            <select class="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm" bind:value={toolHint}>
              <option value="auto">auto detect</option>
              <option value="claude">force claude parser</option>
              <option value="codex">force codex parser</option>
            </select>
          </label>

          <div class="text-xs text-slate-300">
            <button class="mt-1 w-full rounded-md border border-indigo-500/50 bg-indigo-500/20 px-3 py-2 text-sm font-medium text-indigo-200 hover:bg-indigo-500/30" on:click={onLoadPricing}>
              Pull latest pricing
            </button>
            <p class="mt-1 text-[11px] text-slate-400">{pricingStatus}{pricingLoaded ? ` (${pricingEntries})` : ''}</p>
          </div>
        </div>

        <div class="mt-4 grid gap-3 md:grid-cols-2">
          <label class="text-xs text-slate-300">
            Upload ProfileX state.json
            <input class="mt-1 block w-full text-xs" type="file" accept="application/json,.json" on:change={onProfilexStateUpload} />
          </label>

          <label class="text-xs text-slate-300">
            Upload usage files (JSONL)
            <input class="mt-1 block w-full text-xs" type="file" multiple on:change={onUsageFilesUpload} />
          </label>
        </div>

        <div class="mt-3 flex items-center gap-2">
          <button class="rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs hover:bg-slate-700" on:click={clearAll}>Clear data</button>
          {#if profilexState}
            <span class="text-xs text-emerald-300">ProfileX profiles loaded: {profilexState.profiles.length}</span>
          {/if}
        </div>
      </div>

      <div class="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
        <h2 class="mb-3 text-sm font-semibold text-slate-200">2) Totals Snapshot</h2>
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <p class="text-xs text-slate-400">Total Tokens</p>
            <p class="mt-1 text-xl font-semibold">{fmtNum(totals.totalTokens)}</p>
          </div>
          <div class="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <p class="text-xs text-slate-400">Effective Cost</p>
            <p class="mt-1 text-xl font-semibold">{fmtUSD(totals.totalCostUSD)}</p>
          </div>
          <div class="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <p class="text-xs text-slate-400">Observed Cost</p>
            <p class="mt-1 text-xl font-semibold">{fmtUSD(totals.observedCostUSD)}</p>
          </div>
          <div class="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <p class="text-xs text-slate-400">Calculated Cost</p>
            <p class="mt-1 text-xl font-semibold">{fmtUSD(totals.calculatedCostUSD)}</p>
          </div>
        </div>
        <p class="mt-3 text-xs text-slate-400">Window: {totals.windowStart || '—'} → {totals.windowEnd || '—'}</p>
      </div>
    </section>

    <section class="mb-6 rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <h2 class="mb-3 text-sm font-semibold text-slate-200">Daily × Profile Breakdown</h2>
      <div class="overflow-auto">
        <table class="min-w-full text-xs">
          <thead class="bg-slate-950/70 text-slate-300">
            <tr>
              <th class="px-2 py-2 text-left">Date</th>
              <th class="px-2 py-2 text-left">Tool</th>
              <th class="px-2 py-2 text-left">Profile</th>
              <th class="px-2 py-2 text-right">Tokens</th>
              <th class="px-2 py-2 text-right">Observed</th>
              <th class="px-2 py-2 text-right">Calculated</th>
              <th class="px-2 py-2 text-right">Effective</th>
              <th class="px-2 py-2 text-right">Sessions</th>
              <th class="px-2 py-2 text-left">Models</th>
            </tr>
          </thead>
          <tbody>
            {#if dailyRows.length === 0}
              <tr><td class="px-2 py-3 text-slate-500" colspan="9">No data yet.</td></tr>
            {:else}
              {#each dailyRows as row}
                <tr class="border-t border-slate-800">
                  <td class="px-2 py-2">{row.dateLocal}</td>
                  <td class="px-2 py-2">{row.tool}</td>
                  <td class="px-2 py-2">{row.profileId}</td>
                  <td class="px-2 py-2 text-right">{fmtNum(row.totalTokens)}</td>
                  <td class="px-2 py-2 text-right">{fmtUSD(row.observedCostUSD)}</td>
                  <td class="px-2 py-2 text-right">{fmtUSD(row.calculatedCostUSD)}</td>
                  <td class="px-2 py-2 text-right font-medium text-emerald-300">{fmtUSD(row.effectiveCostUSD)}</td>
                  <td class="px-2 py-2 text-right">{row.sessionsCount}</td>
                  <td class="px-2 py-2">{row.modelsUsed.slice(0, 3).join(', ')}{row.modelsUsed.length > 3 ? '…' : ''}</td>
                </tr>
              {/each}
            {/if}
          </tbody>
        </table>
      </div>
    </section>

    <section class="mb-6 grid gap-4 lg:grid-cols-2">
      <div class="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
        <h2 class="mb-3 text-sm font-semibold text-slate-200">Profile Summary</h2>
        <div class="overflow-auto">
          <table class="min-w-full text-xs">
            <thead class="bg-slate-950/70 text-slate-300">
              <tr>
                <th class="px-2 py-2 text-left">Profile</th>
                <th class="px-2 py-2 text-right">Tokens</th>
                <th class="px-2 py-2 text-right">Total Cost</th>
                <th class="px-2 py-2 text-right">Avg Daily</th>
              </tr>
            </thead>
            <tbody>
              {#if profileRows.length === 0}
                <tr><td class="px-2 py-3 text-slate-500" colspan="4">No data yet.</td></tr>
              {:else}
                {#each profileRows as row}
                  <tr class="border-t border-slate-800">
                    <td class="px-2 py-2">{row.profileId}</td>
                    <td class="px-2 py-2 text-right">{fmtNum(row.totalTokens)}</td>
                    <td class="px-2 py-2 text-right">{fmtUSD(row.totalCost)}</td>
                    <td class="px-2 py-2 text-right">{fmtUSD(row.avgDailyCost)}</td>
                  </tr>
                {/each}
              {/if}
            </tbody>
          </table>
        </div>
      </div>

      <div class="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
        <h2 class="mb-3 text-sm font-semibold text-slate-200">Tool Totals</h2>
        <div class="overflow-auto">
          <table class="min-w-full text-xs">
            <thead class="bg-slate-950/70 text-slate-300">
              <tr>
                <th class="px-2 py-2 text-left">Tool</th>
                <th class="px-2 py-2 text-right">Tokens</th>
                <th class="px-2 py-2 text-right">Observed</th>
                <th class="px-2 py-2 text-right">Calculated</th>
                <th class="px-2 py-2 text-right">Effective</th>
                <th class="px-2 py-2 text-right">Profiles</th>
              </tr>
            </thead>
            <tbody>
              {#if toolRows.length === 0}
                <tr><td class="px-2 py-3 text-slate-500" colspan="6">No data yet.</td></tr>
              {:else}
                {#each toolRows as row}
                  <tr class="border-t border-slate-800">
                    <td class="px-2 py-2">{row.tool}</td>
                    <td class="px-2 py-2 text-right">{fmtNum(row.totalTokens)}</td>
                    <td class="px-2 py-2 text-right">{fmtUSD(row.observedCostUSD)}</td>
                    <td class="px-2 py-2 text-right">{fmtUSD(row.calculatedCostUSD)}</td>
                    <td class="px-2 py-2 text-right font-medium text-emerald-300">{fmtUSD(row.totalCostUSD)}</td>
                    <td class="px-2 py-2 text-right">{row.activeProfiles}</td>
                  </tr>
                {/each}
              {/if}
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <section class="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <h2 class="mb-3 text-sm font-semibold text-slate-200">Import Log</h2>
      <div class="max-h-60 overflow-auto rounded-md border border-slate-800 bg-slate-950/60 p-2 text-xs text-slate-300">
        {#if importLog.length === 0}
          <p class="text-slate-500">No events yet.</p>
        {:else}
          <ul class="space-y-1">
            {#each importLog as line}
              <li>{line}</li>
            {/each}
          </ul>
        {/if}
      </div>
    </section>
  </div>
</div>
