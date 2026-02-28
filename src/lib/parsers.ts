import type { NormalizedEvent, PricingCatalog, Tool } from './types';
import { extractRootFromFile, inferToolFromPath, ProfileResolver } from './profilex';
import { calculateCostFromTokens, resolvePricing } from './pricing';

type ParseOptions = {
  timezone: string;
  costMode: 'auto' | 'calculate' | 'display';
  toolHint: Tool | 'auto';
  pricingCatalog: PricingCatalog | null;
  profileResolver: ProfileResolver;
};

type JsonLike = Record<string, unknown>;

type ParsedEntry = {
  obj: JsonLike;
  lineIndex: number;
};

function toNumber(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v.replaceAll(',', '').trim());
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

function toRecord(value: unknown): JsonLike | null {
  if (!value) return null;
  if (typeof value === 'object' && !Array.isArray(value)) return value as JsonLike;
  if (typeof value === 'string') {
    const raw = value.trim();
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw.replace(/^\uFEFF/, ''));
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as JsonLike;
    } catch {
      return null;
    }
  }
  return null;
}

function parseLineObjects(line: string): JsonLike[] {
  const raw = line.trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw.replace(/^\uFEFF/, ''));
    if (Array.isArray(parsed)) {
      return parsed.filter((v) => v && typeof v === 'object' && !Array.isArray(v)) as JsonLike[];
    }
    if (parsed && typeof parsed === 'object') return [parsed as JsonLike];
  } catch {
    // ignore malformed line
  }
  return [];
}

function getProjectFromCwd(cwd: unknown): string {
  if (typeof cwd !== 'string') return '';
  const normalized = cwd.replace(/\\/g, '/').replace(/\/$/, '');
  const idx = normalized.lastIndexOf('/');
  return idx >= 0 ? normalized.slice(idx + 1) : normalized;
}

function getStringByPath(obj: JsonLike | null, paths: string[][]): string {
  if (!obj) return '';
  for (const segments of paths) {
    let cur: unknown = obj;
    for (const seg of segments) {
      if (!cur || typeof cur !== 'object' || Array.isArray(cur)) {
        cur = null;
        break;
      }
      cur = (cur as JsonLike)[seg];
    }
    if (typeof cur === 'string' && cur.trim()) return cur.trim();
  }
  return '';
}

function getNumberByPath(obj: JsonLike | null, paths: string[][]): number {
  if (!obj) return 0;
  for (const segments of paths) {
    let cur: unknown = obj;
    for (const seg of segments) {
      if (!cur || typeof cur !== 'object' || Array.isArray(cur)) {
        cur = null;
        break;
      }
      cur = (cur as JsonLike)[seg];
    }
    const n = toNumber(cur);
    if (n !== 0) return n;
    if (cur != null && (typeof cur === 'string' || typeof cur === 'number')) return n;
  }
  return 0;
}

function detectLineTool(obj: JsonLike): Tool {
  const type = String(obj.type ?? '').toLowerCase();
  const payload = toRecord(obj.payload) ?? {};
  const payloadType = String(payload.type ?? '').toLowerCase();
  const info = toRecord(payload.info);

  if (type === 'session_meta' || type === 'turn_context' || type === 'response_item') return 'codex';
  if (type === 'event_msg') {
    if (
      payloadType === 'token_count' ||
      payloadType === 'user_message' ||
      payloadType === 'agent_message' ||
      payloadType === 'agent_reasoning'
    ) {
      return 'codex';
    }
  }

  if (info && (info.total_token_usage != null || info.last_token_usage != null)) return 'codex';

  const message = toRecord(obj.message);
  if (message) {
    const usage = toRecord(message.usage);
    if (usage) return 'claude';
  }

  if (obj.requestId != null || obj.costUSD != null || obj.sessionId != null) return 'claude';
  return 'unknown';
}

