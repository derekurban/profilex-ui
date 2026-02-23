import type { NormalizedEvent, PricingCatalog, Tool } from './types';
import {
  extractRootFromFile,
  inferToolFromPath,
  ProfileResolver,
} from './profilex';
import { calculateCostFromTokens, resolvePricing } from './pricing';

type ParseOptions = {
  timezone: string;
  costMode: 'auto' | 'calculate' | 'display';
  toolHint: Tool | 'auto';
  pricingCatalog: PricingCatalog | null;
  profileResolver: ProfileResolver;
};

type JsonLike = Record<string, unknown>;

function toNumber(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function toDateLabel(ts: string, timezone: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.valueOf())) return ts.slice(0, 10);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function safeParse(line: string): JsonLike | null {
  try {
    const parsed = JSON.parse(line.replace(/^\uFEFF/, ''));
    return parsed && typeof parsed === 'object' ? (parsed as JsonLike) : null;
  } catch {
    return null;
  }
}

function detectLineTool(obj: JsonLike): Tool {
  const type = String(obj.type ?? '');
  const payload = (obj.payload ?? {}) as JsonLike;
  if (type === 'session_meta' || type === 'turn_context' || type === 'response_item') return 'codex';
  if (type === 'event_msg') {
    const payloadType = String(payload.type ?? '');
    if (
      payloadType === 'token_count' ||
      payloadType === 'user_message' ||
      payloadType === 'agent_message' ||
      payloadType === 'agent_reasoning'
    ) {
      return 'codex';
    }
  }
  const info = (payload.info ?? {}) as JsonLike;
  if (info.total_token_usage || info.last_token_usage) return 'codex';
  if (obj.message && typeof obj.message === 'object') return 'claude';
  if (obj.requestId || obj.costUSD || obj.sessionId) return 'claude';
  return 'unknown';
}

function detectToolFromLines(lines: string[]): Tool {
  const maxLinesToScan = Math.min(lines.length, 50);
  for (let i = 0; i < maxLinesToScan; i++) {
    const obj = safeParse(lines[i]);
    if (!obj) continue;
    const detected = detectLineTool(obj);
    if (detected !== 'unknown') return detected;
  }
  return 'unknown';
}

function getProjectFromCwd(cwd: unknown): string {
  if (typeof cwd !== 'string') return '';
  const normalized = cwd.replace(/\\/g, '/').replace(/\/$/, '');
  const idx = normalized.lastIndexOf('/');
  return idx >= 0 ? normalized.slice(idx + 1) : normalized;
}

function dedupeKeyForClaude(obj: JsonLike): string | null {
  const message = (obj.message ?? {}) as JsonLike;
  const messageId = message.id;
  const requestId = obj.requestId;
  if (typeof messageId === 'string' && typeof requestId === 'string') {
    return `${messageId}:${requestId}`;
  }
  return null;
}

