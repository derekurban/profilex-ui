import {
  startOfWeek, endOfWeek, startOfMonth, format, addDays, addWeeks, addMonths, isBefore, parseISO
} from 'date-fns';
import type {
  AggregatedRow, KpiData, ModelBreakdown, NormalizedEvent,
  ProfileSummary, TimeBucket, TimeSeriesPoint, TokenTypeBreakdown, ToolSummary
} from './types';

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

// --- New aggregation functions for dashboard ---

function bucketDate(dateStr: string, bucket: TimeBucket): string {
  const d = parseISO(dateStr);
  switch (bucket) {
    case 'daily':
      return dateStr;
    case 'weekly':
      return format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    case 'monthly':
      return format(startOfMonth(d), 'yyyy-MM');
  }
}

function fillGaps(points: Map<string, Record<string, number>>, bucket: TimeBucket, seriesKeys: string[]): TimeSeriesPoint[] {
  if (points.size === 0) return [];
  const dates = [...points.keys()].sort();
  const start = parseISO(dates[0]);
  const end = parseISO(dates[dates.length - 1]);
  const result: TimeSeriesPoint[] = [];
  let current = start;
  const advanceFn = bucket === 'daily' ? (d: Date) => addDays(d, 1)
    : bucket === 'weekly' ? (d: Date) => addWeeks(d, 1)
    : (d: Date) => addMonths(d, 1);
  const fmtStr = bucket === 'monthly' ? 'yyyy-MM' : 'yyyy-MM-dd';

  while (!isBefore(end, current)) {
    const key = format(current, fmtStr);
    const existing = points.get(key);
    const values: Record<string, number> = {};
    for (const k of seriesKeys) values[k] = existing?.[k] ?? 0;
    result.push({ date: key, values });
    current = advanceFn(current);
  }
  return result;
}

export function aggregateTimeSeries(events: NormalizedEvent[], bucket: TimeBucket): TimeSeriesPoint[] {
  const map = new Map<string, Record<string, number>>();
  const tools = new Set<string>();

  for (const e of events) {
    const bk = bucketDate(e.dateLocal, bucket);
    tools.add(e.tool);
    if (!map.has(bk)) map.set(bk, {});
    const row = map.get(bk)!;
    row[e.tool] = (row[e.tool] ?? 0) + e.effectiveCostUSD;
  }

  return fillGaps(map, bucket, [...tools].sort());
}

export function aggregateTokenTimeSeries(events: NormalizedEvent[], bucket: TimeBucket): TimeSeriesPoint[] {
  const map = new Map<string, Record<string, number>>();
  const tools = new Set<string>();

  for (const e of events) {
    const bk = bucketDate(e.dateLocal, bucket);
    tools.add(e.tool);
    if (!map.has(bk)) map.set(bk, {});
    const row = map.get(bk)!;
    row[e.tool] = (row[e.tool] ?? 0) + e.normalizedTotalTokens;
  }

  return fillGaps(map, bucket, [...tools].sort());
}

export function aggregateByModel(events: NormalizedEvent[]): ModelBreakdown[] {
  const map = new Map<string, { cost: number; tokens: number }>();
  let totalCost = 0;

  for (const e of events) {
    const model = e.model || 'unknown';
    if (!map.has(model)) map.set(model, { cost: 0, tokens: 0 });
    const row = map.get(model)!;
    row.cost += e.effectiveCostUSD;
    row.tokens += e.normalizedTotalTokens;
    totalCost += e.effectiveCostUSD;
  }

  const sorted = [...map.entries()]
    .map(([model, { cost, tokens }]) => ({
      model,
      cost,
      tokens,
      percentage: totalCost > 0 ? cost / totalCost : 0,
    }))
    .sort((a, b) => b.cost - a.cost);

  if (sorted.length <= 10) return sorted;

  const top10 = sorted.slice(0, 10);
  const rest = sorted.slice(10);
  const otherCost = rest.reduce((s, r) => s + r.cost, 0);
  const otherTokens = rest.reduce((s, r) => s + r.tokens, 0);
  top10.push({
    model: 'Other',
    cost: otherCost,
    tokens: otherTokens,
    percentage: totalCost > 0 ? otherCost / totalCost : 0,
  });
  return top10;
}

export function aggregateTokenTypes(events: NormalizedEvent[], bucket: TimeBucket): TokenTypeBreakdown[] {
  const map = new Map<string, TokenTypeBreakdown>();

  for (const e of events) {
    const bk = bucketDate(e.dateLocal, bucket);
    if (!map.has(bk)) {
      map.set(bk, { date: bk, input: 0, output: 0, cached: 0, reasoning: 0, cacheCreation: 0, cacheRead: 0 });
    }
    const row = map.get(bk)!;
    row.input += e.inputTokens;
    row.output += e.outputTokens;
    row.cached += e.cachedInputTokens;
    row.reasoning += e.reasoningOutputTokens;
    row.cacheCreation += e.cacheCreationTokens;
    row.cacheRead += e.cacheReadTokens;
  }

  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function computeKpis(events: NormalizedEvent[]): KpiData {
  if (events.length === 0) {
    return {
      totalTokens: 0, effectiveCost: 0, eventCount: 0,
      sessionCount: 0, modelCount: 0, avgDailyCost: 0,
      sharedSessionCount: 0,
      trends: { tokens: 0, cost: 0, events: 0 },
    };
  }

  const sessions = new Set<string>();
  const models = new Set<string>();
  const days = new Set<string>();
  let totalTokens = 0;
  let effectiveCost = 0;
  let sharedCount = 0;

  for (const e of events) {
    totalTokens += e.normalizedTotalTokens;
    effectiveCost += e.effectiveCostUSD;
    if (e.sessionId) sessions.add(e.sessionId);
    if (e.model) models.add(e.model);
    days.add(e.dateLocal);
    if (e.isSharedSession) sharedCount++;
  }

  const avgDailyCost = days.size > 0 ? effectiveCost / days.size : 0;

  // 7-day trend: compare last 7 days vs previous 7 days
  const sortedDates = [...days].sort();
  const trends = { tokens: 0, cost: 0, events: 0 };

  if (sortedDates.length >= 2) {
    const cutoff = sortedDates.length >= 14
      ? sortedDates[sortedDates.length - 7]
      : sortedDates[Math.floor(sortedDates.length / 2)];

    let recentCost = 0, priorCost = 0;
    let recentTokens = 0, priorTokens = 0;
    let recentEvents = 0, priorEvents = 0;

    for (const e of events) {
      if (e.dateLocal >= cutoff) {
        recentCost += e.effectiveCostUSD;
        recentTokens += e.normalizedTotalTokens;
        recentEvents++;
      } else {
        priorCost += e.effectiveCostUSD;
        priorTokens += e.normalizedTotalTokens;
        priorEvents++;
      }
    }

    if (priorCost > 0) trends.cost = (recentCost - priorCost) / priorCost;
    if (priorTokens > 0) trends.tokens = (recentTokens - priorTokens) / priorTokens;
    if (priorEvents > 0) trends.events = (recentEvents - priorEvents) / priorEvents;
  }

  return {
    totalTokens, effectiveCost, eventCount: events.length,
    sessionCount: sessions.size, modelCount: models.size,
    avgDailyCost, sharedSessionCount: sharedCount, trends,
  };
}
