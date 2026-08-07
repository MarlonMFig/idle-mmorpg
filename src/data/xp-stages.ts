/**
 * Estágios de XP do WONSR (serv/data/XML/stages.xml).
 * No OTX o multiplier escala o ganho de experiência por faixa de nível.
 */
export interface XpStageBand {
  minLevel: number;
  maxLevel: number;
  multiplier: number;
}

export const WONSR_XP_STAGES: readonly XpStageBand[] = [
  { minLevel: 1, maxLevel: 49, multiplier: 3500 },
  { minLevel: 50, maxLevel: 99, multiplier: 2000 },
  { minLevel: 100, maxLevel: 149, multiplier: 800 },
  { minLevel: 150, maxLevel: 199, multiplier: 400 },
  { minLevel: 200, maxLevel: 249, multiplier: 200 },
  { minLevel: 250, maxLevel: 299, multiplier: 120 },
  { minLevel: 300, maxLevel: 349, multiplier: 80 },
  { minLevel: 350, maxLevel: 399, multiplier: 45 },
  { minLevel: 400, maxLevel: 449, multiplier: 25 },
  { minLevel: 450, maxLevel: 499, multiplier: 15 },
  { minLevel: 500, maxLevel: 549, multiplier: 8 },
  { minLevel: 550, maxLevel: 579, multiplier: 5 },
  { minLevel: 580, maxLevel: 599, multiplier: 2 },
  { minLevel: 600, maxLevel: 9999, multiplier: 1 },
] as const;

const EARLY_MULTIPLIER = WONSR_XP_STAGES[0]?.multiplier ?? 3500;

export function stageBandForLevel(level: number): XpStageBand {
  const safe = Math.max(1, Math.floor(level));
  return (
    WONSR_XP_STAGES.find((band) => safe >= band.minLevel && safe <= band.maxLevel) ??
    WONSR_XP_STAGES[WONSR_XP_STAGES.length - 1]
  );
}

/** Multiplicador bruto do XML. */
export function stageMultiplierForLevel(level: number): number {
  return stageBandForLevel(level).multiplier;
}

/**
 * Rate normalizado (nível 1 = 1.0). Em high level o ganho cai como no OTX.
 */
export function normalizedStageRate(level: number): number {
  return stageMultiplierForLevel(level) / EARLY_MULTIPLIER;
}

/**
 * XP necessário para subir do `level` atual → próximo.
 * Curva idle suave, um pouco mais lenta a cada faixa de stage.
 */
export function xpRequiredForLevel(level: number): number {
  const safe = Math.max(1, Math.floor(level));
  const base = Math.floor(100 * Math.pow(1.22, safe - 1));
  const stageSlowdown = 1 / Math.max(0.05, Math.sqrt(normalizedStageRate(safe)));
  return Math.max(50, Math.floor(base * stageSlowdown));
}

/** Aplica o rate de stage ao XP de combate/loot. */
export function applyStageXpGain(baseXp: number, level: number): number {
  if (baseXp <= 0) return 0;
  return Math.max(1, Math.round(baseXp * normalizedStageRate(level)));
}
