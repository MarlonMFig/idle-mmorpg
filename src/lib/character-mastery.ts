import {
  clampMasteryLevel,
  clampMasteryXp,
  getMasteryXpPerKill,
  MASTERY_MAX_LEVEL,
  MASTERY_MILESTONES,
  MASTERY_XP_BASE,
  MASTERY_XP_PER_LEVEL,
  MASTERY_DEFAULT_LEVEL,
  MASTERY_DEFAULT_XP,
  type MasteryMilestone,
} from '@/constants/character-mastery';

export { clampMasteryLevel, clampMasteryXp, getMasteryXpPerKill };

export interface MasteryProgress {
  masteryLevel: number;
  masteryXp: number;
}

export interface MasteryApplyResult extends MasteryProgress {
  oldLevel: number;
  newLevel: number;
  xpGranted: number;
  xpDiscarded: number;
  leveled: boolean;
}

export function defaultMasteryProgress(): MasteryProgress {
  return { masteryLevel: MASTERY_DEFAULT_LEVEL, masteryXp: MASTERY_DEFAULT_XP };
}

export function isMaxMastery(level: number): boolean {
  return clampMasteryLevel(level) >= MASTERY_MAX_LEVEL;
}

/** XP necessária para subir de `level` → `level + 1`. 0 no máximo. */
export function getMasteryXpRequired(level: number): number {
  const safe = clampMasteryLevel(level);
  if (safe >= MASTERY_MAX_LEVEL) return 0;
  return MASTERY_XP_BASE + MASTERY_XP_PER_LEVEL * safe;
}

/** XP total para ir de 0 até `targetLevel`. */
export function getTotalMasteryXpToReach(targetLevel: number): number {
  const target = clampMasteryLevel(targetLevel);
  let total = 0;
  for (let level = 0; level < target; level += 1) {
    total += getMasteryXpRequired(level);
  }
  return total;
}

export function nextMasteryMilestone(level: number): MasteryMilestone | null {
  const safe = clampMasteryLevel(level);
  return MASTERY_MILESTONES.find((mark) => mark > safe) ?? null;
}

export function masteryXpFromKills(kills: number, huntLevel: number): number {
  const n = Math.max(0, Math.floor(kills));
  if (n <= 0) return 0;
  return n * getMasteryXpPerKill(huntLevel);
}

export function applyMasteryXp(
  current: MasteryProgress,
  amount: number,
): MasteryApplyResult {
  const oldLevel = clampMasteryLevel(current.masteryLevel);
  let level = oldLevel;
  let xp = level >= MASTERY_MAX_LEVEL ? 0 : clampMasteryXp(current.masteryXp);
  const incoming = Math.max(0, Math.floor(amount));
  let remaining = incoming;
  let discarded = 0;

  if (incoming <= 0) {
    return {
      masteryLevel: level,
      masteryXp: xp,
      oldLevel,
      newLevel: level,
      xpGranted: 0,
      xpDiscarded: 0,
      leveled: false,
    };
  }

  if (level >= MASTERY_MAX_LEVEL) {
    return {
      masteryLevel: MASTERY_MAX_LEVEL,
      masteryXp: 0,
      oldLevel,
      newLevel: MASTERY_MAX_LEVEL,
      xpGranted: 0,
      xpDiscarded: incoming,
      leveled: false,
    };
  }

  while (remaining > 0 && level < MASTERY_MAX_LEVEL) {
    const need = getMasteryXpRequired(level);
    const intoLevel = xp + remaining;
    if (intoLevel < need) {
      xp = intoLevel;
      remaining = 0;
      break;
    }
    remaining = intoLevel - need;
    level += 1;
    xp = 0;
  }

  if (level >= MASTERY_MAX_LEVEL) {
    discarded = remaining;
    remaining = 0;
    xp = 0;
    level = MASTERY_MAX_LEVEL;
  }

  return {
    masteryLevel: level,
    masteryXp: xp,
    oldLevel,
    newLevel: level,
    xpGranted: incoming - discarded,
    xpDiscarded: discarded,
    leveled: level > oldLevel,
  };
}

export function hoursToMasteryLevel(params: {
  fromLevel?: number;
  fromXp?: number;
  targetLevel: number;
  killsPerHour: number;
  huntLevel?: number;
}): number | null {
  const killsPerHour = Math.max(0, params.killsPerHour);
  if (killsPerHour <= 0) return null;
  const fromLevel = clampMasteryLevel(params.fromLevel ?? 0);
  const fromXp = clampMasteryXp(params.fromXp ?? 0);
  const target = clampMasteryLevel(params.targetLevel);
  if (target <= fromLevel) return 0;
  const remaining =
    getTotalMasteryXpToReach(target) - getTotalMasteryXpToReach(fromLevel) - fromXp;
  const xpNeeded = Math.max(0, remaining);
  const xpPerHour = killsPerHour * getMasteryXpPerKill(params.huntLevel ?? 1);
  if (xpPerHour <= 0) return null;
  return xpNeeded / xpPerHour;
}

export function formatMasteryLevel(level: number): string {
  return isMaxMastery(level) ? 'MAX' : String(clampMasteryLevel(level));
}