function detectToolFromEntries(entries: ParsedEntry[]): Tool {
  let codex = 0;
  let claude = 0;
  const max = Math.min(entries.length, 300);

  for (let i = 0; i < max; i++) {
    const t = detectLineTool(entries[i].obj);
    if (t === 'codex') codex += 1;
    if (t === 'claude') claude += 1;
  }

  if (codex === 0 && claude === 0) return 'unknown';
  return codex >= claude ? 'codex' : 'claude';
}

function flattenJsonl(fileText: string): ParsedEntry[] {
  const lines = fileText.split(/\r?\n/);
  const out: ParsedEntry[] = [];
  for (let i = 0; i < lines.length; i++) {
    const objects = parseLineObjects(lines[i]);
    for (const obj of objects) {
      out.push({ obj, lineIndex: i });
    }
  }
  return out;
}

function dedupeKeyForClaude(obj: JsonLike): string {
  const message = toRecord(obj.message);
  const messageId = getStringByPath(message, [['id']]);
  const requestId = getStringByPath(obj, [['requestId'], ['request_id']]);
  if (messageId && requestId) return `mid:${messageId}:rid:${requestId}`;
  if (requestId) return `rid:${requestId}`;
  return '';
}

function normalizeClaudeLine(params: {
  entry: ParsedEntry;
  sourceFile: string;
  sourceRoot: string;
  options: ParseOptions;
  seen: Set<string>;
}): NormalizedEvent | null {
  const { entry, sourceFile, sourceRoot, options, seen } = params;
  const obj = entry.obj;
  const message = toRecord(obj.message);

  const usage =
    toRecord(message?.usage) ??
    toRecord(obj.usage) ??
    toRecord((toRecord(obj.result) ?? {})['usage']) ??
    toRecord((toRecord(obj.response) ?? {})['usage']);

  if (!usage) return null;

  const dedupe = dedupeKeyForClaude(obj);
  if (dedupe) {
    if (seen.has(dedupe)) return null;
    seen.add(dedupe);
  }

  const timestamp =
    getStringByPath(obj, [
      ['timestamp'],
      ['created_at'],
      ['createdAt'],
      ['time'],
      ['datetime'],
    ]) ||
    getStringByPath(message, [['timestamp'], ['created_at'], ['createdAt']]) ||
    new Date().toISOString();

  const inputTokens = getNumberByPath(usage, [
    ['input_tokens'],
    ['inputTokens'],
  ]);
  const outputTokens = getNumberByPath(usage, [
    ['output_tokens'],
    ['outputTokens'],
  ]);
  const cacheCreationTokens = getNumberByPath(usage, [
    ['cache_creation_input_tokens'],
    ['cacheCreationInputTokens'],
    ['cache_creation_tokens'],
  ]);
  const cacheReadTokens = getNumberByPath(usage, [
    ['cache_read_input_tokens'],
    ['cacheReadInputTokens'],
    ['cache_read_tokens'],
  ]);

  const totalTokens = inputTokens + outputTokens + cacheCreationTokens + cacheReadTokens;
  const observedCostUSD = getNumberByPath(obj, [['costUSD'], ['cost_usd'], ['cost']]);
  if (totalTokens <= 0 && observedCostUSD <= 0) return null;

  const model =
    getStringByPath(message, [['model'], ['model_name']]) ||
    getStringByPath(obj, [['model'], ['model_name'], ['modelName']]);

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

  const effectiveCostUSD =
    options.costMode === 'display'
      ? observedCostUSD
      : options.costMode === 'calculate'
      ? calculatedCostUSD
      : observedCostUSD > 0
      ? observedCostUSD
      : calculatedCostUSD;

  const profile = options.profileResolver.resolve('claude', sourceRoot);

  return {
    id: `claude-${entry.lineIndex}-${Math.random().toString(36).slice(2, 8)}`,
    timestampUtc: timestamp,
    dateLocal: toDateLabel(timestamp, options.timezone),
    tool: 'claude',
    profileId: profile.profileId,
    profileName: profile.profileName,
    isProfilexManaged: profile.isProfilexManaged,
    sourceRoot,
    sourceFile,
    sessionId:
      getStringByPath(obj, [['sessionId'], ['session_id']]) ||
      sourceFile.replace(/\.jsonl$/i, '').split('/').pop() ||
      '',
    project:
      getProjectFromCwd(obj.cwd) ||
      sourceFile.split('/').slice(-2, -1)[0] ||
      '',
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
    isSharedSession: false,
    sharedSessionProfileIds: [],
    sharedSessionProfileNames: [],
    sharedSessionSources: [],
  };
}

