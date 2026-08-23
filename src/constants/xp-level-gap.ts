/**
 * Penalidade suave quando o jogador caça inimigos abaixo do próprio Level.
 * Fonte única — não duplicar faixas em UI ou grant.
 *
 * levelGap = playerLevel - enemyLevel
 * Se enemyLevel >= playerLevel: sempre 1.0 (sem bônus extra).
 */
export const XP_LEVEL_GAP_MULTIPLIERS = [
  { maxGap: 10, multiplier: 1.0 },
  { maxGap: 20, multiplier: 0.8 },
  { maxGap: 35, multiplier: 0.65 },
  { maxGap: 50, multiplier: 0.5 },
  { maxGap: 75, multiplier: 0.4 },
  { maxGap: 100, multiplier: 0.3 },
  { maxGap: 150, multiplier: 0.2 },
  { maxGap: Number.POSITIVE_INFINITY, multiplier: 0.1 },
] as const;

export const XP_LEVEL_GAP_FLOOR = 0.1;
