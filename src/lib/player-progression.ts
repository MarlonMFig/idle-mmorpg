import { xpToNextLevel as xpToNextLevelFn } from '@/anime-idle/formulas';
import { Decimal, d } from '@/lib/decimal';
import {
  LEVEL_RULES,
  LEVEL_XP_RANGES,
  MAX_PLAYER_LEVEL,
  type XpStageBand,
} from '@/config/gameConfig';

export { MAX_PLAYER_LEVEL, type XpStageBand };

const EARLY_MULTIPLIER = LEVEL_XP_RANGES[0]?.multiplier ?? 3500;

export const XP_CURVE_REFERENCE_LEVELS = [1, 5, 10, 20, 50, 100, 200, 300, 400, 500, 600] as const;

/** Marcos para XP acumulada (Lv 1 → este nível). */
export const XP_ACCUMULATION_LEVELS = [
  5, 10, 20, 30, 50, 75, 100, 150, 200, 300, 400, 500, 600,
] as const;

export function isMaxLevel(level: number): boolean {
  return Math.max(1, Math.floor(level)) >= MAX_PLAYER_LEVEL;
}

export function stageBandForLevel(level: number): XpStageBand {
  const safe = Math.max(1, Math.floor(level));
  return (
    LEVEL_XP_RANGES.find((band) => safe >= band.minLevel && safe <= band.maxLevel) ??
    LEVEL_XP_RANGES[LEVEL_XP_RANGES.length - 1]
  );
}

export function stageMultiplierForLevel(level: number): number {
  return stageBandForLevel(level).multiplier;
}

/** Rate normalizado (nível 1 = 1.0). Em high level o ganho cai como no OTX. */
export function normalizedStageRate(level: number): number {
  return stageMultiplierForLevel(level) / EARLY_MULTIPLIER;
}

/** XP necessária para subir do `level` atual → próximo. Curva Anime Idle (`XP_BASE * XP_GROWTH^(n-1)`). */
export function getXpRequiredForLevel(level: number): Decimal {
  const value = xpToNextLevelFn(level);
  if (!Number.isFinite(value.m) || !Number.isFinite(value.e) || value.lte(0)) {
    return d(LEVEL_RULES.minXpRequired);
  }
  return Decimal.max(d(LEVEL_RULES.minXpRequired), value.round());
}

/** Alias da função oficial (compatível com o nome anterior). */
export const xpRequiredForLevel = getXpRequiredForLevel;

/**
 * XP total para ir do Lv 1 (0 XP) até `targetLevel`.
 * Soma `getXpRequiredForLevel` de 1 até targetLevel-1.
 */
export function getTotalXpToReachLevel(targetLevel: number): Decimal {
  const target = Math.max(1, Math.floor(targetLevel));
  if (target <= 1) return d(0);
  let total = d(0);
  for (let level = 1; level < target; level += 1) {
    total = total.plus(getXpRequiredForLevel(level));
  }
  return total;
}

/** XP que ainda falta para sair de (level, xp) e chegar em `targetLevel`. */
export function getXpRemainingToLevel(
  currentLevel: number,
  currentXp: Decimal | number,
  targetLevel: number,
): Decimal {
  const from = Math.max(1, Math.floor(currentLevel) || 1);
  const to = Math.max(1, Math.floor(targetLevel) || 1);
  if (to <= from) return d(0);
  const remaining = getTotalXpToReachLevel(to)
    .minus(getTotalXpToReachLevel(from))
    .minus(d(currentXp).max(0));
  return remaining.lt(0) ? d(0) : remaining;
}

/** Aplica o rate de stage ao XP de combate/loot. Não altera a quantidade base do inimigo. */
export function applyStageXpGain(baseXp: Decimal | number, level: number): Decimal {
  const base = d(baseXp);
  if (base.lte(0)) return d(0);
  return Decimal.max(d(1), base.mul(normalizedStageRate(level)).round());
}

export interface ExperienceState {
  level: number;
  xp: Decimal;
  xpMax: Decimal;
  leveled: boolean;
  levelsGained: number;
}

/**
 * Aplica ganho de XP com múltiplos level-ups e resto preservado.
 * No nível máximo, não ultrapassa o cap e não entra em loop.
 */
