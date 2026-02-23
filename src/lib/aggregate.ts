import type { AggregatedRow, NormalizedEvent, ProfileSummary, ToolSummary } from './types';

function key(parts: Array<string | number>): string {
  return parts.join('||');
}

export function aggregateDailyProfile(events: NormalizedEvent[]): AggregatedRow[] {
  const map = new Map<string, AggregatedRow & { sessions: Set<string>; models: Set<string> }>();

  for (const e of events) {
    const k = key([e.dateLocal, e.tool, e.profileId]);
    if (!map.has(k)) {
      map.set(k, {
        dateLocal: e.dateLocal,
        tool: e.tool,
        profileId: e.profileId,
        profileName: e.profileName,
        inputTokens: 0,
        cachedInputTokens: 0,
        outputTokens: 0,
        reasoningOutputTokens: 0,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
        totalTokens: 0,
        observedCostUSD: 0,
        calculatedCostUSD: 0,
        effectiveCostUSD: 0,
        sessionsCount: 0,
        modelsUsed: [],
        sessions: new Set<string>(),
        models: new Set<string>(),
      });
    }

    const row = map.get(k)!;
    row.inputTokens += e.inputTokens;
    row.cachedInputTokens += e.cachedInputTokens;
    row.outputTokens += e.outputTokens;
    row.reasoningOutputTokens += e.reasoningOutputTokens;
    row.cacheCreationTokens += e.cacheCreationTokens;
    row.cacheReadTokens += e.cacheReadTokens;
    row.totalTokens += e.normalizedTotalTokens;
    row.observedCostUSD += e.observedCostUSD;
    row.calculatedCostUSD += e.calculatedCostUSD;
    row.effectiveCostUSD += e.effectiveCostUSD;
    if (e.sessionId) row.sessions.add(e.sessionId);
    if (e.model) row.models.add(e.model);
  }

  return [...map.values()]
    .map((r) => ({
      ...r,
      sessionsCount: r.sessions.size,
      modelsUsed: [...r.models].sort(),
    }))
    .sort((a, b) => b.dateLocal.localeCompare(a.dateLocal) || a.profileId.localeCompare(b.profileId));
}

export function aggregateProfileSummary(events: NormalizedEvent[]): ProfileSummary[] {
  const map = new Map<
    string,
    {
      tool: ProfileSummary['tool'];
      profileId: string;
      profileName: string;
      firstSeen: string;
      lastSeen: string;
      totalTokens: number;
      totalCost: number;
      days: Set<string>;
      modelCosts: Map<string, number>;
      roots: Set<string>;
    }
  >();

  for (const e of events) {
    const k = key([e.tool, e.profileId]);
    if (!map.has(k)) {
      map.set(k, {
        tool: e.tool,
        profileId: e.profileId,
        profileName: e.profileName,
        firstSeen: e.timestampUtc,
        lastSeen: e.timestampUtc,
        totalTokens: 0,
        totalCost: 0,
        days: new Set<string>(),
        modelCosts: new Map<string, number>(),
        roots: new Set<string>(),
      });
    }

    const row = map.get(k)!;
    if (e.timestampUtc < row.firstSeen) row.firstSeen = e.timestampUtc;
    if (e.timestampUtc > row.lastSeen) row.lastSeen = e.timestampUtc;
    row.totalTokens += e.normalizedTotalTokens;
    row.totalCost += e.effectiveCostUSD;
    row.days.add(e.dateLocal);
    row.roots.add(e.sourceRoot);
    if (e.model) {
      row.modelCosts.set(e.model, (row.modelCosts.get(e.model) ?? 0) + e.effectiveCostUSD);
    }
  }

  return [...map.values()]
    .map((r) => ({
      tool: r.tool,
      profileId: r.profileId,
      profileName: r.profileName,
      firstSeen: r.firstSeen,
      lastSeen: r.lastSeen,
      totalTokens: r.totalTokens,
      totalCost: r.totalCost,
      avgDailyCost: r.totalCost / Math.max(1, r.days.size),
      topModels: [...r.modelCosts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([m]) => m),
      sourceRoots: [...r.roots].sort(),
    }))
    .sort((a, b) => b.totalCost - a.totalCost);
}

export function aggregateToolSummary(events: NormalizedEvent[]): ToolSummary[] {
  const map = new Map<string, ToolSummary & { profiles: Set<string> }>();
  for (const e of events) {
    if (!map.has(e.tool)) {
      map.set(e.tool, {
        tool: e.tool,
        totalTokens: 0,
        observedCostUSD: 0,
        calculatedCostUSD: 0,
        totalCostUSD: 0,
        activeProfiles: 0,
        profiles: new Set<string>(),
      });
    }

    const row = map.get(e.tool)!;
    row.totalTokens += e.normalizedTotalTokens;
    row.observedCostUSD += e.observedCostUSD;
    row.calculatedCostUSD += e.calculatedCostUSD;
    row.totalCostUSD += e.effectiveCostUSD;
    row.profiles.add(e.profileId);
  }

  return [...map.values()].map((r) => ({
    tool: r.tool,
    totalTokens: r.totalTokens,
    observedCostUSD: r.observedCostUSD,
    calculatedCostUSD: r.calculatedCostUSD,
    totalCostUSD: r.totalCostUSD,
    activeProfiles: r.profiles.size,
  }));
}

export function overallTotals(events: NormalizedEvent[]) {
  if (events.length === 0) {
    return {
      totalTokens: 0,
      totalCostUSD: 0,
      observedCostUSD: 0,
      calculatedCostUSD: 0,
      windowStart: '',
      windowEnd: '',
    };
  }

  const sorted = [...events].sort((a, b) => a.timestampUtc.localeCompare(b.timestampUtc));

  return {
    totalTokens: events.reduce((s, e) => s + e.normalizedTotalTokens, 0),
    totalCostUSD: events.reduce((s, e) => s + e.effectiveCostUSD, 0),
    observedCostUSD: events.reduce((s, e) => s + e.observedCostUSD, 0),
    calculatedCostUSD: events.reduce((s, e) => s + e.calculatedCostUSD, 0),
    windowStart: sorted[0]?.timestampUtc ?? '',
    windowEnd: sorted.at(-1)?.timestampUtc ?? '',
  };
}
