import type { NormalizedEvent, SharedSessionFilter, Tool } from './types';

export type FilterState = {
  dateStart: string;
  dateEnd: string;
  tools: Tool[];
  models: string[];
  profiles: string[];
  sharedSessions: SharedSessionFilter;
};

export function createDefaultFilter(): FilterState {
  return {
    dateStart: '',
    dateEnd: '',
    tools: [],
    models: [],
    profiles: [],
    sharedSessions: 'all',
  };
}

export function extractFilterOptions(events: NormalizedEvent[]) {
  const tools = new Set<Tool>();
  const models = new Set<string>();
  const profiles = new Set<string>();
  let minDate = '';
  let maxDate = '';

  for (const e of events) {
    tools.add(e.tool);
    if (e.model) models.add(e.model);
    profiles.add(e.profileId);
    if (!minDate || e.dateLocal < minDate) minDate = e.dateLocal;
    if (!maxDate || e.dateLocal > maxDate) maxDate = e.dateLocal;
  }

  return {
    tools: [...tools].sort(),
    models: [...models].sort(),
    profiles: [...profiles].sort(),
    minDate,
    maxDate,
  };
}

export function applyFilters(events: NormalizedEvent[], filter: FilterState): NormalizedEvent[] {
  return events.filter((e) => {
    if (filter.dateStart && e.dateLocal < filter.dateStart) return false;
    if (filter.dateEnd && e.dateLocal > filter.dateEnd) return false;
    if (filter.tools.length > 0 && !filter.tools.includes(e.tool)) return false;
    if (filter.models.length > 0 && !filter.models.includes(e.model)) return false;
    if (filter.profiles.length > 0 && !filter.profiles.includes(e.profileId)) return false;
    if (filter.sharedSessions === 'shared-only' && !e.isSharedSession) return false;
    if (filter.sharedSessions === 'non-shared-only' && e.isSharedSession) return false;
    return true;
  });
}
