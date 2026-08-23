import { XP_LEVEL_GAP_FLOOR, XP_LEVEL_GAP_MULTIPLIERS } from '@/constants/xp-level-gap';

export function xpLevelGap(playerLevel: number, enemyLevel: number): number {
  return Math.max(1, Math.floor(playerLevel)) - Math.max(1, Math.floor(enemyLevel));
}

/** Multiplicador de XP de caça. Inimigo no mesmo Level ou acima = 100%. */
export function xpLevelGapMultiplier(playerLevel: number, enemyLevel: number): number {
  const gap = xpLevelGap(playerLevel, enemyLevel);
  if (gap <= 0) return 1;
  for (const band of XP_LEVEL_GAP_MULTIPLIERS) {
    if (gap <= band.maxGap) return band.multiplier;
  }
  return XP_LEVEL_GAP_FLOOR;
}
