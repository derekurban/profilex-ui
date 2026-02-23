import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';

type DevArgs = {
  forceReport: boolean;
  skipReport: boolean;
  viteArgs: string[];
};

const REPORT_PATH = path.resolve(process.cwd(), 'public', 'local-unified-usage.json');
const GENERATOR_SCRIPT = path.resolve(process.cwd(), 'scripts', 'generate-local-unified.ts');
const VITE_BIN = path.resolve(process.cwd(), 'node_modules', 'vite', 'bin', 'vite.js');

function parseArgs(argv: string[]): DevArgs {
  let forceReport = false;
  let skipReport = false;
  const viteArgs: string[] = [];

  for (const arg of argv) {
    if (arg === '--force-report' || arg === '--regen-report') {
      forceReport = true;
      continue;
    }
    if (arg === '--skip-report') {
      skipReport = true;
      continue;
    }
    viteArgs.push(arg);
  }

  if (process.env.PROFILEX_FORCE_REPORT === '1') {
    forceReport = true;
  }

  if (process.env.PROFILEX_SKIP_REPORT === '1') {
    skipReport = true;
  }

  return { forceReport, skipReport, viteArgs };
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function runCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Command failed: ${command} ${args.join(' ')} (exit ${code ?? 'unknown'})`));
    });
  });
}

async function ensureLocalReport(options: DevArgs): Promise<void> {
  if (options.skipReport) {
    console.log('Skipping local report generation (`--skip-report` or PROFILEX_SKIP_REPORT=1).');
    return;
  }

  const hasReport = await fileExists(REPORT_PATH);
  if (hasReport && !options.forceReport) {
    console.log(`Using existing local report: ${REPORT_PATH}`);
    console.log('Pass `--force-report` (or PROFILEX_FORCE_REPORT=1) to regenerate.');
    return;
  }

  const reason = hasReport ? 'forcing regeneration' : 'report not found';
  console.log(`Generating local report (${reason})...`);
  await runCommand(process.execPath, ['--import', 'tsx', GENERATOR_SCRIPT, '--deep']);
}

async function startDevServer(viteArgs: string[]): Promise<void> {
  console.log('Starting dev server...');
  await runCommand(process.execPath, [VITE_BIN, ...viteArgs]);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await ensureLocalReport(args);
  await startDevServer(args.viteArgs);
}

main().catch((error) => {
  console.error((error as Error).message);
  process.exit(1);
});
