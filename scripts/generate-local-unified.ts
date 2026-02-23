import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

import { parseUsageFile } from '../src/lib/parsers.ts';
import { loadPricingCatalog } from '../src/lib/pricing.ts';
import { parseProfilexState, ProfileResolver, normalizePath } from '../src/lib/profilex.ts';
import type { NormalizedEvent, PricingCatalog, ProfilexState, UnifiedLocalBundle } from '../src/lib/types.ts';

type CliOptions = {
  outPath: string;
  deep: boolean;
  maxFiles: number;
};

function usageAndExit(message?: string): never {
  if (message) console.error(message);
  console.log('Usage: pnpm generate:local [--deep] [--max-files <n>] [--out <path>]');
  process.exit(message ? 1 : 0);
}

function parseArgs(argv: string[]): CliOptions {
  let outPath = path.join(process.cwd(), 'public', 'local-unified-usage.json');
  let deep = false;
  let maxFiles = 5000;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--help' || arg === '-h') usageAndExit();
    if (arg === '--deep') {
      deep = true;
      continue;
    }
    if (arg === '--out') {
      const value = argv[i + 1];
      if (!value) usageAndExit('--out requires a value');
      outPath = path.resolve(process.cwd(), value);
      i += 1;
      continue;
    }
    if (arg === '--max-files') {
      const value = argv[i + 1];
      if (!value) usageAndExit('--max-files requires a value');
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed <= 0) usageAndExit('--max-files must be a positive number');
      maxFiles = Math.floor(parsed);
      i += 1;
      continue;
    }

    usageAndExit(`Unknown argument: ${arg}`);
  }

  return { outPath, deep, maxFiles };
}

function expandHome(input: string): string {
  if (!input) return input;
  if (input === '~') return os.homedir();
  if (!input.startsWith('~')) return input;
  return path.join(os.homedir(), input.slice(2));
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function toPosixAbsolute(p: string): string {
  return normalizePath(path.resolve(expandHome(p)));
}

function isLikelyUsagePath(posixPath: string): boolean {
  const p = posixPath.toLowerCase();
  if (p.includes('/projects/')) return true;
  if (p.includes('/sessions/')) return true;
  if (p.includes('/claude/')) return true;
  if (p.includes('/codex/')) return true;
  return false;
}

const SKIP_DIR_NAMES = new Set([
  '.git',
  '.hg',
  '.svn',
  'node_modules',
  'dist',
  'build',
  '.next',
  '.cache',
  'cache',
  'tmp',
  'temp',
  'library',
  'appdata',
]);

async function collectJsonlFiles(params: {
  root: string;
  onlyLikelyPaths: boolean;
  maxFiles: number;
}): Promise<string[]> {
  const { root, onlyLikelyPaths, maxFiles } = params;
  const out: string[] = [];
  const stack = [root];

  while (stack.length > 0 && out.length < maxFiles) {
    const current = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (out.length >= maxFiles) break;
      const fullPath = path.join(current, entry.name);
      const entryNameLower = entry.name.toLowerCase();

      if (entry.isSymbolicLink()) continue;

      if (entry.isDirectory()) {
        if (SKIP_DIR_NAMES.has(entryNameLower)) continue;
        stack.push(fullPath);
        continue;
      }

      if (!entry.isFile()) continue;
      if (!entryNameLower.endsWith('.jsonl')) continue;

      const posix = toPosixAbsolute(fullPath);
      if (onlyLikelyPaths && !isLikelyUsagePath(posix)) continue;
      out.push(posix);
    }
  }

  return out;
}

async function loadProfilexState(notes: string[]): Promise<{ state: ProfilexState | null; path: string | null }> {
  const home = os.homedir();
  const envProfilexHome = process.env.PROFILEX_HOME ? expandHome(process.env.PROFILEX_HOME) : '';
  const candidates = [
    envProfilexHome ? path.join(envProfilexHome, 'state.json') : '',
    path.join(home, '.profilex', 'state.json'),
    path.join(home, '.config', 'profilex', 'state.json'),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (!(await pathExists(candidate))) continue;
    try {
      const raw = await fs.readFile(candidate, 'utf8');
      const state = parseProfilexState(raw);
      return { state, path: toPosixAbsolute(candidate) };
    } catch (error) {
      notes.push(`Failed to parse state at ${toPosixAbsolute(candidate)}: ${(error as Error).message}`);
    }
  }

  notes.push('ProfileX state.json was not found in common locations');
  return { state: null, path: null };
}

function addIfPresent(set: Set<string>, candidate: string) {
  if (!candidate) return;
  set.add(toPosixAbsolute(candidate));
}

function parsePathList(input?: string): string[] {
  if (!input) return [];
  return input
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((p) => expandHome(p));
}

function ensureLeaf(basePath: string, leaf: 'projects' | 'sessions'): string {
  const normalized = normalizePath(basePath).toLowerCase();
  if (normalized.endsWith(`/${leaf}`)) return basePath;
  return path.join(basePath, leaf);
}

