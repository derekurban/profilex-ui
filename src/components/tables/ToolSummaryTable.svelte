<script lang="ts">
  import type { ToolSummary, ColumnDef } from '../../lib/types';
  import { fmtNum, fmtUSD } from '../../lib/format';
  import DataTable from '../shared/DataTable.svelte';

  let { rows }: { rows: ToolSummary[] } = $props();

  const columns: ColumnDef<ToolSummary>[] = [
    { key: 'tool', label: 'Tool', align: 'left' },
    { key: 'totalTokens', label: 'Tokens', align: 'right', format: (v) => fmtNum(v as number) },
    { key: 'observedCostUSD', label: 'Observed', align: 'right', format: (v) => fmtUSD(v as number) },
    { key: 'calculatedCostUSD', label: 'Calculated', align: 'right', format: (v) => fmtUSD(v as number) },
    { key: 'totalCostUSD', label: 'Effective', align: 'right', format: (v) => fmtUSD(v as number) },
    { key: 'activeProfiles', label: 'Profiles', align: 'right', format: (v) => fmtNum(v as number) },
  ];
</script>

<div class="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
  <h3 class="mb-3 text-xs font-medium uppercase tracking-[0.15em] text-slate-400">Tool Totals</h3>
  <DataTable {columns} {rows} defaultSort="totalCostUSD" defaultDirection="desc" />
</div>
