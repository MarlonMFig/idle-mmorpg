import { getDailyCycleId } from '@/lib/mission-cycle';
import { normalizeLegacyGemLoginDay } from '@/stores/gem-store';
import {
  DEFAULT_DAILY_LOGIN_STATE,
  type DailyLoginDay,
  type DailyLoginState,
} from '@/types/daily-login';

export interface DailyLoginLegacyMigrationInput {
  official: DailyLoginState | null | undefined;
  /** gemStore.lastLoginDay (cycleId SP ou legado). */
  legacyLastLoginDay: string | null | undefined;
  currentCycleId?: string;
}

export interface DailyLoginLegacyMigrationResult {
  state: DailyLoginState;
  /** Havia lastLoginDay no gem e foi consumido. */
  consumedLegacy: boolean;
  /** Legacy marcava o cycle atual como já coletado. */
  legacyClaimedCurrentCycle: boolean;
  /** Official já tinha lastClaim no cycle atual. */
  officialClaimedCurrentCycle: boolean;
}

function clampDay(value: unknown): DailyLoginDay {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : 1;
  const wrapped = ((((n - 1) % 7) + 7) % 7) + 1;
  return wrapped as DailyLoginDay;
}

function normalizeOfficial(raw: DailyLoginState | null | undefined): DailyLoginState {
  if (!raw) return { ...DEFAULT_DAILY_LOGIN_STATE };
  return {
    currentDay: clampDay(raw.currentDay),
    lastClaimCycleId:
      typeof raw.lastClaimCycleId === 'string' && raw.lastClaimCycleId.trim()
        ? raw.lastClaimCycleId
        : null,
    totalClaims:
      typeof raw.totalClaims === 'number' && Number.isFinite(raw.totalClaims)
        ? Math.max(0, Math.floor(raw.totalClaims))
        : 0,
  };
}

/**
 * Item 34 — unifica gem Daily Login → dailyLoginStore.
 *
 * - Official é fonte de currentDay / totalClaims.
 * - Se QUALQUER sistema marcou o cycle atual como coletado → já coletado.
 * - Legacy NÃO inventa sequência nem concede reward.
 * - Idempotente: após consumir legacy (caller zera lastLoginDay), reaplicar não muda estado.
 */
export function mergeDailyLoginWithGemLegacy(
  input: DailyLoginLegacyMigrationInput,
): DailyLoginLegacyMigrationResult {
  const cycle = input.currentCycleId ?? getDailyCycleId();
  const official = normalizeOfficial(input.official);
  const legacy = normalizeLegacyGemLoginDay(input.legacyLastLoginDay);

  const officialClaimedCurrentCycle = official.lastClaimCycleId === cycle;
  const legacyClaimedCurrentCycle = legacy != null && legacy === cycle;
  const consumedLegacy = legacy != null;

  let lastClaimCycleId = official.lastClaimCycleId;

  // Qualquer claim no cycle atual → bloqueia (não avança currentDay).
  if (!officialClaimedCurrentCycle && legacyClaimedCurrentCycle) {
    lastClaimCycleId = cycle;
  }

  // Legacy-only (ou official sem lastClaim): preservar ciclo legado como lastClaim
  // para não liberar claim "fantasma" se ainda for o mesmo dia; em dias novos, available ok.
  if (lastClaimCycleId == null && legacy != null) {
    lastClaimCycleId = legacy;
  }

  return {
    state: {
      currentDay: official.currentDay,
      lastClaimCycleId,
      totalClaims: official.totalClaims,
    },
    consumedLegacy,
    legacyClaimedCurrentCycle,
    officialClaimedCurrentCycle,
  };
}