type Totals = {
  input_tokens: number;
  cached_input_tokens: number;
  output_tokens: number;
  reasoning_output_tokens: number;
  total_tokens: number;
};

function extractUsage(value: unknown): Totals | null {
  const rec = toRecord(value);
  if (!rec) return null;

  const input = getNumberByPath(rec, [['input_tokens'], ['inputTokens']]);
  const cached = getNumberByPath(rec, [
    ['cached_input_tokens'],
    ['cache_read_input_tokens'],
    ['cachedInputTokens'],
  ]);
  const output = getNumberByPath(rec, [['output_tokens'], ['outputTokens']]);
  const reasoning = getNumberByPath(rec, [['reasoning_output_tokens'], ['reasoningOutputTokens']]);
  const total = getNumberByPath(rec, [['total_tokens'], ['totalTokens']]) || input + output;

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
    reasoning_output_tokens: Math.max(a.reasoning_output_tokens - (b?.reasoning_output_tokens ?? 0), 0),
    total_tokens: Math.max(a.total_tokens - (b?.total_tokens ?? 0), 0),
  };
}

function extractCodexModelFromAny(value: unknown): string {
  const rec = toRecord(value);
  if (!rec) return '';

  const direct = getStringByPath(rec, [['model'], ['model_name']]);
  if (direct) return direct;

  const info = toRecord(rec.info);
  if (info) {
    const fromInfo = getStringByPath(info, [['model'], ['model_name']]);
    if (fromInfo) return fromInfo;

    const infoMeta = toRecord(info.metadata);
    if (infoMeta) {
      const fromInfoMeta =
        getStringByPath(infoMeta, [['model']]) ||
        getStringByPath(toRecord(infoMeta.output), [['model']]);
      if (fromInfoMeta) return fromInfoMeta;
    }
  }

  const meta = toRecord(rec.metadata);
  if (meta) {
    const fromMeta = getStringByPath(meta, [['model']]) || getStringByPath(toRecord(meta.output), [['model']]);
    if (fromMeta) return fromMeta;
  }

  const item = toRecord(rec.item);
  if (item) {
    const fromItem = getStringByPath(item, [['model'], ['model_name']]);
    if (fromItem) return fromItem;
    const itemMeta = toRecord(item.metadata);
    if (itemMeta) {
      const fromItemMeta = getStringByPath(itemMeta, [['model']]) || getStringByPath(toRecord(itemMeta.output), [['model']]);
      if (fromItemMeta) return fromItemMeta;
    }
  }

  return '';
}

