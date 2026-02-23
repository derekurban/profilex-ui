import type { ProfilexProfile, ProfilexState, Tool } from './types';

export function parseProfilexState(raw: string): ProfilexState {
  const parsed = JSON.parse(raw) as ProfilexState;
  if (!parsed || !Array.isArray(parsed.profiles)) {
    throw new Error('Invalid ProfileX state: expected { profiles: [] }');
  }
  return parsed;
}

export function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '');
}

export function inferToolFromPath(filePath: string): Tool {
  const p = filePath.toLowerCase();
  if (p.includes('/projects/')) return 'claude';
  if (p.includes('/sessions/')) return 'codex';
  if (p.includes('token_count') || p.includes('codex')) return 'codex';
  if (p.includes('claude')) return 'claude';
  return 'unknown';
}

export function extractRootFromFile(filePath: string, tool: Tool): string {
  const p = normalizePath(filePath);
  if (tool === 'claude') {
    const idx = p.indexOf('/projects/');
    if (idx >= 0) return p.slice(0, idx);
  }
  if (tool === 'codex') {
    const idx = p.indexOf('/sessions/');
    if (idx >= 0) return p.slice(0, idx);
  }
  return p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : 'uploaded';
}

export type ProfileResolution = {
  profileId: string;
  profileName: string;
  isProfilexManaged: boolean;
};

export class ProfileResolver {
  private readonly state: ProfilexState | null;
  private readonly synthetic = new Map<string, string>();
  private readonly syntheticCounters: Record<string, number> = { claude: 0, codex: 0, unknown: 0 };

  constructor(state: ProfilexState | null) {
    this.state = state;
  }

  private matchProfile(tool: Tool, root: string): ProfilexProfile | null {
    if (!this.state) return null;
    const normalizedRoot = normalizePath(root).toLowerCase();

    for (const profile of this.state.profiles) {
      if (profile.tool !== tool) continue;
      const dir = normalizePath(profile.dir).toLowerCase();
      if (!dir) continue;
      if (normalizedRoot.includes(dir) || dir.includes(normalizedRoot)) return profile;

      const marker = `/profiles/${profile.tool}/${profile.name}`.toLowerCase();
      if (normalizedRoot.includes(marker)) return profile;
    }
    return null;
  }

  resolve(tool: Tool, root: string): ProfileResolution {
    const matched = this.matchProfile(tool, root);
    if (matched) {
      return {
        profileId: `${matched.tool}/${matched.name}`,
        profileName: matched.name,
        isProfilexManaged: true,
      };
    }

    const key = `${tool}:${normalizePath(root).toLowerCase()}`;
    const existing = this.synthetic.get(key);
    if (existing) {
      return {
        profileId: `${tool}/${existing}`,
        profileName: existing,
        isProfilexManaged: false,
      };
    }

    const bucket = tool === 'claude' || tool === 'codex' ? tool : 'unknown';
    this.syntheticCounters[bucket] += 1;
    const name = `default-${this.syntheticCounters[bucket]}`;
    this.synthetic.set(key, name);

    return {
      profileId: `${tool}/${name}`,
      profileName: name,
      isProfilexManaged: false,
    };
  }
}
