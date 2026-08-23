/**
 * Shared setup/teardown for critical game-cycle / DEV / daily-login tests.
 * Isolates memory singletons; never touches idle-mmorpg:session-v1.
 */
import {
  resetDangerousDevOverrides,
  resetDevLabSessionState,
  syncDevFlagsWithEnvironment,
} from '../../src/config/devConfig';
import { clearEconomyLedger } from '../../src/lib/economy-ledger';
import { resetDevTime, testTimeProvider } from '../../src/lib/mission-cycle';
import { rewardIdempotency } from '../../src/lib/reward-service';
import { dailyLoginStore } from '../../src/stores/daily-login-store';
import { gemStore } from '../../src/stores/gem-store';
import { inventoryStore } from '../../src/stores/inventory-store';
import { missionsStore } from '../../src/stores/missions-store';

/** Fixed noon-ish UTC → stable civil day in America/Sao_Paulo (2026-08-20). */
export const FIXED_TEST_NOW_MS = Date.UTC(2026, 7, 20, 15, 0, 0);

export function resetCriticalTestState(opts?: { fixedClock?: boolean }): void {
  syncDevFlagsWithEnvironment();
  resetDevLabSessionState();
  resetDangerousDevOverrides();
  resetDevTime();
  rewardIdempotency.clear();
  clearEconomyLedger();
  dailyLoginStore.reset();
  inventoryStore.reset();
  missionsStore.reset();
  gemStore.hydrate({ balance: 0, lastLoginDay: null });

  if (opts?.fixedClock !== false) {
    testTimeProvider.setNow(FIXED_TEST_NOW_MS);
  }
}

export function cleanupCriticalTestState(): void {
  resetDevLabSessionState();
  resetDangerousDevOverrides();
  resetDevTime();
  rewardIdempotency.clear();
}

export function withCriticalTestEnv(fn: () => void, opts?: { fixedClock?: boolean }): void {
  resetCriticalTestState(opts);
  try {
    fn();
  } finally {
    cleanupCriticalTestState();
  }
}
