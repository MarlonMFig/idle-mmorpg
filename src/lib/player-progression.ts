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

/** XP necessária para subir do `level` atual → próximo. Independente da Hunt. */
export function getXpRequiredForLevel(level: number): number {
  const safe = Math.max(1, Math.floor(level));
  return Math.max(
    LEVEL_RULES.minXpRequired,
    Math.floor(LEVEL_RULES.xpBase * Math.pow(safe, LEVEL_RULES.xpExponent)),
  );
}

/** Alias da função oficial (compatível com o nome anterior). */
export const xpRequiredForLevel = getXpRequiredForLevel;

/**
 * XP total para ir do Lv 1 (0 XP) até `targetLevel`.
 * Soma `getXpRequiredForLevel` de 1 até targetLevel-1.
 */
export function getTotalXpToReachLevel(targetLevel: number): number {
  const target = Math.max(1, Math.floor(targetLevel));
  if (target <= 1) return 0;
  let total = 0;
  for (let level = 1; level < target; level += 1) {
    const need = getXpRequiredForLevel(level);
    if (!Number.isFinite(need)) return Number.POSITIVE_INFINITY;
    total += need;
    if (!Number.isFinite(total)) return Number.POSITIVE_INFINITY;
  }
  return total;
}

/** XP que ainda falta para sair de (level, xp) e chegar em `targetLevel`. */
export function getXpRemainingToLevel(
  currentLevel: number,
  currentXp: number,
  targetLevel: number,
): number {
  const from = Math.max(1, Math.floor(currentLevel) || 1);
  const to = Math.max(1, Math.floor(targetLevel) || 1);
  if (to <= from) return 0;
  const spentInCurrent = Math.max(0, currentXp);
  const remaining =
    getTotalXpToReachLevel(to) - getTotalXpToReachLevel(from) - spentInCurrent;
  if (!Number.isFinite(remaining)) return Number.POSITIVE_INFINITY;
  return Math.max(0, remaining);
}

/** Aplica o rate de stage ao XP de combate/loot. Não altera a quantidade base do inimigo. */
export function applyStageXpGain(baseXp: number, level: number): number {
  if (baseXp <= 0) return 0;
  return Math.max(1, Math.round(baseXp * normalizedStageRate(level)));
}

export interface ExperienceState {
  level: number;
  xp: number;
  xpMax: number;
  leveled: boolean;
  levelsGained: number;
}

/**
 * Aplica ganho de XP com múltiplos level-ups e resto preservado.
 * No nível máximo, não ultrapassa o cap e não entra em loop.
 */
export function addExperience(level: number, xp: number, amount: number): ExperienceState {
  let nextLevel = Math.max(1, Math.min(MAX_PLAYER_LEVEL, Math.floor(level) || 1));
  let nextXp = Math.max(0, xp) + Math.max(0, amount);
  let xpMax = getXpRequiredForLevel(nextLevel);
  let levelsGained = 0;

  while (
    !isMaxLevel(nextLevel) &&
    Number.isFinite(xpMax) &&
    xpMax > 0 &&
    nextXp >= xpMax &&
    levelsGained < MAX_PLAYER_LEVEL
  ) {
    nextXp -= xpMax;
    nextLevel += 1;
    levelsGained += 1;
    xpMax = getXpRequiredForLevel(nextLevel);
  }

  if (isMaxLevel(nextLevel) || nextLevel >= MAX_PLAYER_LEVEL) {
    nextLevel = MAX_PLAYER_LEVEL;
    xpMax = getXpRequiredForLevel(nextLevel);
    if (Number.isFinite(xpMax)) {
      nextXp = Math.min(nextXp, xpMax);
    }
  }

  if (!Number.isFinite(nextXp) || nextXp < 0) nextXp = 0;
  if (!Number.isFinite(xpMax) || xpMax < LEVEL_RULES.minXpRequired) {
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
export function getProgressToNextLevel(xp: number, level: number): number {
  if (isMaxLevel(level)) return 1;
  const required = getXpRequiredForLevel(level);
  if (!Number.isFinite(required) || required <= 0) return 0;
  const ratio = Math.max(0, xp) / required;
  if (!Number.isFinite(ratio)) return 0;
  return Math.max(0, Math.min(1, ratio));
}

/** Percentual visual da barra (0..100). */
export function getXpBarPercent(xp: number, level: number): number {
  return getProgressToNextLevel(xp, level) * 100;
}

export interface XpCurveInspectionRow {
  level: number;
  xpRequired: number;
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
  if (lv1 !== 100) errors.push(`Lv1 xpRequired esperado 100, obtido ${lv1}`);

  const small = addExperience(1, 0, 50);
  if (small.level !== 1 || small.xp !== 50) {
    errors.push(`ganho pequeno: esperado Lv1/50, obtido Lv${small.level}/${small.xp}`);
  }

  const exact = addExperience(1, 0, lv1);
  if (exact.level !== 2 || exact.xp !== 0) {
    errors.push(`level up simples: esperado Lv2/0, obtido Lv${exact.level}/${exact.xp}`);
  }

  const need10 = getXpRequiredForLevel(10);
  const need11 = getXpRequiredForLevel(11);
  const need12 = getXpRequiredForLevel(12);
  const multi = addExperience(10, 0, need10 + need11 + need12 + 50);
  if (multi.level !== 13 || multi.xp !== 50 || multi.levelsGained !== 3) {
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

  const overflowBar = getXpBarPercent(need10 * 4, 10);
  if (overflowBar < 0 || overflowBar > 100) {
    errors.push(`barra deve clambar overflow visual: ${overflowBar}`);
  }

  if (getTotalXpToReachLevel(1) !== 0) errors.push('acumulado Lv1 deve ser 0');
  if (getTotalXpToReachLevel(2) !== lv1) {
    errors.push(`acumulado Lv2 esperado ${lv1}, obtido ${getTotalXpToReachLevel(2)}`);
  }

  return errors;
}
