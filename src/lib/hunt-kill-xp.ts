import { difficultyMultiplier, xpPerEnemy } from '@/anime-idle/formulas';
import { Decimal, d } from '@/lib/decimal';
import { huntEnemyHpForLevel } from '@/lib/hunt-enemy-xp';

/** Arredondamento único do XP de combate. */
export function roundFinalXp(amount: Decimal | number): Decimal {
  const n = d(amount);
  if (n.lte(0)) return d(0);
  return Decimal.max(d(1), n.round());
}

export interface HuntKillXpBreakdown {
  enemyLevel: number;
  playerLevel: number;
  enemyHp: Decimal;
  /** Δ = nível do inimigo − nível do personagem. */
  delta: number;
  baseXp: Decimal;
  levelGap: number;
  levelGapMultiplier: number;
  afterGap: Decimal;
  xpMultiplier: number;
  expBoostMultiplier: number;
  finalXp: Decimal;
}

/**
 * XP de kill: hp × XP_POR_HP × dificuldade(Δ). Sem faixas WONSR.
 * VIP/DEV entram depois, como multiplicadores externos.
 * HP do inimigo em Decimal (catálogo ainda pode ser number).
 */
export function computeHuntKillXp(input: {
  playerLevel: number;
  enemyLevel: number;
    enemyHp?: number | Decimal;
  xpMultiplier?: number;
  expBoostMultiplier?: number;
}): HuntKillXpBreakdown {
  const playerLevel = Math.max(1, Math.floor(input.playerLevel));
  const enemyLevel = Math.max(1, Math.floor(input.enemyLevel));
  const enemyHp = Decimal.max(d(1), d(input.enemyHp ?? huntEnemyHpForLevel(enemyLevel)));
  const delta = enemyLevel - playerLevel;
  const levelGapMultiplier = difficultyMultiplier(delta);
  const afterGap = xpPerEnemy(d(enemyHp), delta);
  const baseXp = xpPerEnemy(d(enemyHp), 0);
  const xpMultiplier = input.xpMultiplier ?? 1;
  const expBoostMultiplier = input.expBoostMultiplier ?? 1;
  const finalXp = roundFinalXp(afterGap.mul(xpMultiplier).mul(expBoostMultiplier));
  return {
    enemyLevel,
    playerLevel,
    enemyHp,
    delta,
    baseXp,
    levelGap: playerLevel - enemyLevel,
    levelGapMultiplier,
    afterGap,
    xpMultiplier,
    expBoostMultiplier,
    finalXp,
  };
}