function getUsageRoots(state: ProfilexState | null): string[] {
  const home = os.homedir();
  const out = new Set<string>();

  const claudeEnvPaths = parsePathList(process.env.CLAUDE_CONFIG_DIR);
  const codexEnvPaths = parsePathList(process.env.CODEX_HOME);

  addIfPresent(out, path.join(home, '.config', 'claude', 'projects'));
  addIfPresent(out, path.join(home, '.claude', 'projects'));
  for (const p of claudeEnvPaths) {
    addIfPresent(out, ensureLeaf(p, 'projects'));
  }

  addIfPresent(out, path.join(home, '.codex', 'sessions'));
  for (const p of codexEnvPaths) {
    addIfPresent(out, ensureLeaf(p, 'sessions'));
  }

  if (state) {
    for (const profile of state.profiles) {
      const base = expandHome(profile.dir);
      const leaf = profile.tool === 'claude' ? 'projects' : 'sessions';
      addIfPresent(out, ensureLeaf(base, leaf));
    }
  }

  return [...out];
}

async function existingRoots(candidates: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const candidate of candidates) {
    const absolute = toPosixAbsolute(candidate);
    if (await pathExists(absolute)) out.push(absolute);
  }
  return out;
}

async function loadPricing(notes: string[]): Promise<PricingCatalog | null> {
  try {
    const catalog = await loadPricingCatalog();
    notes.push(`Loaded pricing catalog (${Object.keys(catalog).length} rows)`);
    return catalog;
  } catch (error) {
    notes.push(`Pricing catalog unavailable: ${(error as Error).message}`);
    return null;
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const notes: string[] = [];
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  console.log('Generating unified local dataset...');

  const profilex = await loadProfilexState(notes);
  const roots = await existingRoots(getUsageRoots(profilex.state));
  if (roots.length === 0) {
    notes.push('No usage roots found in default locations');
  }

  let usageFiles = new Set<string>();
  for (const root of roots) {
    const files = await collectJsonlFiles({
      root,
      onlyLikelyPaths: false,
      maxFiles: options.maxFiles - usageFiles.size,
    });
    for (const file of files) usageFiles.add(file);
    if (usageFiles.size >= options.maxFiles) break;
  }

  if (options.deep && usageFiles.size < options.maxFiles) {
    const deepFiles = await collectJsonlFiles({
      root: os.homedir(),
      onlyLikelyPaths: true,
      maxFiles: options.maxFiles - usageFiles.size,
    });
    for (const file of deepFiles) usageFiles.add(file);
    notes.push(`Deep scan added ${deepFiles.length} candidate file(s) from home directory`);
  }

  const usageFileList = [...usageFiles].sort();
  const pricingCatalog = await loadPricing(notes);
  const resolver = new ProfileResolver(profilex.state);
  const events: NormalizedEvent[] = [];

  let parseFailures = 0;
  let zeroEventFiles = 0;

  for (let i = 0; i < usageFileList.length; i++) {
    const usageFile = usageFileList[i];
    try {
      const fileText = await fs.readFile(usageFile, 'utf8');
      const parsedRows = parseUsageFile({
        fileText,
        filePath: usageFile,
        options: {
          timezone,
          costMode: 'auto',
          toolHint: 'auto',
          pricingCatalog,
          profileResolver: resolver,
        },
      });

      if (parsedRows.length === 0) {
        zeroEventFiles += 1;
      } else {
        events.push(...parsedRows);
      }
    } catch (error) {
      parseFailures += 1;
      notes.push(`Failed to parse ${usageFile}: ${(error as Error).message}`);
    }

    if ((i + 1) % 100 === 0) {
      console.log(`Parsed ${i + 1}/${usageFileList.length} usage file(s)...`);
    }
  }

  events.sort((a, b) => a.timestampUtc.localeCompare(b.timestampUtc));

  notes.push(`Files with zero parsed events: ${zeroEventFiles}`);
  notes.push(`Files with read/parse failures: ${parseFailures}`);

  const bundle: UnifiedLocalBundle = {
    schemaVersion: 1,
    generatedAtUtc: new Date().toISOString(),
    timezone,
    costMode: 'auto',
    pricingLoaded: pricingCatalog !== null,
    profilexState: profilex.state,
    events,
    source: {
      profilexStatePath: profilex.path,
      usageRoots: roots,
      usageFiles: usageFileList,
    },
    notes,
  };

  await fs.mkdir(path.dirname(options.outPath), { recursive: true });
  await fs.writeFile(options.outPath, `${JSON.stringify(bundle, null, 2)}\n`, 'utf8');

  console.log(`Wrote ${events.length} event(s) from ${usageFileList.length} file(s)`);
  console.log(`Output: ${toPosixAbsolute(options.outPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
