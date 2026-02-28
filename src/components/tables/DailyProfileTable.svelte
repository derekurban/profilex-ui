<script lang="ts">
  import type { AggregatedRow } from '../../lib/types';
  import type { ColumnDef } from '../../lib/types';
  import { fmtNum, fmtUSD } from '../../lib/format';
  import DataTable from '../shared/DataTable.svelte';

  let { rows }: { rows: AggregatedRow[] } = $props();

  const columns: ColumnDef<AggregatedRow>[] = [
    { key: 'dateLocal', label: 'Date', align: 'left' },
    { key: 'tool', label: 'Tool', align: 'left' },
    { key: 'profileId', label: 'Profile', align: 'left' },
    { key: 'totalTokens', label: 'Tokens', align: 'right', format: (v) => fmtNum(v as number) },
    { key: 'observedCostUSD', label: 'Observed', align: 'right', format: (v) => fmtUSD(v as number) },
    { key: 'calculatedCostUSD', label: 'Calculated', align: 'right', format: (v) => fmtUSD(v as number) },
    { key: 'effectiveCostUSD', label: 'Effective', align: 'right', format: (v) => fmtUSD(v as number) },
    { key: 'sessionsCount', label: 'Sessions', align: 'right', format: (v) => fmtNum(v as number) },
    {
      key: 'modelsUsed', label: 'Models', align: 'left', sortable: false,
      format: (v) => {
        const arr = v as string[];
        return arr.slice(0, 3).join(', ') + (arr.length > 3 ? '...' : '');
      },
    },
  ];
</script>

<div class="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
  <h3 class="mb-3 text-xs font-medium uppercase tracking-[0.15em] text-slate-400">Daily x Profile Breakdown</h3>
  <DataTable {columns} {rows} defaultSort="dateLocal" defaultDirection="desc" />
</div>
