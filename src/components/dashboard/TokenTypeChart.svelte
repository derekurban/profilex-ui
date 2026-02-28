<script lang="ts">
  import type { ChartConfiguration } from 'chart.js/auto';
  import type { TokenTypeBreakdown } from '../../lib/types';
  import { TOKEN_TYPE_COLORS, CHART_DEFAULTS } from '../../lib/chart-theme';
  import { fmtNum } from '../../lib/format';
  import BaseChart from '../shared/BaseChart.svelte';

  let { data }: { data: TokenTypeBreakdown[] } = $props();

  const series: { key: keyof TokenTypeBreakdown; label: string; color: string }[] = [
    { key: 'input', label: 'Input', color: TOKEN_TYPE_COLORS.input },
    { key: 'output', label: 'Output', color: TOKEN_TYPE_COLORS.output },
    { key: 'cached', label: 'Cached Input', color: TOKEN_TYPE_COLORS.cached },
    { key: 'reasoning', label: 'Reasoning', color: TOKEN_TYPE_COLORS.reasoning },
    { key: 'cacheCreation', label: 'Cache Creation', color: TOKEN_TYPE_COLORS.cacheCreation },
    { key: 'cacheRead', label: 'Cache Read', color: TOKEN_TYPE_COLORS.cacheRead },
  ];

  let config = $derived<ChartConfiguration>({
    type: 'bar',
    data: {
      labels: data.map((d) => d.date),
      datasets: series.map((s) => ({
        label: s.label,
        data: data.map((d) => d[s.key] as number),
        backgroundColor: s.color + '99',
        borderColor: s.color,
        borderWidth: 1,
        borderRadius: 1,
      })),
    },
    options: {
      ...CHART_DEFAULTS,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        ...CHART_DEFAULTS.plugins,
        tooltip: {
          ...CHART_DEFAULTS.plugins.tooltip,
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${fmtNum(ctx.parsed.y ?? 0)}`,
          },
        },
      },
      scales: {
        ...CHART_DEFAULTS.scales,
        x: { ...CHART_DEFAULTS.scales.x, stacked: true },
        y: {
          ...CHART_DEFAULTS.scales.y,
          stacked: true,
          ticks: {
            ...CHART_DEFAULTS.scales.y.ticks,
            callback: (v) => {
              const n = Number(v);
              if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
              if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K';
              return String(n);
            },
          },
        },
      },
    },
  });
</script>

<div class="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
  <h3 class="mb-3 text-xs font-medium uppercase tracking-[0.15em] text-slate-400">Token Types</h3>
  {#if data.length === 0}
    <div class="flex h-[280px] items-center justify-center text-sm text-slate-500">No data</div>
  {:else}
    <BaseChart {config} height={280} />
  {/if}
</div>
