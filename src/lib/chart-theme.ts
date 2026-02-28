import type { Tool } from './types';

export const TOOL_COLORS: Record<Tool | string, string> = {
  claude: '#818cf8',   // indigo-400
  codex: '#34d399',    // emerald-400
  openclaw: '#fb923c', // orange-400
  unknown: '#94a3b8',  // slate-400
};

export const TOKEN_TYPE_COLORS = {
  input: '#60a5fa',          // blue-400
  output: '#a78bfa',         // violet-400
  cached: '#2dd4bf',         // teal-400
  reasoning: '#f472b6',      // pink-400
  cacheCreation: '#fbbf24',  // amber-400
  cacheRead: '#4ade80',      // green-400
};

export const MODEL_COLORS = [
  '#818cf8', '#34d399', '#fb923c', '#f472b6', '#60a5fa',
  '#a78bfa', '#2dd4bf', '#fbbf24', '#4ade80', '#f87171',
  '#94a3b8',
];

export const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: false,
  color: '#cbd5e1',        // slate-300
  borderColor: '#334155',  // slate-700
  plugins: {
    legend: {
      labels: {
        color: '#cbd5e1',
        boxWidth: 12,
        padding: 12,
        font: { size: 11 },
      },
    },
    tooltip: {
      backgroundColor: '#0f172a',
      titleColor: '#e2e8f0',
      bodyColor: '#cbd5e1',
      borderColor: '#334155',
      borderWidth: 1,
      padding: 8,
      cornerRadius: 6,
    },
  },
  scales: {
    x: {
      ticks: { color: '#94a3b8', font: { size: 10 } },
      grid: { color: '#1e293b' },
    },
    y: {
      ticks: { color: '#94a3b8', font: { size: 10 } },
      grid: { color: '#1e293b' },
    },
  },
};
