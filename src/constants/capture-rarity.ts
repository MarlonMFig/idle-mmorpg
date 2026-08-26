import type { CharacterQuality } from '@/types/character-meta';
import { CHARACTER_QUALITIES } from '@/types/character-meta';
import { APPEARANCE_WEIGHTS, computeCaptureChance, appearancePercents } from '@/constants/capture-system';

/**
 * Peso relativo da qualidade na aparição (roll exclusivo normalizado).
 */
export const RARITY_SPAWN_WEIGHTS: Record<CharacterQuality, number> = { ...APPEARANCE_WEIGHTS };

export const QUALITY_SPAWN_WEIGHTS = RARITY_SPAWN_WEIGHTS;

/**
 * @deprecated A captura usa base da quality × multiplicador do pergaminho.
 * Mantido só para telas que ainda leem o modificador antigo.
 */
export const CAPTURE_RARITY_MODIFIERS: Record<CharacterQuality, number> = {
  D: 1,
  C: 0.72,
  B: 0.5,
  A: 0.32,
  S: 0.18,
  SS: 0.1,
  SSS: 0.05,
};

export const CAPTURE_QUALITY_MODIFIERS = CAPTURE_RARITY_MODIFIERS;

export function captureModifierForQuality(quality: CharacterQuality): number {
  return CAPTURE_RARITY_MODIFIERS[quality] ?? CAPTURE_RARITY_MODIFIERS.D;
}

export function spawnWeightForQuality(quality: CharacterQuality): number {
  return Math.max(0, RARITY_SPAWN_WEIGHTS[quality] ?? 0);
}

export function spawnQualityTotalWeight(): number {
  return CHARACTER_QUALITIES.reduce((sum, quality) => sum + spawnWeightForQuality(quality), 0);
}

export function spawnQualityPercents(): Record<CharacterQuality, number> {
  return appearancePercents();
}

export function computeCaptureFinalChance(_scrollChance: number, quality: CharacterQuality): number {
  void quality;
  return computeCaptureChance('comum', 'item-sealing-scroll');
}

export const CAPTURE_QUALITY_ORDER: readonly CharacterQuality[] = CHARACTER_QUALITIES;
