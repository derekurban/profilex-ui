<script lang="ts">
  import type { Tool, ProfilexState } from '../../lib/types';

  let {
    timezone = $bindable(),
    costMode = $bindable(),
    toolHint = $bindable(),
    profilexState,
    pricingLoaded,
    pricingStatus,
    pricingEntries,
    localBundleStatus,
    importLog,
    onLoadPricing,
    onProfilexStateUpload,
    onUsageFilesUpload,
    onUnifiedBundleUpload,
    onLoadLocalUnified,
    onClearAll,
  }: {
    timezone: string;
    costMode: 'auto' | 'calculate' | 'display';
    toolHint: Tool | 'auto';
    profilexState: ProfilexState | null;
    pricingLoaded: boolean;
    pricingStatus: string;
    pricingEntries: number;
    localBundleStatus: string;
    importLog: string[];
    onLoadPricing: () => void;
    onProfilexStateUpload: (ev: Event) => void;
    onUsageFilesUpload: (ev: Event) => void;
    onUnifiedBundleUpload: (ev: Event) => void;
    onLoadLocalUnified: () => void;
    onClearAll: () => void;
  } = $props();
</script>

<div class="space-y-4">
  <div class="grid gap-4 lg:grid-cols-2">
    <!-- Config panel -->
    <div class="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
      <h2 class="mb-4 text-xs font-medium uppercase tracking-[0.15em] text-slate-400">Configuration</h2>

      <div class="grid gap-3 md:grid-cols-2">
        <label class="space-y-1">
          <span class="text-[10px] uppercase tracking-wider text-slate-500 font-medium">Timezone</span>
          <input
            class="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-slate-200 outline-none transition focus:border-cyan-500/40"
            bind:value={timezone}
            placeholder="America/Edmonton"
          />
        </label>

        <label class="space-y-1">
          <span class="text-[10px] uppercase tracking-wider text-slate-500 font-medium">Cost mode</span>
          <select class="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-slate-200 outline-none" bind:value={costMode}>
            <option value="auto">auto (observed if available)</option>
            <option value="calculate">calculate</option>
            <option value="display">display (observed only)</option>
          </select>
        </label>

        <label class="space-y-1">
          <span class="text-[10px] uppercase tracking-wider text-slate-500 font-medium">Tool hint</span>
          <select class="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-slate-200 outline-none" bind:value={toolHint}>
            <option value="auto">auto detect</option>
            <option value="claude">force claude</option>
            <option value="codex">force codex</option>
            <option value="openclaw">force openclaw</option>
          </select>
        </label>

        <div class="space-y-1">
          <span class="text-[10px] uppercase tracking-wider text-slate-500 font-medium">Pricing</span>
          <button
            class="w-full rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-sm font-medium text-cyan-300 hover:bg-cyan-500/20 transition"
            onclick={onLoadPricing}
          >Pull latest pricing</button>
          <p class="text-[10px] text-slate-500">{pricingStatus}{pricingLoaded ? ` (${pricingEntries})` : ''}</p>
        </div>
      </div>
    </div>

    <!-- File uploads -->
    <div class="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
      <h2 class="mb-4 text-xs font-medium uppercase tracking-[0.15em] text-slate-400">File Imports</h2>

      <div class="grid gap-3 md:grid-cols-2">
        <label class="space-y-1">
          <span class="text-[10px] uppercase tracking-wider text-slate-500 font-medium">ProfileX state.json</span>
          <input class="block w-full text-xs text-slate-300 file:mr-2 file:rounded-md file:border-0 file:bg-white/[0.06] file:px-3 file:py-1.5 file:text-xs file:text-slate-300" type="file" accept="application/json,.json" onchange={onProfilexStateUpload} />
        </label>

        <label class="space-y-1">
          <span class="text-[10px] uppercase tracking-wider text-slate-500 font-medium">Usage files (.jsonl)</span>
          <input class="block w-full text-xs text-slate-300 file:mr-2 file:rounded-md file:border-0 file:bg-white/[0.06] file:px-3 file:py-1.5 file:text-xs file:text-slate-300" type="file" multiple accept=".jsonl" onchange={onUsageFilesUpload} />
        </label>

        <label class="space-y-1 md:col-span-2">
          <span class="text-[10px] uppercase tracking-wider text-slate-500 font-medium">Usage folder (nested .jsonl)</span>
          <input class="block w-full text-xs text-slate-300 file:mr-2 file:rounded-md file:border-0 file:bg-white/[0.06] file:px-3 file:py-1.5 file:text-xs file:text-slate-300" type="file" multiple webkitdirectory onchange={onUsageFilesUpload} />
        </label>

        <label class="space-y-1 md:col-span-2">
          <span class="text-[10px] uppercase tracking-wider text-slate-500 font-medium">ProfileX bundle(s) (.json)</span>
          <input class="block w-full text-xs text-slate-300 file:mr-2 file:rounded-md file:border-0 file:bg-white/[0.06] file:px-3 file:py-1.5 file:text-xs file:text-slate-300" type="file" multiple accept="application/json,.json" onchange={onUnifiedBundleUpload} />
        </label>
      </div>

      <div class="mt-4 rounded-lg border border-white/[0.04] bg-white/[0.02] p-3 text-[11px] text-slate-500">
        <p>{localBundleStatus}</p>
        <p class="mt-1">Run <code class="text-slate-400">pnpm generate:local</code> to create auto-load data.</p>
        <button class="mt-2 rounded border border-white/[0.06] bg-white/[0.03] px-2 py-1 text-slate-300 hover:bg-white/[0.06] transition" onclick={onLoadLocalUnified}>
          Reload local unified file
        </button>
      </div>

      <div class="mt-3 flex items-center gap-3">
        <button class="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-300 hover:bg-rose-500/20 transition" onclick={onClearAll}>Clear data</button>
        {#if profilexState}
          <span class="text-[11px] text-emerald-400">ProfileX profiles: {profilexState.profiles.length}</span>
        {/if}
      </div>
    </div>
  </div>

  <!-- Import log -->
  <div class="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
    <h2 class="mb-3 text-xs font-medium uppercase tracking-[0.15em] text-slate-400">Import Log</h2>
    <div class="max-h-48 overflow-auto rounded-lg border border-white/[0.04] bg-black/20 p-3 text-xs font-mono text-slate-400">
      {#if importLog.length === 0}
        <p class="text-slate-600">No events yet.</p>
      {:else}
        <ul class="space-y-0.5">
          {#each importLog as line}
            <li class="leading-relaxed">{line}</li>
          {/each}
        </ul>
      {/if}
    </div>
  </div>
</div>
