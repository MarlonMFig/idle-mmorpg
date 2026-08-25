import {
  estimateHuntKillsPerMinute,
  huntEnemyHpForLevel,
  huntEnemyXpForLevel,
  legacyHuntEnemyXp,
} from '@/lib/hunt-enemy-xp';
import { decimalToUnsafeNumber, d } from '@/lib/decimal';
import { computeHuntKillXp } from '@/lib/hunt-kill-xp';
import { addExperience, getTotalXpToReachLevel, getXpRequiredForLevel } from '@/lib/player-progression';
import type { HuntDefinition } from '@/types/hunt';

export const XP_SIM_CALIBRATION = {
  xpMultiplier: 1,
  expBoostMultiplier: 1,
} as const;

export function isProgressionHunt(hunt: HuntDefinition): boolean {
  if (hunt.tab === 'bosses') return false;
  if (hunt.id.startsWith('hunt-teste')) return false;
  return true;
}

export function primaryHuntTarget(hunt: HuntDefinition) {
  return hunt.targets[0];
}

export function huntEnemyLevel(hunt: HuntDefinition): number {
  return primaryHuntTarget(hunt)?.level ?? hunt.requiredLevel;
}

export interface HuntXpEconomyRow {
  huntId: string;
  name: string;
  requiredLevel: number;
  enemyLevel: number;
  baseXp: number;
  levelGap: number;
  gapMultiplier: number;
  finalXpPerKill: number;
  hp: number;
  killsPerMin: number;
  xpPerMin: number;
}

export function analyzeHuntForPlayer(
  hunt: HuntDefinition,
  playerLevel: number,
  options?: { useLegacyEnemyXp?: boolean; xpMultiplier?: number },
): HuntXpEconomyRow | null {
  const target = primaryHuntTarget(hunt);
  if (!target) return null;
  const enemyLevel = target.level;
  const hp = huntEnemyHpForLevel(enemyLevel);
  const baseXp = options?.useLegacyEnemyXp
    ? legacyHuntEnemyXp(enemyLevel)
    : huntEnemyXpForLevel(enemyLevel);
  const breakdown = computeHuntKillXp({
    playerLevel,
    enemyLevel,
    enemyHp: hp,
    xpMultiplier: options?.xpMultiplier ?? XP_SIM_CALIBRATION.xpMultiplier,
    expBoostMultiplier: XP_SIM_CALIBRATION.expBoostMultiplier,
  });
  const killsPerMin = estimateHuntKillsPerMinute(playerLevel, hp);
  return {
    huntId: hunt.id,
    name: hunt.name,
    requiredLevel: hunt.requiredLevel,
    enemyLevel,
    baseXp: decimalToUnsafeNumber(breakdown.baseXp),
    levelGap: breakdown.levelGap,
    gapMultiplier: breakdown.levelGapMultiplier,
    finalXpPerKill: decimalToUnsafeNumber(breakdown.finalXp),
    hp: decimalToUnsafeNumber(d(hp)),
    killsPerMin,
    xpPerMin: killsPerMin * decimalToUnsafeNumber(breakdown.finalXp),
  };
}

export function recommendedHuntForLevel(
  hunts: readonly HuntDefinition[],
  playerLevel: number,
  options?: { useLegacyEnemyXp?: boolean; xpMultiplier?: number },
): HuntXpEconomyRow | null {
  const unlocked = hunts.filter(
    (hunt) => isProgressionHunt(hunt) && hunt.requiredLevel <= playerLevel,
  );
  let best: HuntXpEconomyRow | null = null;
  for (const hunt of unlocked) {
    const row = analyzeHuntForPlayer(hunt, playerLevel, options);
    if (!row) continue;
    if (!best) {
      best = row;
      continue;
    }
    if (row.xpPerMin > best.xpPerMin * 1.03) {
      best = row;
      continue;
    }
    if (row.xpPerMin >= best.xpPerMin * 0.97 && row.enemyLevel > best.enemyLevel) {
      best = row;
    }
  }
  return best;
}

export interface LevelProgressionRow {
  level: number;
  xpRequired: number;
  totalXp: number;
  huntId: string;
  huntName: string;
  enemyLevel: number;
  xpPerKill: number;
  killsPerMin: number;
  xpPerMin: number;
  minutes: number;
  minutesAccumulated: number;
}

export interface ProgressionSimResult {
  startLevel: number;
  targetLevel: number;
  xpMultiplier: number;
  estimatedMinutes: number;
  totalXpRequired: number;
  xpGained: number;
  averageXpPerMin: number;
  estimatedKills: number;
  huntsUsed: Array<{ huntId: string; huntName: string; minutes: number; kills: number }>;
  levels: LevelProgressionRow[];
  stuckOnFirstHuntMinutes: number | null;
}

