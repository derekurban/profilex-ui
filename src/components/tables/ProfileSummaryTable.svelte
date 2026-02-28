<script lang="ts">
  import type { ProfileSummary, ColumnDef } from '../../lib/types';
  import { fmtNum, fmtUSD } from '../../lib/format';
  import DataTable from '../shared/DataTable.svelte';

  let { rows }: { rows: ProfileSummary[] } = $props();

  const columns: ColumnDef<ProfileSummary>[] = [
    { key: 'profileId', label: 'Profile', align: 'left' },
    { key: 'tool', label: 'Tool', align: 'left' },
    { key: 'totalTokens', label: 'Tokens', align: 'right', format: (v) => fmtNum(v as number) },
    { key: 'totalCost', label: 'Total Cost', align: 'right', format: (v) => fmtUSD(v as number) },
    { key: 'avgDailyCost', label: 'Avg Daily', align: 'right', format: (v) => fmtUSD(v as number) },
    { key: 'firstSeen', label: 'First Seen', align: 'left', format: (v) => (v as string).slice(0, 10) },
    { key: 'lastSeen', label: 'Last Seen', align: 'left', format: (v) => (v as string).slice(0, 10) },
    {
      key: 'topModels', label: 'Top Models', align: 'left', sortable: false,
      format: (v) => {
        const arr = v as string[];
        return arr.slice(0, 2).join(', ') + (arr.length > 2 ? '...' : '');
      },
    },
  ];
</script>

<div class="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
  <h3 class="mb-3 text-xs font-medium uppercase tracking-[0.15em] text-slate-400">Profile Summary</h3>
  <DataTable {columns} {rows} defaultSort="totalCost" defaultDirection="desc" />
</div>