function normalizeCodexEntries(params: {
  entries: ParsedEntry[];
  sourceFile: string;
  sourceRoot: string;
  options: ParseOptions;
}): NormalizedEvent[] {
  const { entries, sourceFile, sourceRoot, options } = params;
  const out: NormalizedEvent[] = [];
  const profile = options.profileResolver.resolve('codex', sourceRoot);

  let previousTotals: Totals | null = null;
  let currentModel = '';
  let currentModelIsFallback = false;

  const inferredSession = sourceFile.replace(/\.jsonl$/i, '').split('/').pop() || '';

  for (const entry of entries) {
    const obj = entry.obj;
    const type = String(obj.type ?? '').toLowerCase();
    const payload = toRecord(obj.payload) ?? {};

    if (type === 'turn_context' || type === 'session_meta' || type === 'response_item') {
      const modelFromContext = extractCodexModelFromAny(payload) || extractCodexModelFromAny(obj);
      if (modelFromContext) {
        currentModel = modelFromContext;
        currentModelIsFallback = false;
      }
      continue;
    }

    if (type !== 'event_msg') continue;

    const payloadType = String(payload.type ?? '').toLowerCase();
    if (payloadType !== 'token_count') continue;

    const info = toRecord(payload.info) ?? {};

    const lastUsage = extractUsage(info.last_token_usage ?? payload.last_token_usage);
    const totalUsage = extractUsage(info.total_token_usage ?? payload.total_token_usage);

    const usage = lastUsage ?? (totalUsage ? minus(totalUsage, previousTotals) : null);
    if (!usage) continue;
    if (totalUsage) previousTotals = totalUsage;

    if (
      usage.input_tokens === 0 &&
      usage.cached_input_tokens === 0 &&
      usage.output_tokens === 0 &&
      usage.reasoning_output_tokens === 0
    ) {
      continue;
    }

    let model =
      extractCodexModelFromAny({ ...payload, info }) ||
      extractCodexModelFromAny(info) ||
      currentModel;

    let fallback = false;
    if (!model) {
      model = 'gpt-5';
      fallback = true;
      currentModelIsFallback = true;
    } else if (!extractCodexModelFromAny({ ...payload, info }) && currentModelIsFallback) {
      fallback = true;
    } else {
      currentModelIsFallback = false;
    }
    currentModel = model;

    const timestamp =
      getStringByPath(obj, [['timestamp'], ['created_at'], ['createdAt']]) ||
      getStringByPath(payload, [['timestamp']]) ||
      new Date().toISOString();

    const inputTokens = usage.input_tokens;
    const cachedInputTokens = Math.min(usage.cached_input_tokens, usage.input_tokens);
    const outputTokens = usage.output_tokens;
    const reasoningOutputTokens = usage.reasoning_output_tokens;
    const totalTokens = usage.total_tokens > 0 ? usage.total_tokens : inputTokens + outputTokens;

    const pricing = resolvePricing(options.pricingCatalog, model, 'codex');
    const calculatedCostUSD = calculateCostFromTokens({
      tool: 'codex',
      pricing,
      inputTokens,
      cachedInputTokens,
      outputTokens,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
    });

    const effectiveCostUSD =
      options.costMode === 'display'
        ? 0
        : options.costMode === 'calculate'
        ? calculatedCostUSD
        : calculatedCostUSD;

    out.push({
      id: `codex-${entry.lineIndex}-${Math.random().toString(36).slice(2, 8)}`,
      timestampUtc: timestamp,
      dateLocal: toDateLabel(timestamp, options.timezone),
      tool: 'codex',
      profileId: profile.profileId,
      profileName: profile.profileName,
      isProfilexManaged: profile.isProfilexManaged,
      sourceRoot,
      sourceFile,
      sessionId:
        getStringByPath(obj, [['session_id'], ['sessionId']]) ||
        getStringByPath(payload, [['session_id'], ['sessionId']]) ||
        inferredSession,
      project: sourceFile.split('/').slice(-3, -2)[0] || '',
      model,
      isFallbackModel: fallback,
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
      effectiveCostUSD,
      costModeUsed: options.costMode,
      isSharedSession: false,
      sharedSessionProfileIds: [],
      sharedSessionProfileNames: [],
      sharedSessionSources: [],
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
  const entries = flattenJsonl(fileText);
  if (entries.length === 0) return [];

  const inferredFromPath = inferToolFromPath(filePath);
  const inferredFromLine = detectToolFromEntries(entries);
  const tool =
    options.toolHint !== 'auto'
      ? options.toolHint
      : inferredFromLine !== 'unknown'
      ? inferredFromLine
      : inferredFromPath;

  const sourceRoot = extractRootFromFile(filePath, tool);

  if (tool === 'codex') {
    return normalizeCodexEntries({ entries, sourceFile: filePath, sourceRoot, options });
  }

  const seen = new Set<string>();
  const rows: NormalizedEvent[] = [];
  for (const entry of entries) {
    const row = normalizeClaudeLine({
      entry,
      sourceFile: filePath,
      sourceRoot,
      options,
      seen,
    });
    if (row) rows.push(row);
  }
  return rows;
}
