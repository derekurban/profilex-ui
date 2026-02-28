<script lang="ts">
  import type { KpiData } from '../../lib/types';
  import { fmtNum, fmtUSD, fmtPercent } from '../../lib/format';

  let { kpis }: { kpis: KpiData } = $props();

  type Card = {
    label: string;
    value: string;
    trend?: number;
    accent: string;
    icon: string;
  };

  let cards = $derived<Card[]>([
    {
      label: 'Total Tokens',
      value: fmtNum(kpis.totalTokens),
      trend: kpis.trends.tokens,
      accent: 'from-cyan-500/20 to-cyan-500/5',
      icon: '⬡',
    },
    {
      label: 'Effective Cost',
      value: fmtUSD(kpis.effectiveCost),
      trend: kpis.trends.cost,
      accent: 'from-amber-500/20 to-amber-500/5',
      icon: '◈',
    },
    {
      label: 'Events',
      value: fmtNum(kpis.eventCount),
      trend: kpis.trends.events,
      accent: 'from-violet-500/20 to-violet-500/5',
      icon: '◇',
    },
    {
      label: 'Sessions',
      value: fmtNum(kpis.sessionCount),
      accent: 'from-emerald-500/20 to-emerald-500/5',
      icon: '△',
    },
    {
      label: 'Models Used',
      value: String(kpis.modelCount),
      accent: 'from-pink-500/20 to-pink-500/5',
      icon: '○',
    },
    {
      label: 'Avg Daily Cost',
      value: fmtUSD(kpis.avgDailyCost),
      accent: 'from-orange-500/20 to-orange-500/5',
      icon: '□',
    },
  ]);

  function trendLabel(t: number): string {
    if (t === 0) return '';
    return (t > 0 ? '+' : '') + fmtPercent(t);
  }
</script>

<div class="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
  {#each cards as card, i}
    <div
      class="group relative overflow-hidden rounded-xl border border-white/[0.06] bg-gradient-to-br {card.accent} p-4 transition-all hover:border-white/[0.12] hover:scale-[1.02]"
      style="animation-delay: {i * 60}ms"
    >
      <div class="absolute top-2 right-3 text-2xl opacity-[0.07] font-light select-none">{card.icon}</div>
      <p class="text-[10px] uppercase tracking-[0.15em] text-slate-400 font-medium">{card.label}</p>
      <p class="mt-1.5 text-xl font-semibold tracking-tight font-mono">{card.value}</p>
      {#if card.trend != null && card.trend !== 0}
        <p class="mt-1 text-[10px] font-medium {card.trend > 0 ? 'text-rose-400' : 'text-emerald-400'}">
          {card.trend > 0 ? '↑' : '↓'} {trendLabel(card.trend)}
          <span class="text-slate-500 ml-1">vs prior</span>
        </p>
      {/if}
    </div>
  {/each}
</div>

{#if kpis.sharedSessionCount > 0}
  <div class="mt-3 flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-2 text-xs text-slate-400">
    <span class="inline-flex h-5 w-5 items-center justify-center rounded-full bg-violet-500/20 text-[10px] text-violet-300">⊕</span>
    <span><strong class="text-slate-200">{fmtNum(kpis.sharedSessionCount)}</strong> shared session events detected</span>
  </div>
{/if}
