import type { AttributeId, AttributeValues } from '@/types/attributes';
import type { CharacterQuality } from '@/types/character-meta';
import { CHARACTER_QUALITIES } from '@/types/character-meta';

export type QualityStatRng = () => number;

export interface QualityStatRange {
  min: number;
  max: number;
  /** Referência de balanceamento / migration legada. Não é roll. */
  midpoint: number;
}

/**
 * Faixas oficiais de qualityStatMultiplier (IDs D–SSS).
 * Sobreposição entre ranks é intencional.
 */
export const QUALITY_STAT_RANGES: Record<CharacterQuality, QualityStatRange> = {
  D: { min: 0.2, max: 0.4, midpoint: 0.3 },
  C: { min: 0.3, max: 0.55, midpoint: 0.43 },
  B: { min: 0.45, max: 0.75, midpoint: 0.6 },
  A: { min: 0.7, max: 1.1, midpoint: 0.9 },
  S: { min: 1.05, max: 1.55, midpoint: 1.3 },
  SS: { min: 1.5, max: 2.1, midpoint: 1.8 },
  SSS: { min: 2.1, max: 2.8, midpoint: 2.5 },
};

/** HP / ATK (strength) / DEF. */
export const QUALITY_PRIMARY_STAT_IDS = ['hp', 'strength', 'defense'] as const satisfies readonly AttributeId[];

const INTERNAL_DECIMALS = 1_000_000;

export function qualityStatRange(quality: CharacterQuality | null | undefined): QualityStatRange {
  if (quality && CHARACTER_QUALITIES.includes(quality)) return QUALITY_STAT_RANGES[quality];
  return QUALITY_STAT_RANGES.D;
}

export function qualityStatMidpoint(quality: CharacterQuality | null | undefined): number {
  return qualityStatRange(quality).midpoint;
}

export function quantizeQualityStatMultiplier(value: number): number {
  if (!Number.isFinite(value)) return QUALITY_STAT_RANGES.D.midpoint;
  return Math.round(value * INTERNAL_DECIMALS) / INTERNAL_DECIMALS;
}

export function isQualityStatMultiplierInRange(
  quality: CharacterQuality | null | undefined,
  value: number,
): boolean {
  if (!Number.isFinite(value)) return false;
  const range = qualityStatRange(quality);
  return value + 1e-12 >= range.min && value - 1e-12 <= range.max;
}

export function clampQualityStatMultiplier(
  quality: CharacterQuality | null | undefined,
  value: number,
): number {
  const range = qualityStatRange(quality);
  if (!Number.isFinite(value)) return range.midpoint;
  return quantizeQualityStatMultiplier(Math.min(range.max, Math.max(range.min, value)));
}

/**
 * Legacy / omitido: midpoint determinístico.
 * Valor presente: clampa na faixa da quality armazenada (quality é autoridade).
 */
export function resolveQualityStatMultiplier(
  quality: CharacterQuality | null | undefined,
  stored: unknown,
): number {
  if (typeof stored === 'number' && Number.isFinite(stored)) {
    return clampQualityStatMultiplier(quality, stored);
  }
  return qualityStatMidpoint(quality);
}

/** Inclusive min..max. RNG injetável (`SpawnRng`). */
export function rollQualityStatMultiplier(
  quality: CharacterQuality,
  rng: QualityStatRng = Math.random,
): number {
  const range = qualityStatRange(quality);
  const raw = rng();
  const t = !Number.isFinite(raw) ? 0 : raw <= 0 ? 0 : raw >= 1 ? 1 : raw;
  return quantizeQualityStatMultiplier(range.min + t * (range.max - range.min));
}

export function formatQualityStatMultiplier(value: number): string {
  return `${(Number.isFinite(value) ? value : 0).toFixed(2)}x`;
}

export function scaleQualityPrimaryStat(base: number, multiplier: number): number {
  const m = Number.isFinite(multiplier) && multiplier > 0 ? multiplier : qualityStatMidpoint('D');
  return Math.floor(base * m);
}

export function applyQualityToPrimaryBase(
  base: AttributeValues,
  multiplier: number,
): AttributeValues {
  const next = { ...base };
  for (const id of QUALITY_PRIMARY_STAT_IDS) {
    next[id] = scaleQualityPrimaryStat(base[id], multiplier);
  }
  return next;
}

export function simulateQualityStatRolls(
  quality: CharacterQuality,
  n: number,
  rng: QualityStatRng,
): { min: number; max: number; average: number; expectedMidpoint: number } {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let sum = 0;
  for (let i = 0; i < n; i += 1) {
    const rolled = rollQualityStatMultiplier(quality, rng);
    if (rolled < min) min = rolled;
    if (rolled > max) max = rolled;
    sum += rolled;
  }
  const range = qualityStatRange(quality);
  return {
    min: min === Number.POSITIVE_INFINITY ? range.min : min,
    max: max === Number.NEGATIVE_INFINITY ? range.max : max,
    average: n > 0 ? sum / n : range.midpoint,
    expectedMidpoint: (range.min + range.max) / 2,
  };
}
