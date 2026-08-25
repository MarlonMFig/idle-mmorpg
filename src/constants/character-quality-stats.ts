import type { AttributeId, AttributeValues } from '@/types/attributes';
import type { CharacterGrade, CharacterPotential, CharacterQuality } from '@/types/character-meta';
import { CHARACTER_QUALITIES } from '@/types/character-meta';
import {
  CONFIG,
  gradeFromPotential,
  potentialTotal,
  qualityStatMultiplierFromComponent,
  qualityStatMultiplierFromPotential,
} from '@/lib/raridade-potencial.js';

export type QualityStatRng = () => number;

export interface QualityStatRange {
  min: number;
  max: number;
  /** Referência de balanceamento / migration legada. Não é roll. */
  midpoint: number;
}

function rangeFromConfig(quality: CharacterQuality): QualityStatRange {
  const row = CONFIG.qualidades.find((entry) => entry.id === quality);
  const min = row?.min ?? 1;
  const max = row?.max ?? 1;
  return { min, max, midpoint: (min + max) / 2 };
}

/** Faixas oficiais de qualityStatMultiplier — vindas de CONFIG.qualidades. */
export const QUALITY_STAT_RANGES: Record<CharacterQuality, QualityStatRange> = {
  D: rangeFromConfig('D'),
  C: rangeFromConfig('C'),
  B: rangeFromConfig('B'),
  A: rangeFromConfig('A'),
  S: rangeFromConfig('S'),
  SS: rangeFromConfig('SS'),
  SSS: rangeFromConfig('SSS'),
};

export const CHARACTER_GRADE_LABELS: Record<CharacterGrade, string> = Object.fromEntries(
  CONFIG.graus.map((grade) => [grade.id, grade.rotulo]),
) as Record<CharacterGrade, string>;

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

export function isCharacterPotential(value: unknown): value is CharacterPotential {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Record<string, unknown>;
  return CONFIG.atributos.every((key) => typeof entry[key] === 'number' && Number.isFinite(entry[key]));
}

export function isCharacterGrade(value: unknown): value is CharacterGrade {
  return typeof value === 'string' && CONFIG.graus.some((grade) => grade.id === value);
}

/**
 * Se houver potential, SEMPRE recalcula. O valor gravado é cache.
 */
export function resolveQualityStatMultiplier(
  quality: CharacterQuality | null | undefined,
  stored: unknown,
  potential?: CharacterPotential | null,
): number {
  const q = quality && CHARACTER_QUALITIES.includes(quality) ? quality : 'D';
  if (isCharacterPotential(potential)) {
    return quantizeQualityStatMultiplier(qualityStatMultiplierFromPotential(q, potential));
  }
  if (typeof stored === 'number' && Number.isFinite(stored)) {
    return clampQualityStatMultiplier(q, stored);
  }
  return qualityStatMidpoint(q);
}

export function derivePotentialFields(
  quality: CharacterQuality,
  potential: CharacterPotential,
): { potential: CharacterPotential; potentialTotal: number; grade: CharacterGrade; qualityStatMultiplier: number } {
  const total = potentialTotal(potential);
  return {
    potential,
    potentialTotal: total,
    grade: gradeFromPotential(total),
    qualityStatMultiplier: quantizeQualityStatMultiplier(
      qualityStatMultiplierFromPotential(quality, potential),
    ),
  };
}

export function formatQualityStatMultiplier(value: number): string {
  return `${(Number.isFinite(value) ? value : 0).toFixed(2)}x`;
}

export function formatCharacterGrade(grade: CharacterGrade | null | undefined): string {
  if (!grade || !isCharacterGrade(grade)) return CHARACTER_GRADE_LABELS.bruto;
  return CHARACTER_GRADE_LABELS[grade];
}

export function scaleQualityPrimaryStat(base: number, multiplier: number): number {
  const m = Number.isFinite(multiplier) && multiplier > 0 ? multiplier : qualityStatMidpoint('D');
  return Math.floor(base * m);
}

const POTENTIAL_STAT_KEYS = {
  hp: 'hp',
  strength: 'forca',
  defense: 'defesa',
} as const;

export function applyQualityToPrimaryBase(
  base: AttributeValues,
  multiplier: number,
  extras?: { quality?: CharacterQuality | null; potential?: CharacterPotential | null },
): AttributeValues {
  const next = { ...base };
  const quality = extras?.quality && CHARACTER_QUALITIES.includes(extras.quality) ? extras.quality : 'D';
  const potential = extras?.potential;
  for (const id of QUALITY_PRIMARY_STAT_IDS) {
    const rolled =
      isCharacterPotential(potential)
        ? qualityStatMultiplierFromComponent(quality, potential[POTENTIAL_STAT_KEYS[id]])
        : multiplier;
    next[id] = scaleQualityPrimaryStat(base[id], rolled);
  }
  return next;
}

/** Preenchimento 0–100 da barra: roll do atributo (1–20) ou rank da qualidade. */
export function qualityMeterFillPercent(
  quality: CharacterQuality | null | undefined,
  component?: number | null,
): number {
  const { componenteMin: min, componenteMax: max } = CONFIG.potencial;
  if (typeof component === 'number' && Number.isFinite(component)) {
    const pos = Math.min(1, Math.max(0, (component - min) / (max - min)));
    return Math.round(8 + pos * 92);
  }
  const q = quality && CHARACTER_QUALITIES.includes(quality) ? quality : 'D';
  const rank = CHARACTER_QUALITIES.indexOf(q);
  return Math.round(((rank + 1) / CHARACTER_QUALITIES.length) * 100);
}
