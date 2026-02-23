export type Tool = 'claude' | 'codex' | 'unknown';

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