function normalizeClaudeLine(params: {
  obj: JsonLike;
  sourceFile: string;
  sourceRoot: string;
  options: ParseOptions;
  seen: Set<string>;
  index: number;
}): NormalizedEvent | null {
  const { obj, sourceFile, sourceRoot, options, seen, index } = params;
  const message = (obj.message ?? {}) as JsonLike;
  const usage = (message.usage ?? {}) as JsonLike;

  const dedupe = dedupeKeyForClaude(obj);
  if (dedupe && seen.has(dedupe)) return null;
  if (dedupe) seen.add(dedupe);

  const timestamp =
    (typeof obj.timestamp === 'string' && obj.timestamp) ||
    (typeof message.timestamp === 'string' && message.timestamp) ||
    new Date().toISOString();

  const inputTokens = toNumber(usage.input_tokens);
  const outputTokens = toNumber(usage.output_tokens);
  const cacheCreationTokens = toNumber(usage.cache_creation_input_tokens);
  const cacheReadTokens = toNumber(usage.cache_read_input_tokens);
  const totalTokens = inputTokens + outputTokens + cacheCreationTokens + cacheReadTokens;

  if (totalTokens <= 0 && !obj.costUSD) return null;

  const model = typeof message.model === 'string' ? message.model : '';
  const pricing = resolvePricing(options.pricingCatalog, model, 'claude');
  const calculatedCostUSD = calculateCostFromTokens({
    tool: 'claude',
    pricing,
    inputTokens,
    cachedInputTokens: 0,
    outputTokens,
    cacheCreationTokens,
    cacheReadTokens,
  });

  const observedCostUSD = toNumber(obj.costUSD);
  const costMode = options.costMode;
  const effectiveCostUSD =
    costMode === 'display'
      ? observedCostUSD
      : costMode === 'calculate'
      ? calculatedCostUSD
      : observedCostUSD > 0
      ? observedCostUSD
      : calculatedCostUSD;

  const profile = options.profileResolver.resolve('claude', sourceRoot);

  return {
    id: `claude-${index}-${Math.random().toString(36).slice(2, 8)}`,
    timestampUtc: timestamp,
    dateLocal: toDateLabel(timestamp, options.timezone),
    tool: 'claude',
    profileId: profile.profileId,
    profileName: profile.profileName,
    isProfilexManaged: profile.isProfilexManaged,
    sourceRoot,
    sourceFile,
    sessionId: typeof obj.sessionId === 'string' ? obj.sessionId : '',
    project: getProjectFromCwd(obj.cwd),
    model,
    isFallbackModel: false,
    inputTokens,
    cachedInputTokens: 0,
    outputTokens,
    reasoningOutputTokens: 0,
    cacheCreationTokens,
    cacheReadTokens,
    rawTotalTokens: totalTokens,
    normalizedTotalTokens: totalTokens,
    observedCostUSD,
    calculatedCostUSD,
    effectiveCostUSD,
    costModeUsed: options.costMode,
  };
}

type Totals = {
  input_tokens: number;
  cached_input_tokens: number;
  output_tokens: number;
  reasoning_output_tokens: number;
  total_tokens: number;
};

function extractUsage(obj: unknown): Totals | null {
  if (!obj || typeof obj !== 'object') return null;
  const rec = obj as JsonLike;
  const input = toNumber(rec.input_tokens);
  const cached = toNumber(rec.cached_input_tokens ?? rec.cache_read_input_tokens);
  const output = toNumber(rec.output_tokens);
  const reasoning = toNumber(rec.reasoning_output_tokens);
  const total = toNumber(rec.total_tokens) || input + output;
  if (input === 0 && cached === 0 && output === 0 && total === 0) return null;
  return {
    input_tokens: input,
    cached_input_tokens: cached,
    output_tokens: output,
    reasoning_output_tokens: reasoning,
    total_tokens: total,
  };
}

function minus(a: Totals, b: Totals | null): Totals {
  return {
    input_tokens: Math.max(a.input_tokens - (b?.input_tokens ?? 0), 0),
    cached_input_tokens: Math.max(a.cached_input_tokens - (b?.cached_input_tokens ?? 0), 0),
    output_tokens: Math.max(a.output_tokens - (b?.output_tokens ?? 0), 0),
    reasoning_output_tokens: Math.max(
      a.reasoning_output_tokens - (b?.reasoning_output_tokens ?? 0),
      0,
    ),
    total_tokens: Math.max(a.total_tokens - (b?.total_tokens ?? 0), 0),
  };
}

function extractCodexModel(payload: JsonLike, currentModel: string | null): { model: string; fallback: boolean } {
  const directModel = payload.model;
  if (typeof directModel === 'string' && directModel) return { model: directModel, fallback: false };

  const info = (payload.info ?? {}) as JsonLike;
  const metadata = (info.metadata ?? {}) as JsonLike;
  if (typeof metadata.model === 'string' && metadata.model) return { model: metadata.model, fallback: false };

  if (currentModel) return { model: currentModel, fallback: false };
  return { model: 'gpt-5', fallback: true };
}

