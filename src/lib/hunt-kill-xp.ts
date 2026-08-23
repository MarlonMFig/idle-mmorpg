import { huntEnemyXpForLevel } from '@/lib/hunt-enemy-xp';
import { applyStageXpGain } from '@/lib/player-progression';
import { xpLevelGapMultiplier } from '@/lib/xp-level-gap';

/** Arredondamento único do XP de combate (igual a `applyStageXpGain`). */
export function roundFinalXp(amount: number): number {
  if (amount <= 0) return 0;
  return Math.max(1, Math.round(amount));
}

export interface HuntKillXpBreakdown {
  enemyLevel: number;
  playerLevel: number;
  baseXp: number;
  levelGap: number;
  levelGapMultiplier: number;
  afterGap: number;
  xpMultiplier: number;
  expBoostMultiplier: number;
  finalXp: number;
}

/**
 * Pipeline oficial de caça:
 * BASE ENEMY XP → LEVEL GAP → XP boosts (DEV/VIP) → stage rate → FINAL
 */
export function computeHuntKillXp(input: {
  playerLevel: number;
  enemyLevel: number;
  baseEnemyXp?: number;
  xpMultiplier?: number;
  expBoostMultiplier?: number;
}): HuntKillXpBreakdown {
  const playerLevel = Math.max(1, Math.floor(input.playerLevel));
  const enemyLevel = Math.max(1, Math.floor(input.enemyLevel));
  const baseXp = input.baseEnemyXp ?? huntEnemyXpForLevel(enemyLevel);
  const levelGap = playerLevel - enemyLevel;
  const levelGapMultiplier = xpLevelGapMultiplier(playerLevel, enemyLevel);
  const afterGap = baseXp * levelGapMultiplier;
  const xpMultiplier = input.xpMultiplier ?? 1;
  const expBoostMultiplier = input.expBoostMultiplier ?? 1;
  const finalXp = applyStageXpGain(afterGap * xpMultiplier * expBoostMultiplier, playerLevel);
  return {
    enemyLevel,
    playerLevel,
    baseXp,
    levelGap,
    levelGapMultiplier,
    afterGap,
    xpMultiplier,
    expBoostMultiplier,
    finalXp,
  };
}
