<script lang="ts">
  export type Tab = 'overview' | 'tables' | 'import';

  let { activeTab = $bindable() }: { activeTab: Tab } = $props();

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: '◈' },
    { id: 'tables', label: 'Tables', icon: '▤' },
    { id: 'import', label: 'Import', icon: '↓' },
  ];
</script>

<nav class="flex gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-1 backdrop-blur-sm">
  {#each tabs as tab}
    <button
      onclick={() => (activeTab = tab.id)}
      class="relative flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-medium transition-all
             {activeTab === tab.id
               ? 'bg-white/[0.08] text-white shadow-sm'
               : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]'}"
    >
      <span class="text-xs opacity-60">{tab.icon}</span>
      {tab.label}
      {#if activeTab === tab.id}
        <div class="absolute bottom-0 left-1/2 h-[2px] w-8 -translate-x-1/2 rounded-full bg-cyan-400/60"></div>
      {/if}
    </button>
  {/each}
</nav>
