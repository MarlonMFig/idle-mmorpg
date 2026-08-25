import { difficultyMultiplier } from '@/anime-idle/formulas';

/** player − enemy (legado de UI). Δ de combate é o inverso. */
export function xpLevelGap(playerLevel: number, enemyLevel: number): number {
  return Math.max(1, Math.floor(playerLevel)) - Math.max(1, Math.floor(enemyLevel));
}

/** Multiplicador de XP: Δ = nível do inimigo − nível do jogador. */
export function xpLevelGapMultiplier(playerLevel: number, enemyLevel: number): number {
  return difficultyMultiplier(Math.floor(enemyLevel) - Math.floor(playerLevel));
}