function simulateRange(
  hunts: readonly HuntDefinition[],
  startLevel: number,
  targetLevel: number,
  options: { useLegacyEnemyXp?: boolean; xpMultiplier?: number; lockHuntId?: string },
): ProgressionSimResult {
  const xpMultiplier = options.xpMultiplier ?? 1;
  const levels: LevelProgressionRow[] = [];
  const huntMinutes = new Map<string, { huntName: string; minutes: number; kills: number }>();
  let minutesAccumulated = 0;
  let killsTotal = 0;
  const totalXpRequired = decimalToUnsafeNumber(
    getTotalXpToReachLevel(targetLevel).minus(getTotalXpToReachLevel(startLevel)),
  );

  for (let level = startLevel; level < targetLevel; level += 1) {
    const row = options.lockHuntId
      ? analyzeHuntForPlayer(
          hunts.find((hunt) => hunt.id === options.lockHuntId) ?? hunts[0]!,
          level,
          { useLegacyEnemyXp: options.useLegacyEnemyXp, xpMultiplier },
        )
      : recommendedHuntForLevel(hunts, level, {
          useLegacyEnemyXp: options.useLegacyEnemyXp,
          xpMultiplier,
        });
    if (!row || row.xpPerMin <= 0) {
      throw new Error(`Sem Hunt válida no Lv${level}`);
    }
    const xpRequired = decimalToUnsafeNumber(getXpRequiredForLevel(level));
    const minutes = xpRequired / row.xpPerMin;
    minutesAccumulated += minutes;
    const kills = xpRequired / row.finalXpPerKill;
    killsTotal += kills;
    const used = huntMinutes.get(row.huntId) ?? {
      huntName: row.name,
      minutes: 0,
      kills: 0,
    };
    used.minutes += minutes;
    used.kills += kills;
    huntMinutes.set(row.huntId, used);
    levels.push({
      level,
      xpRequired,
      totalXp: decimalToUnsafeNumber(getTotalXpToReachLevel(level)),
      huntId: row.huntId,
      huntName: row.name,
      enemyLevel: row.enemyLevel,
      xpPerKill: row.finalXpPerKill,
      killsPerMin: row.killsPerMin,
      xpPerMin: row.xpPerMin,
      minutes,
      minutesAccumulated,
    });
  }

  return {
    startLevel,
    targetLevel,
    xpMultiplier,
    estimatedMinutes: minutesAccumulated,
    totalXpRequired,
    xpGained: totalXpRequired,
    averageXpPerMin: minutesAccumulated > 0 ? totalXpRequired / minutesAccumulated : 0,
    estimatedKills: killsTotal,
    huntsUsed: [...huntMinutes.entries()].map(([huntId, value]) => ({
      huntId,
      huntName: value.huntName,
      minutes: value.minutes,
      kills: value.kills,
    })),
    levels,
    stuckOnFirstHuntMinutes: null,
  };
}

export function simulateXpProgression(
  hunts: readonly HuntDefinition[],
  startLevel: number,
  targetLevel: number,
  options?: { useLegacyEnemyXp?: boolean; xpMultiplier?: number },
): ProgressionSimResult {
  const result = simulateRange(hunts, startLevel, targetLevel, options ?? {});
  const first = recommendedHuntForLevel(hunts, startLevel, options);
  result.stuckOnFirstHuntMinutes = first
    ? simulateRange(hunts, startLevel, targetLevel, {
        ...options,
        lockHuntId: first.huntId,
      }).estimatedMinutes
    : null;
  return result;
}

export function simulateExactMinutes(
  hunts: readonly HuntDefinition[],
  minutes: number,
  options?: { useLegacyEnemyXp?: boolean; xpMultiplier?: number; startLevel?: number },
): { level: number; xp: number; percentToNext: number; kills: number; huntIds: string[] } {
  const xpMultiplier = options?.xpMultiplier ?? 1;
  let level = options?.startLevel ?? 1;
  let xp = 0;
  let kills = 0;
  let remainingMs = minutes * 60_000;
  const huntIds = new Set<string>();

  while (remainingMs > 0 && level < 9999) {
    const row = recommendedHuntForLevel(hunts, level, {
      useLegacyEnemyXp: options?.useLegacyEnemyXp,
      xpMultiplier,
    });
    if (!row || row.xpPerMin <= 0) break;
    huntIds.add(row.huntId);
    const xpMax = decimalToUnsafeNumber(getXpRequiredForLevel(level));
    const need = xpMax - xp;
    const msToLevel = (need / row.xpPerMin) * 60_000;
    if (msToLevel <= remainingMs) {
      remainingMs -= msToLevel;
      kills += need / row.finalXpPerKill;
      const next = addExperience(level, xp, need);
      level = next.level;
      xp = decimalToUnsafeNumber(next.xp);
    } else {
      const gained = row.xpPerMin * (remainingMs / 60_000);
      if (gained <= 0) break;
      kills += gained / row.finalXpPerKill;
      const next = addExperience(level, xp, gained);
      level = next.level;
      xp = decimalToUnsafeNumber(next.xp);
      remainingMs = 0;
    }
  }

  const xpMax = decimalToUnsafeNumber(getXpRequiredForLevel(level));
  return {
    level,
    xp,
    percentToNext: xpMax > 0 ? (xp / xpMax) * 100 : 100,
    kills,
    huntIds: [...huntIds],
  };
}

export function compareHuntVsStale(
  hunts: readonly HuntDefinition[],
  playerLevel: number,
  staleHuntId: string,
): { recommended: HuntXpEconomyRow | null; stale: HuntXpEconomyRow | null } {
  const staleHunt = hunts.find((hunt) => hunt.id === staleHuntId);
  return {
    recommended: recommendedHuntForLevel(hunts, playerLevel),
    stale: staleHunt ? analyzeHuntForPlayer(staleHunt, playerLevel) : null,
  };
}
