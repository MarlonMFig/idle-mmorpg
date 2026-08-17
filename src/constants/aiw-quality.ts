import type { CharacterQuality } from '@/types/character-meta';

/** Spec AIW: evolução por fragmento duplicado. */
export const FRAGMENTS_PER_STAR = 10;
export const FRAGMENTS_TO_UNLOCK = 100;

/** +8% dano/velocidade por estrela (spec). */
export const STAR_BONUS_PER_STAR = 0.08;

export interface QualityTierSpec {
  quality: CharacterQuality;
  label: string;
  color: string;
  starsOnUnlock: number;
  evolutionCap: number;
}

/** D…SS mapeiam Comum…Mítico da spec. */
export const QUALITY_TIER_SPECS: readonly QualityTierSpec[] = [
  { quality: 'D', label: 'Comum', color: '#9aa3ad', starsOnUnlock: 1, evolutionCap: 3 },
  { quality: 'C', label: 'Incomum', color: '#5fb85f', starsOnUnlock: 1, evolutionCap: 4 },
  { quality: 'B', label: 'Raro', color: '#4a90d9', starsOnUnlock: 2, evolutionCap: 5 },
  { quality: 'A', label: 'Épico', color: '#a86ede', starsOnUnlock: 2, evolutionCap: 6 },
  { quality: 'S', label: 'Lendário', color: '#f0932b', starsOnUnlock: 3, evolutionCap: 7 },
  { quality: 'SS', label: 'Mítico', color: '#e34a4a', starsOnUnlock: 3, evolutionCap: 8 },
  { quality: 'SSS', label: 'Mítico', color: '#e34a4a', starsOnUnlock: 3, evolutionCap: 8 },
] as const;

const QUALITY_MAP = new Map(QUALITY_TIER_SPECS.map((entry) => [entry.quality, entry]));

export function qualitySpec(quality: CharacterQuality): QualityTierSpec {
  return QUALITY_MAP.get(quality) ?? QUALITY_TIER_SPECS[0];
}

export function maxStarsForQuality(quality: CharacterQuality): number {
  return qualitySpec(quality).evolutionCap;
}

export function startingStarsForQuality(quality: CharacterQuality): number {
  return qualitySpec(quality).starsOnUnlock;
}

export function starAttributeMultiplier(stars: number): number {
  const clamped = Math.max(0, Math.min(8, Math.floor(stars)));
  return 1 + clamped * STAR_BONUS_PER_STAR;
}
