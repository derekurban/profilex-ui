<script lang="ts">
  import type { Tool, SharedSessionFilter } from '../../lib/types';
  import type { FilterState } from '../../lib/filter';
  import { createDefaultFilter } from '../../lib/filter';

  let {
    filter = $bindable(),
    availableTools = [] as Tool[],
    availableModels = [] as string[],
    availableProfiles = [] as string[],
    minDate = '',
    maxDate = '',
  }: {
    filter: FilterState;
    availableTools?: Tool[];
    availableModels?: string[];
    availableProfiles?: string[];
    minDate?: string;
    maxDate?: string;
  } = $props();

  let dateTimeout: ReturnType<typeof setTimeout>;

  function onDateChange(field: 'dateStart' | 'dateEnd', value: string) {
    clearTimeout(dateTimeout);
    dateTimeout = setTimeout(() => {
      filter = { ...filter, [field]: value };
    }, 250);
  }

  function toggleTool(tool: Tool) {
    const tools = filter.tools.includes(tool)
      ? filter.tools.filter((t) => t !== tool)
      : [...filter.tools, tool];
    filter = { ...filter, tools };
  }

  function setModel(e: Event) {
    const value = (e.target as HTMLSelectElement).value;
    filter = { ...filter, models: value ? [value] : [] };
  }

  function setProfile(e: Event) {
    const value = (e.target as HTMLSelectElement).value;
    filter = { ...filter, profiles: value ? [value] : [] };
  }

  function setShared(e: Event) {
    filter = { ...filter, sharedSessions: (e.target as HTMLSelectElement).value as SharedSessionFilter };
  }

  function reset() {
    filter = createDefaultFilter();
  }

  const toolLabels: Record<string, string> = {
    claude: 'Claude',
    codex: 'Codex',
    openclaw: 'OpenClaw',
    unknown: 'Unknown',
  };

  const toolColorsActive: Record<string, string> = {
    claude: 'bg-indigo-500/50 border-indigo-400 text-indigo-100 shadow-indigo-500/20 shadow-md',
    codex: 'bg-emerald-500/50 border-emerald-400 text-emerald-100 shadow-emerald-500/20 shadow-md',
    openclaw: 'bg-orange-500/50 border-orange-400 text-orange-100 shadow-orange-500/20 shadow-md',
    unknown: 'bg-slate-500/50 border-slate-400 text-slate-100 shadow-slate-500/20 shadow-md',
  };

  const toolColorsInactive: Record<string, string> = {
    claude: 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300',
    codex: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300',
    openclaw: 'bg-orange-500/20 border-orange-500/40 text-orange-300',
    unknown: 'bg-slate-500/20 border-slate-500/40 text-slate-300',
  };

  let hasActiveFilters = $derived(
    filter.dateStart !== '' || filter.dateEnd !== '' ||
    filter.tools.length > 0 || filter.models.length > 0 ||
    filter.profiles.length > 0 || filter.sharedSessions !== 'all'
  );
</script>

<div class="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 backdrop-blur-sm">
  <div class="flex flex-wrap items-end gap-x-4 gap-y-3">
    <label class="space-y-1">
      <span class="text-[10px] uppercase tracking-wider text-slate-500 font-medium">From</span>
      <input
        type="date"
        value={filter.dateStart || minDate}
        oninput={(e) => onDateChange('dateStart', (e.target as HTMLInputElement).value)}
        class="block rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-cyan-500/40 transition"
      />
    </label>

    <label class="space-y-1">
      <span class="text-[10px] uppercase tracking-wider text-slate-500 font-medium">To</span>
      <input
        type="date"
        value={filter.dateEnd || maxDate}
        oninput={(e) => onDateChange('dateEnd', (e.target as HTMLInputElement).value)}
        class="block rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-cyan-500/40 transition"
      />
    </label>

    <div class="space-y-1">
      <span class="block text-[10px] uppercase tracking-wider text-slate-500 font-medium">Tools</span>
      <div class="flex gap-1.5">
        {#each availableTools as tool}
          <button
            onclick={() => toggleTool(tool)}
            class="rounded-md border px-2.5 py-1 text-[11px] font-medium transition-all
                   {filter.tools.length === 0 || filter.tools.includes(tool) ? toolColorsActive[tool] : toolColorsInactive[tool]}"
          >{toolLabels[tool] || tool}</button>
        {/each}
      </div>
    </div>

    <label class="space-y-1">
      <span class="text-[10px] uppercase tracking-wider text-slate-500 font-medium">Model</span>
      <select
        onchange={setModel}
        class="block rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-cyan-500/40 transition"
      >
        <option value="">All models</option>
        {#each availableModels as model}
          <option value={model} selected={filter.models.includes(model)}>{model}</option>
        {/each}
      </select>
    </label>

    <label class="space-y-1">
      <span class="text-[10px] uppercase tracking-wider text-slate-500 font-medium">Profile</span>
      <select
        onchange={setProfile}
        class="block rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-cyan-500/40 transition"
      >
        <option value="">All profiles</option>
        {#each availableProfiles as profile}
          <option value={profile} selected={filter.profiles.includes(profile)}>{profile}</option>
        {/each}
      </select>
    </label>

    <label class="space-y-1">
      <span class="text-[10px] uppercase tracking-wider text-slate-500 font-medium">Shared</span>
      <select
        onchange={setShared}
        class="block rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-cyan-500/40 transition"
      >
        <option value="all" selected={filter.sharedSessions === 'all'}>All sessions</option>
        <option value="shared-only" selected={filter.sharedSessions === 'shared-only'}>Shared only</option>
        <option value="non-shared-only" selected={filter.sharedSessions === 'non-shared-only'}>Non-shared only</option>
      </select>
    </label>

    {#if hasActiveFilters}
      <button
        onclick={reset}
        class="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-[11px] font-medium text-rose-300 hover:bg-rose-500/20 transition"
      >Reset filters</button>
    {/if}
  </div>
</div>
