import type { PricingCatalog, PricingRecord, Tool } from './types';

export const LITELLM_PRICING_URL =
  'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json';

const CLAUDE_PREFIXES = ['anthropic/', 'claude-3-5-', 'claude-3-', 'claude-', 'openrouter/anthropic/'];
const CODEX_PREFIXES = ['openai/', 'azure/', 'openrouter/openai/'];
const CODEX_ALIASES = new Map<string, string>([['gpt-5-codex', 'gpt-5']]);

function asNumber(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

export async function loadPricingCatalog(): Promise<PricingCatalog> {
  const response = await fetch(LITELLM_PRICING_URL, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to fetch pricing (${response.status})`);
  }
  const json = (await response.json()) as PricingCatalog;
  return json;
}

function candidates(model: string, tool: Tool): string[] {
  const base = model.trim();
  const out = new Set<string>();
  if (base) out.add(base);

  if (tool === 'codex' && CODEX_ALIASES.has(base)) {
    out.add(CODEX_ALIASES.get(base)!);
  }

  const prefixes = tool === 'claude' ? CLAUDE_PREFIXES : tool === 'codex' ? CODEX_PREFIXES : [];
  for (const p of prefixes) {
    out.add(`${p}${base}`);
    if (tool === 'codex' && CODEX_ALIASES.has(base)) {
      out.add(`${p}${CODEX_ALIASES.get(base)!}`);
    }
  }

  return [...out];
}

export function resolvePricing(catalog: PricingCatalog | null, model: string, tool: Tool): PricingRecord | null {
  if (!catalog || !model) return null;
  for (const key of candidates(model, tool)) {
    const rec = catalog[key];
    if (rec) return rec;
  }
  return null;
}

export function calculateCostFromTokens(params: {
  tool: Tool;
  pricing: PricingRecord | null;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
}): number {
  const {
    tool,
    pricing,
    inputTokens,
    cachedInputTokens,
    outputTokens,
    cacheCreationTokens,
    cacheReadTokens,
  } = params;

  if (!pricing) return 0;

  const inputRate = asNumber(pricing.input_cost_per_token);
  const outputRate = asNumber(pricing.output_cost_per_token);
  const cacheCreateRate =
    asNumber(pricing.cache_creation_input_token_cost) || inputRate;
  const cacheReadRate = asNumber(pricing.cache_read_input_token_cost) || inputRate;

  if (tool === 'codex') {
    const cached = Math.min(Math.max(cachedInputTokens, 0), Math.max(inputTokens, 0));
    const nonCached = Math.max(inputTokens - cached, 0);
    return nonCached * inputRate + cached * cacheReadRate + Math.max(outputTokens, 0) * outputRate;
  }

  return (
    Math.max(inputTokens, 0) * inputRate +
    Math.max(outputTokens, 0) * outputRate +
    Math.max(cacheCreationTokens, 0) * cacheCreateRate +
    Math.max(cacheReadTokens, 0) * cacheReadRate
  );
}