function normalizeCodexFile(params: {
  lines: string[];
  sourceFile: string;
  sourceRoot: string;
  options: ParseOptions;
}): NormalizedEvent[] {
  const { lines, sourceFile, sourceRoot, options } = params;
  const out: NormalizedEvent[] = [];

  let previousTotals: Totals | null = null;
  let currentModel: string | null = null;
  const sessionId = sourceFile.replace(/\.jsonl$/i, '').split('/').pop() ?? '';
  const profile = options.profileResolver.resolve('codex', sourceRoot);

  for (let i = 0; i < lines.length; i++) {
    const obj = safeParse(lines[i]);
    if (!obj) continue;

    const type = String(obj.type ?? '');
    const payload = ((obj.payload ?? {}) as JsonLike) || {};

    if (type === 'turn_context') {
      if (typeof payload.model === 'string' && payload.model) currentModel = payload.model;
      continue;
    }

    if (type !== 'event_msg' || String(payload.type ?? '') !== 'token_count') continue;

    const info = (payload.info ?? {}) as JsonLike;
    const last = extractUsage(info.last_token_usage);
    const total = extractUsage(info.total_token_usage);

    const usage = last ?? (total ? minus(total, previousTotals) : null);
    if (!usage) continue;
    if (total) previousTotals = total;

    if (
      usage.input_tokens === 0 &&
      usage.cached_input_tokens === 0 &&
      usage.output_tokens === 0 &&
      usage.reasoning_output_tokens === 0
    ) {
      continue;
    }

    const timestamp =
      (typeof obj.timestamp === 'string' && obj.timestamp) || new Date().toISOString();

    const modelInfo = extractCodexModel(payload, currentModel);
    currentModel = modelInfo.model;

    const inputTokens = usage.input_tokens;
    const cachedInputTokens = Math.min(usage.cached_input_tokens, usage.input_tokens);
    const outputTokens = usage.output_tokens;
    const reasoningOutputTokens = usage.reasoning_output_tokens;
    const totalTokens = usage.total_tokens > 0 ? usage.total_tokens : inputTokens + outputTokens;

    const pricing = resolvePricing(options.pricingCatalog, modelInfo.model, 'codex');
    const calculatedCostUSD = calculateCostFromTokens({
      tool: 'codex',
      pricing,
      inputTokens,
      cachedInputTokens,
      outputTokens,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
    });

    out.push({
      id: `codex-${i}-${Math.random().toString(36).slice(2, 8)}`,
      timestampUtc: timestamp,
      dateLocal: toDateLabel(timestamp, options.timezone),
      tool: 'codex',
      profileId: profile.profileId,
      profileName: profile.profileName,
      isProfilexManaged: profile.isProfilexManaged,
      sourceRoot,
      sourceFile,
      sessionId,
      project: '',
      model: modelInfo.model,
      isFallbackModel: modelInfo.fallback,
      inputTokens,
      cachedInputTokens,
      outputTokens,
      reasoningOutputTokens,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
      rawTotalTokens: usage.total_tokens,
      normalizedTotalTokens: totalTokens,
      observedCostUSD: 0,
      calculatedCostUSD,
      effectiveCostUSD:
        options.costMode === 'display'
          ? 0
          : options.costMode === 'calculate'
          ? calculatedCostUSD
          : calculatedCostUSD,
      costModeUsed: options.costMode,
    });
  }

  return out;
}

export function parseUsageFile(params: {
  fileText: string;
  filePath: string;
  options: ParseOptions;
}): NormalizedEvent[] {
  const { fileText, filePath, options } = params;
  const lines = fileText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  const inferredFromPath = inferToolFromPath(filePath);
  const inferredFromLine = detectToolFromLines(lines);
  const tool = options.toolHint !== 'auto' ? options.toolHint : inferredFromLine !== 'unknown' ? inferredFromLine : inferredFromPath;

  const root = extractRootFromFile(filePath, tool);

  if (tool === 'codex') {
    return normalizeCodexFile({ lines, sourceFile: filePath, sourceRoot: root, options });
  }

  const out: NormalizedEvent[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < lines.length; i++) {
    const obj = safeParse(lines[i]);
    if (!obj) continue;
    const row = normalizeClaudeLine({
      obj,
      sourceFile: filePath,
      sourceRoot: root,
      options,
      seen,
      index: i,
    });
    if (row) out.push(row);
  }
  return out;
}
