import type { CharacterQuality } from '@/types/character-meta';
import { CHARACTER_QUALITIES } from '@/types/character-meta';
import { clampCaptureChance } from '@/constants/capture';

/**
 * Peso relativo da qualidade obtida NA CAPTURA (eixo ENCONTRAR / roll pós-sucesso).
 * Não é rolado no spawn da Hunt.
 */
export const RARITY_SPAWN_WEIGHTS: Record<CharacterQuality, number> = {
  D: 40,
  C: 24,
  B: 16,
  A: 10,
  S: 6,
  SS: 3,
  SSS: 1,
};

/** Alias oficial — mesma tabela. */
export const QUALITY_SPAWN_WEIGHTS = RARITY_SPAWN_WEIGHTS;

/**
 * Multiplicador de selamento por qualidade do spawn (eixo SELAR).
 * final = clamp(scrollChance × modifier)
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

/** Alias oficial — mesma tabela. */
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

/** Percentual esperado de cada qualidade (soma 100). */
export function spawnQualityPercents(): Record<CharacterQuality, number> {
  const total = spawnQualityTotalWeight();
  return Object.fromEntries(
    CHARACTER_QUALITIES.map((quality) => [
      quality,
      total > 0 ? (100 * spawnWeightForQuality(quality)) / total : 0,
    ]),
  ) as Record<CharacterQuality, number>;
}

export function computeCaptureFinalChance(
  scrollChance: number,
  quality: CharacterQuality,
): number {
  return clampCaptureChance(scrollChance * captureModifierForQuality(quality));
}

export const CAPTURE_QUALITY_ORDER: readonly CharacterQuality[] = CHARACTER_QUALITIES;
