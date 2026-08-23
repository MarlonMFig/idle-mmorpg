import type { CharacterQuality } from '@/types/character-meta';
import {
  GAME_LIMITS,
  RARITIES,
  STAR_BONUSES,
  STAR_RULES,
  getMaxStarsForRarity,
  getStartingStarsForRarity,
  starAttributeMultiplier,
} from '@/config/gameConfig';

export {
  getMaxStarsForRarity,
  starAttributeMultiplier,
} from '@/config/gameConfig';

/** Spec AIW: evolução por fragmento duplicado. */
export const FRAGMENTS_PER_STAR = 10;
export const FRAGMENTS_TO_UNLOCK = 100;

export const STAR_BONUS_PER_LEVEL = STAR_BONUSES.perStar;
export const ABSOLUTE_MAX_STARS = GAME_LIMITS.absoluteMaxStars;
export const MAX_STARS_BY_RARITY = STAR_RULES.maxByRarity;

export interface QualityTierSpec {
  quality: CharacterQuality;
  label: string;
  color: string;
  starsOnUnlock: number;
}

export const QUALITY_TIER_SPECS: readonly QualityTierSpec[] = (
  Object.keys(RARITIES) as CharacterQuality[]
).map((quality) => ({
  quality,
  label: RARITIES[quality].label,
  color: RARITIES[quality].color,
  starsOnUnlock: STAR_RULES.starsOnUnlock[quality],
}));

export function qualitySpec(quality: CharacterQuality): QualityTierSpec {
  const rarity = RARITIES[quality] ?? RARITIES.D;
  return {
    quality: rarity.id,
    label: rarity.label,
    color: rarity.color,
    starsOnUnlock: STAR_RULES.starsOnUnlock[rarity.id],
  };
}

export function maxStarsForQuality(quality: CharacterQuality): number {
  return getMaxStarsForRarity(quality);
}

export function startingStarsForQuality(quality: CharacterQuality): number {
  return getStartingStarsForRarity(quality);
}
