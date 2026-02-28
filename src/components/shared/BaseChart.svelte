<script lang="ts">
  import { Chart, type ChartConfiguration } from 'chart.js/auto';
  import 'chartjs-adapter-date-fns';

  let { config, height = 300 }: { config: ChartConfiguration; height?: number } = $props();

  let canvas: HTMLCanvasElement | undefined = $state();

  $effect(() => {
    if (!canvas) return;
    const cfg = config;
    const instance = new Chart(canvas, cfg);
    return () => instance.destroy();
  });
</script>

<div class="relative w-full" style="height: {height}px">
  <canvas bind:this={canvas} class="absolute inset-0"></canvas>
</div>