export function addExperience(
  level: number,
  xp: Decimal | number,
  amount: Decimal | number,
): ExperienceState {
  let nextLevel = Math.max(1, Math.min(MAX_PLAYER_LEVEL, Math.floor(level) || 1));
  let nextXp = d(xp).max(0).plus(d(amount).max(0));
  let xpMax = getXpRequiredForLevel(nextLevel);
  let levelsGained = 0;

  while (
    !isMaxLevel(nextLevel) &&
    xpMax.gt(0) &&
    nextXp.gte(xpMax) &&
    levelsGained < MAX_PLAYER_LEVEL
  ) {
    nextXp = nextXp.minus(xpMax);
    nextLevel += 1;
    levelsGained += 1;
    xpMax = getXpRequiredForLevel(nextLevel);
  }

  if (isMaxLevel(nextLevel) || nextLevel >= MAX_PLAYER_LEVEL) {
    nextLevel = MAX_PLAYER_LEVEL;
    xpMax = getXpRequiredForLevel(nextLevel);
    nextXp = nextXp.min(xpMax);
  }

  if (nextXp.lt(0)) nextXp = d(0);
  if (xpMax.lt(LEVEL_RULES.minXpRequired)) {
    xpMax = getXpRequiredForLevel(nextLevel);
  }

  return {
    level: nextLevel,
    xp: nextXp,
    xpMax,
    leveled: levelsGained > 0,
    levelsGained,
  };
}

/** Progresso 0..1 rumo ao próximo nível. No cap retorna 1. */
export function getProgressToNextLevel(xp: Decimal | number, level: number): number {
  if (isMaxLevel(level)) return 1;
  const required = getXpRequiredForLevel(level);
  if (required.lte(0)) return 0;
  const ratio = d(xp).max(0).div(required).toNumber();
  if (!Number.isFinite(ratio)) return 0;
  return Math.max(0, Math.min(1, ratio));
}

/** Percentual visual da barra (0..100). */
export function getXpBarPercent(xp: Decimal | number, level: number): number {
  return getProgressToNextLevel(xp, level) * 100;
}

export interface XpCurveInspectionRow {
  level: number;
  xpRequired: Decimal;
  multiplier: number;
  minLevel: number;
  maxLevel: number;
}

export function inspectXpCurve(
  levels: readonly number[] = XP_CURVE_REFERENCE_LEVELS,
): XpCurveInspectionRow[] {
  return levels.map((level) => {
    const band = stageBandForLevel(level);
    return {
      level,
      xpRequired: getXpRequiredForLevel(level),
      multiplier: band.multiplier,
      minLevel: band.minLevel,
      maxLevel: band.maxLevel,
    };
  });
}

export function assertPlayerProgressionIntegrity(): string[] {
  const errors: string[] = [];
  const lv1 = getXpRequiredForLevel(1);
  if (!lv1.eq(360)) errors.push(`Lv1 xpRequired esperado 360, obtido ${lv1}`);

  const small = addExperience(1, 0, 50);
  if (small.level !== 1 || !small.xp.eq(50)) {
    errors.push(`ganho pequeno: esperado Lv1/50, obtido Lv${small.level}/${small.xp}`);
  }

  const exact = addExperience(1, 0, lv1);
  if (exact.level !== 2 || !exact.xp.eq(0)) {
    errors.push(`level up simples: esperado Lv2/0, obtido Lv${exact.level}/${exact.xp}`);
  }

  const need10 = getXpRequiredForLevel(10);
  const need11 = getXpRequiredForLevel(11);
  const need12 = getXpRequiredForLevel(12);
  const multi = addExperience(10, 0, need10.plus(need11).plus(need12).plus(50));
  if (multi.level !== 13 || !multi.xp.eq(50) || multi.levelsGained !== 3) {
    errors.push(
      `múltiplos levels: esperado Lv13/50 (+3), obtido Lv${multi.level}/${multi.xp} (+${multi.levelsGained})`,
    );
  }

  const maxed = addExperience(MAX_PLAYER_LEVEL, 0, 1_000_000);
  if (maxed.level !== MAX_PLAYER_LEVEL) {
    errors.push(`nível máximo: esperado ${MAX_PLAYER_LEVEL}, obtido ${maxed.level}`);
  }
  if (maxed.leveled) errors.push('nível máximo não deve continuar subindo');
  const bar = getXpBarPercent(maxed.xp, maxed.level);
  if (bar < 0 || bar > 100) errors.push(`barra no cap fora de 0..100: ${bar}`);
  if (getProgressToNextLevel(maxed.xp, maxed.level) !== 1) {
    errors.push('progresso no cap deve ser 100%');
  }

  const overflowBar = getXpBarPercent(need10.mul(4), 10);
  if (overflowBar < 0 || overflowBar > 100) {
    errors.push(`barra deve clambar overflow visual: ${overflowBar}`);
  }

  if (!getTotalXpToReachLevel(1).eq(0)) errors.push('acumulado Lv1 deve ser 0');
  if (!getTotalXpToReachLevel(2).eq(lv1)) {
    errors.push(`acumulado Lv2 esperado ${lv1}, obtido ${getTotalXpToReachLevel(2)}`);
  }

  return errors;
}
