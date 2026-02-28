<script lang="ts">
  import type { ChartConfiguration } from 'chart.js/auto';
  import type { TimeSeriesPoint } from '../../lib/types';
  import { TOOL_COLORS, CHART_DEFAULTS } from '../../lib/chart-theme';
  import BaseChart from '../shared/BaseChart.svelte';

  let { data }: { data: TimeSeriesPoint[] } = $props();

  let config = $derived<ChartConfiguration>({
    type: 'line',
    data: {
      labels: data.map((p) => p.date),
      datasets: Object.keys(data[0]?.values ?? {}).map((tool) => ({
        label: tool.charAt(0).toUpperCase() + tool.slice(1),
        data: data.map((p) => p.values[tool] ?? 0),
        borderColor: TOOL_COLORS[tool] ?? TOOL_COLORS.unknown,
        backgroundColor: (TOOL_COLORS[tool] ?? TOOL_COLORS.unknown) + '20',
        fill: true,
        tension: 0.3,
        pointRadius: data.length > 60 ? 0 : 2,
        pointHoverRadius: 4,
        borderWidth: 2,
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
            label: (ctx) => `${ctx.dataset.label}: $${(ctx.parsed.y ?? 0).toFixed(2)}`,
          },
        },
      },
      scales: {
        ...CHART_DEFAULTS.scales,
        y: {
          ...CHART_DEFAULTS.scales.y,
          ticks: {
            ...CHART_DEFAULTS.scales.y.ticks,
            callback: (v) => '$' + Number(v).toFixed(0),
          },
        },
      },
    },
  });
</script>

<div class="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
  <h3 class="mb-3 text-xs font-medium uppercase tracking-[0.15em] text-slate-400">Cost Over Time</h3>
  {#if data.length === 0}
    <div class="flex h-[280px] items-center justify-center text-sm text-slate-500">No data</div>
  {:else}
    <BaseChart {config} height={280} />
  {/if}
</div>
