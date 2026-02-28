<script lang="ts">
  import type { ChartConfiguration } from 'chart.js/auto';
  import type { ToolSummary } from '../../lib/types';
  import { TOOL_COLORS, CHART_DEFAULTS } from '../../lib/chart-theme';
  import BaseChart from '../shared/BaseChart.svelte';

  let { data }: { data: ToolSummary[] } = $props();

  let config = $derived<ChartConfiguration>({
    type: 'doughnut',
    data: {
      labels: data.map((d) => d.tool.charAt(0).toUpperCase() + d.tool.slice(1)),
      datasets: [{
        data: data.map((d) => d.totalCostUSD),
        backgroundColor: data.map((d) => (TOOL_COLORS[d.tool] ?? TOOL_COLORS.unknown) + 'cc'),
        borderColor: data.map((d) => TOOL_COLORS[d.tool] ?? TOOL_COLORS.unknown),
        borderWidth: 2,
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            ...CHART_DEFAULTS.plugins.legend.labels,
            usePointStyle: true,
            pointStyle: 'circle',
          },
        },
        tooltip: {
          ...CHART_DEFAULTS.plugins.tooltip,
          callbacks: {
            label: (ctx: any) => {
              const total = (ctx.dataset.data as number[]).reduce((a: number, b: number) => a + b, 0);
              const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : '0';
              return `${ctx.label}: $${ctx.parsed.toFixed(2)} (${pct}%)`;
            },
          },
        },
      },
      elements: { arc: { borderWidth: 2 } },
    } as any,
  });
</script>

<div class="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
  <h3 class="mb-3 text-xs font-medium uppercase tracking-[0.15em] text-slate-400">Cost by Tool</h3>
  {#if data.length === 0}
    <div class="flex h-[240px] items-center justify-center text-sm text-slate-500">No data</div>
  {:else}
    <BaseChart {config} height={240} />
  {/if}
</div>
