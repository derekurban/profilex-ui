export type Tool = 'claude' | 'codex' | 'openclaw' | 'unknown';

export type ProfilexProfile = {
  tool: 'claude' | 'codex';
  name: string;
  dir: string;
  created_at?: string;
};

export type ProfilexState = {
  version?: number;
  defaults?: Record<string, string>;
  profiles: ProfilexProfile[];
};

export type PricingRecord = {
  input_cost_per_token?: number;
  output_cost_per_token?: number;
  cache_creation_input_token_cost?: number;
  cache_read_input_token_cost?: number;
  input_cost_per_token_above_200k_tokens?: number;
  output_cost_per_token_above_200k_tokens?: number;
  cache_creation_input_token_cost_above_200k_tokens?: number;
  cache_read_input_token_cost_above_200k_tokens?: number;
  litellm_provider?: string;
};

export type PricingCatalog = Record<string, PricingRecord>;

export type NormalizedEvent = {
  id: string;
  timestampUtc: string;
  dateLocal: string;
  tool: Tool;
  profileId: string;
  profileName: string;
  isProfilexManaged: boolean;
  sourceRoot: string;
  sourceFile: string;
  sessionId: string;
  project: string;
  model: string;
  isFallbackModel: boolean;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningOutputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  rawTotalTokens: number;
  normalizedTotalTokens: number;
  observedCostUSD: number;
  calculatedCostUSD: number;
  effectiveCostUSD: number;
  costModeUsed: 'auto' | 'calculate' | 'display';
  isSharedSession: boolean;
  sharedSessionProfileIds: string[];
  sharedSessionProfileNames: string[];
  sharedSessionSources: string[];
};

export type AggregatedRow = {
  dateLocal: string;
  tool: Tool;
  profileId: string;
  profileName: string;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningOutputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
  observedCostUSD: number;
  calculatedCostUSD: number;
  effectiveCostUSD: number;
  sessionsCount: number;
  modelsUsed: string[];
};

export type ProfileSummary = {
  tool: Tool;
  profileId: string;
  profileName: string;
  firstSeen: string;
  lastSeen: string;
  totalTokens: number;
  totalCost: number;
  avgDailyCost: number;
  topModels: string[];
  sourceRoots: string[];
};

export type ToolSummary = {
  tool: Tool;
  totalTokens: number;
  observedCostUSD: number;
  calculatedCostUSD: number;
  totalCostUSD: number;
  activeProfiles: number;
};

export type UnifiedSourceSummary = {
  profilexStatePath: string | null;
  usageRoots: string[];
  usageFiles: string[];
};

export type UnifiedLocalBundle = {
  schemaVersion: 1;
  generatedAtUtc: string;
  timezone: string;
  costMode: 'auto' | 'calculate' | 'display';
  pricingLoaded: boolean;
  profilexState: ProfilexState | null;
  events: NormalizedEvent[];
  source: UnifiedSourceSummary;
  notes: string[];
};

// --- Chart & Dashboard Types ---

export type TimeBucket = 'daily' | 'weekly' | 'monthly';

export type TimeSeriesPoint = {
  date: string;
  values: Record<string, number>;
};

export type ModelBreakdown = {
  model: string;
  cost: number;
  tokens: number;
  percentage: number;
};

export type TokenTypeBreakdown = {
  date: string;
  input: number;
  output: number;
  cached: number;
  reasoning: number;
  cacheCreation: number;
  cacheRead: number;
};

export type KpiData = {
  totalTokens: number;
  effectiveCost: number;
  eventCount: number;
  sessionCount: number;
  modelCount: number;
  avgDailyCost: number;
  sharedSessionCount: number;
  trends: {
    tokens: number;
    cost: number;
    events: number;
  };
};

export type SortDirection = 'asc' | 'desc';

export type ColumnDef<T = Record<string, unknown>> = {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  format?: (value: unknown, row: T) => string;
  sortable?: boolean;
};

export type SharedSessionFilter = 'all' | 'shared-only' | 'non-shared-only';
