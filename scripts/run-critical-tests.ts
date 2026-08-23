/**
 * Critical test batch runner — fail-fast, nonzero exit on any failure.
 * Run: npx --yes tsx scripts/run-critical-tests.ts
 * Repeat: npx --yes tsx scripts/run-critical-tests.ts --repeat=20
 * Shuffle: npx --yes tsx scripts/run-critical-tests.ts --shuffle
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

type SuiteStatus = 'PASS' | 'FAIL' | 'SKIP';

interface Suite {
  id: string;
  file: string;
  /** When true, SKIP only if env marker missing (never masks a real failure). */
  requiresDb?: boolean;
}

const SUITES: Suite[] = [
  { id: 'dev-isolation', file: 'scripts/test-dev-isolation.ts' },
  { id: 'capture', file: 'scripts/test-capture-engine.ts' },
  { id: 'sealing-quality', file: 'scripts/test-sealing-quality.ts' },
  { id: 'character-quality-stats', file: 'scripts/test-character-quality-stats.ts' },
  { id: 'hunt-enemy-stat-consistency', file: 'scripts/test-hunt-enemy-stat-consistency.ts' },
  { id: 'xp-progression', file: 'scripts/test-xp-progression.ts' },
  { id: 'game-cycle', file: 'scripts/test-game-cycle.ts' },
  { id: 'daily-login-unify', file: 'scripts/test-daily-login-unify.ts' },
  { id: 'achievement-unify', file: 'scripts/test-achievement-unify.ts' },
  { id: 'inventory-persist', file: 'scripts/test-inventory-persist.ts' },
  { id: 'reward-service', file: 'scripts/test-reward-service.ts' },
  { id: 'equipment-removed', file: 'scripts/test-equipment-removed.ts' },
  { id: 'medic-system', file: 'scripts/test-medic-system.ts' },
  { id: 'team-presets', file: 'scripts/test-team-presets.ts' },
  { id: 'social-backend', file: 'scripts/test-social-backend.ts', requiresDb: true },
  { id: 'world-boss', file: 'scripts/test-world-boss-backend.ts' },
  { id: 'guild-shop', file: 'scripts/test-guild-shop-backend.ts' },
];

function parseArgs(argv: string[]): { repeat: number; shuffle: boolean; only?: string[] } {
  let repeat = 1;
  let shuffle = false;
  let only: string[] | undefined;
  for (const arg of argv) {
    if (arg.startsWith('--repeat=')) {
      repeat = Math.max(1, Number(arg.slice('--repeat='.length)) || 1);
    } else if (arg === '--shuffle') {
      shuffle = true;
    } else if (arg.startsWith('--only=')) {
      only = arg
        .slice('--only='.length)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return { repeat, shuffle, only };
}

function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
}

function isSocialDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL || process.env.SOCIAL_TEST_DB === '1');
}

function runSuite(suite: Suite): SuiteStatus {
  if (suite.requiresDb && !isSocialDbConfigured()) {
    console.log(`SKIP ${suite.id} (DB test not configured — set DATABASE_URL or SOCIAL_TEST_DB=1)`);
    return 'SKIP';
  }

  const result = spawnSync('npx', ['--yes', 'tsx', suite.file], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      // Always non-production so DEV helpers / Lab / clock overrides work.
      NODE_ENV: 'development',
    },
    shell: true,
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  if (result.status === 0) {
    console.log(`PASS ${suite.id}`);
    return 'PASS';
  }

  console.log(`FAIL ${suite.id} (exit ${result.status ?? 'null'})`);
  return 'FAIL';
}

function main(): void {
  const { repeat, shuffle, only } = parseArgs(process.argv.slice(2));
  let suites: Suite[];
  if (only) {
    // Preserve --only order so fail-fast probes can run first.
    suites = only
      .map((id) => SUITES.find((s) => s.id === id))
      .filter((s): s is Suite => Boolean(s));
  } else {
    suites = SUITES.slice();
  }
  if (suites.length === 0) {
    console.error('No suites matched --only');
    process.exitCode = 1;
    return;
  }

  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (let round = 1; round <= repeat; round += 1) {
    if (repeat > 1) console.log(`\n===== round ${round}/${repeat} =====`);
    const order = [...suites];
    if (shuffle) shuffleInPlace(order);

    for (const suite of order) {
      const status = runSuite(suite);
      if (status === 'PASS') passed += 1;
      else if (status === 'FAIL') failed += 1;
      else skipped += 1;
      if (status === 'FAIL') {
        console.log(`\n${passed} passed / ${failed} failed / ${skipped} skipped`);
        process.exitCode = 1;
        return;
      }
    }
  }

  console.log(`\n${passed} passed / ${failed} failed / ${skipped} skipped`);
  process.exitCode = failed > 0 ? 1 : 0;
}

main();
