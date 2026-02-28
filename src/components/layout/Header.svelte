<script lang="ts">
  let { eventCount = 0 }: { eventCount?: number } = $props();
</script>

<header class="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br from-[#0c1222] via-[#0f172a] to-[#1a1040] p-6 shadow-2xl shadow-indigo-950/30">
  <!-- Atmospheric background elements -->
  <div class="pointer-events-none absolute inset-0 opacity-[0.03]" style="background-image: radial-gradient(circle at 20% 50%, #818cf8 0%, transparent 50%), radial-gradient(circle at 80% 20%, #22d3ee 0%, transparent 50%)"></div>
  <div class="pointer-events-none absolute -top-24 -right-24 h-48 w-48 rounded-full bg-cyan-500/[0.04] blur-3xl"></div>

  <div class="relative">
    <div class="flex items-center gap-3">
      <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500/20 to-indigo-500/20 text-sm font-bold text-cyan-400">P</div>
      <div>
        <p class="text-[10px] uppercase tracking-[0.25em] text-cyan-400/70 font-medium">ProfileX-UI</p>
        <h1 class="text-2xl font-bold tracking-tight">Usage Intelligence</h1>
      </div>
    </div>
    <p class="mt-3 max-w-2xl text-[13px] leading-relaxed text-slate-400">
      Unified analytics for Claude Code, Codex CLI & OpenClaw — token usage, cost tracking, and profile intelligence across all your AI development tools.
    </p>
    {#if eventCount > 0}
      <div class="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1">
        <span class="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
        <span class="text-[11px] font-medium text-emerald-300">{eventCount.toLocaleString()} events loaded</span>
      </div>
    {/if}
  </div>
</header>
