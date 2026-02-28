<script lang="ts">
  import type { TimeBucket } from '../../lib/types';

  let { bucket = $bindable() }: { bucket: TimeBucket } = $props();

  const options: { value: TimeBucket; label: string }[] = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
  ];
</script>

<div class="inline-flex rounded-lg border border-white/[0.06] bg-white/[0.02] p-0.5">
  {#each options as opt}
    <button
      onclick={() => (bucket = opt.value)}
      class="rounded-md px-3 py-1 text-[11px] font-medium transition-all
             {bucket === opt.value
               ? 'bg-cyan-500/20 text-cyan-300 shadow-sm shadow-cyan-500/10'
               : 'text-slate-400 hover:text-slate-200'}"
    >{opt.label}</button>
  {/each}
</div>
