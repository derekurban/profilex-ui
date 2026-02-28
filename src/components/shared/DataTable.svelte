<script lang="ts" generics="T extends Record<string, unknown>">
  import type { ColumnDef, SortDirection } from '../../lib/types';
  import { fmtNum } from '../../lib/format';

  let {
    columns,
    rows,
    defaultSort = '',
    defaultDirection = 'desc' as SortDirection,
    searchable = true,
  }: {
    columns: ColumnDef<T>[];
    rows: T[];
    defaultSort?: string;
    defaultDirection?: SortDirection;
    searchable?: boolean;
  } = $props();

  let searchQuery = $state('');
  // svelte-ignore state_referenced_locally
  let sortKey = $state(defaultSort);
  // svelte-ignore state_referenced_locally
  let sortDir = $state<SortDirection>(defaultDirection);
  let pageSize = $state(25);
  let currentPage = $state(0);
  let searchTimeout: ReturnType<typeof setTimeout>;

  let debouncedSearch = $state('');

  function onSearchInput(e: Event) {
    const value = (e.target as HTMLInputElement).value;
    searchQuery = value;
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      debouncedSearch = value;
      currentPage = 0;
    }, 150);
  }

  function toggleSort(key: string) {
    if (sortKey === key) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      sortKey = key;
      sortDir = 'desc';
    }
    currentPage = 0;
  }

  let filteredRows = $derived.by(() => {
    let result = rows;
    const q = debouncedSearch.toLowerCase().trim();
    if (q) {
      result = result.filter((row) =>
        columns.some((col) => {
          const val = row[col.key];
          return val != null && String(val).toLowerCase().includes(q);
        })
      );
    }
    return result;
  });

  let sortedRows = $derived.by(() => {
    if (!sortKey) return filteredRows;
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return filteredRows;
    return [...filteredRows].sort((a, b) => {
      const av = a[sortKey] as string | number;
      const bv = b[sortKey] as string | number;
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  });

  let totalPages = $derived(Math.max(1, Math.ceil(sortedRows.length / pageSize)));
  let pagedRows = $derived(sortedRows.slice(currentPage * pageSize, (currentPage + 1) * pageSize));

  function exportCsv() {
    const header = columns.map((c) => c.label).join(',');
    const body = sortedRows.map((row) =>
      columns.map((col) => {
        const val = row[col.key];
        const str = val == null ? '' : String(val);
        return str.includes(',') ? `"${str}"` : str;
      }).join(',')
    ).join('\n');
    const blob = new Blob([header + '\n' + body], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'export.csv';
    a.click();
    URL.revokeObjectURL(url);
  }
</script>

<div class="space-y-3">
  <div class="flex flex-wrap items-center gap-3">
    {#if searchable}
      <input
        type="text"
        placeholder="Search..."
        value={searchQuery}
        oninput={onSearchInput}
        class="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 outline-none transition focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20"
      />
    {/if}
    <div class="flex items-center gap-2 text-[11px] text-slate-400 ml-auto">
      <span>{fmtNum(filteredRows.length)} rows</span>
      <select
        bind:value={pageSize}
        onchange={() => (currentPage = 0)}
        class="rounded border border-white/[0.06] bg-white/[0.03] px-2 py-1 text-[11px] text-slate-300"
      >
        <option value={10}>10</option>
        <option value={25}>25</option>
        <option value={50}>50</option>
        <option value={100}>100</option>
      </select>
      <button
        onclick={exportCsv}
        class="rounded border border-white/[0.06] bg-white/[0.03] px-2 py-1 text-[11px] text-slate-300 hover:bg-white/[0.06] transition"
      >CSV</button>
    </div>
  </div>

  <div class="overflow-auto rounded-lg border border-white/[0.06]">
    <table class="min-w-full text-xs">
      <thead>
        <tr class="border-b border-white/[0.06] bg-white/[0.02]">
          {#each columns as col}
            <th
              class="px-3 py-2.5 font-medium text-slate-400 uppercase tracking-wider text-[10px] select-none
                     {col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}
                     {col.sortable !== false ? 'cursor-pointer hover:text-slate-200 transition' : ''}"
              onclick={() => col.sortable !== false && toggleSort(col.key)}
            >
              <span class="inline-flex items-center gap-1">
                {col.label}
                {#if sortKey === col.key}
                  <span class="text-cyan-400">{sortDir === 'asc' ? '▲' : '▼'}</span>
                {/if}
              </span>
            </th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#if pagedRows.length === 0}
          <tr>
            <td class="px-3 py-6 text-center text-slate-500" colspan={columns.length}>No data.</td>
          </tr>
        {:else}
          {#each pagedRows as row}
            <tr class="border-t border-white/[0.03] hover:bg-white/[0.02] transition-colors">
              {#each columns as col}
                <td class="px-3 py-2 {col.align === 'right' ? 'text-right tabular-nums' : col.align === 'center' ? 'text-center' : 'text-left'}">
                  {#if col.format}
                    {col.format(row[col.key], row)}
                  {:else}
                    {row[col.key] ?? ''}
                  {/if}
                </td>
              {/each}
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>
  </div>

  {#if totalPages > 1}
    <div class="flex items-center justify-between text-[11px] text-slate-400">
      <span>Page {currentPage + 1} of {totalPages}</span>
      <div class="flex gap-1">
        <button
          class="rounded border border-white/[0.06] bg-white/[0.03] px-2.5 py-1 hover:bg-white/[0.06] disabled:opacity-30 transition"
          disabled={currentPage === 0}
          onclick={() => currentPage--}
        >Prev</button>
        <button
          class="rounded border border-white/[0.06] bg-white/[0.03] px-2.5 py-1 hover:bg-white/[0.06] disabled:opacity-30 transition"
          disabled={currentPage >= totalPages - 1}
          onclick={() => currentPage++}
        >Next</button>
      </div>
    </div>
  {/if}
</div>
