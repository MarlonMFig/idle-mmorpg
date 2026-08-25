import { hpRatio } from '@/lib/decimal';
import type { Decimal } from '@/lib/decimal';
import type {
  BossAttemptResetType,
  BossAttemptState,
  BossDefinition,
  BossPhase,
} from '@/types/boss';

export function clampHpRatio(hp: number | Decimal, hpMax: number | Decimal): number {
  return hpRatio(hp, hpMax);
}

/** Fase atual: a de maior threshold ainda ≥ HP%. HP atual não é resetado. */
export function resolveBossPhase(hpRatio: number, phases: readonly BossPhase[]): BossPhase | null {
  if (!phases.length) return null;
  const sorted = [...phases].sort((a, b) => b.hpThreshold - a.hpThreshold);
  let current = sorted[0] ?? null;
  for (const phase of sorted) {
    if (hpRatio <= phase.hpThreshold) current = phase;
  }
  return current;
}

export function skillsForPhase(def: BossDefinition, phase: BossPhase | null): readonly string[] {
  if (phase?.skillOverrides && phase.skillOverrides.length > 0) return phase.skillOverrides;
  return def.skills;
}

export function attemptResetCycleId(
  resetType: BossAttemptResetType,
  dailyId: string,
  weeklyId: string,
): string | null {
  if (resetType === 'none') return null;
  if (resetType === 'weekly') return weeklyId;
  return dailyId;
}

export function syncAttemptBucket(
  previous: BossAttemptState | undefined,
  resetType: BossAttemptResetType,
  cycleId: string | null,
): BossAttemptState {
  if (!previous) return { used: 0, resetCycleId: cycleId };
  if (resetType === 'none') return { used: previous.used, resetCycleId: previous.resetCycleId };
  if (cycleId && previous.resetCycleId !== cycleId) return { used: 0, resetCycleId: cycleId };
  return { used: previous.used, resetCycleId: previous.resetCycleId ?? cycleId };
}

export function remainingAttempts(used: number, maxAttempts: number | null): number | null {
  if (maxAttempts == null) return null;
  return Math.max(0, maxAttempts - Math.max(0, used));
}

export function canConsumeAttempt(used: number, maxAttempts: number | null): boolean {
  if (maxAttempts == null) return true;
  return used < maxAttempts;
}

export function consumeAttempt(used: number, maxAttempts: number | null): number {
  if (!canConsumeAttempt(used, maxAttempts)) return used;
  return used + 1;
}

export function makeBossInstanceId(bossId: string, nowMs: number): string {
  return `${bossId}:${nowMs}`;
}

export function makeBossClaimId(bossId: string, instanceId: string): string {
  return `boss-reward:${bossId}:${instanceId}`;
}
