/**
 * Sistema de captura (spec sistema-captura.md).
 * Chance de SELAR: base da quality de aparição × pergaminho, teto 90%.
 * Qualidade da instância após sucesso: CONFIG.qualidades (não este JSON).
 */

import captureSystemJson from '@/data/capture-system.json';
import type { CharacterQuality } from '@/types/character-meta';
import { CHARACTER_QUALITIES } from '@/types/character-meta';
import { clampCaptureChance } from '@/constants/capture';
import type { SealingScrollTierId } from '@/constants/sealing';
import { CONFIG } from '@/lib/raridade-potencial.js';

const spec = captureSystemJson;

export const CAPTURE_CHANCE_CAP = spec.captureChanceCap;

export const APPEARANCE_WEIGHTS: Record<CharacterQuality, number> = Object.fromEntries(
  CONFIG.qualidades.map((row) => [row.id, row.peso]),
) as Record<CharacterQuality, number>;

export const CAPTURE_BASE_CHANCE: Record<CharacterQuality, number> = {
  D: spec.captureBase.D,
  C: spec.captureBase.C,
  B: spec.captureBase.B,
  A: spec.captureBase.A,
  S: spec.captureBase.S,
  SS: spec.captureBase.SS,
  SSS: spec.captureBase.SSS,
};

export const ATTEMPTS_BEFORE_FLEE: Record<CharacterQuality, number> = {
  D: spec.attemptsBeforeFlee.D,
  C: spec.attemptsBeforeFlee.C,
  B: spec.attemptsBeforeFlee.B,
  A: spec.attemptsBeforeFlee.A,
  S: spec.attemptsBeforeFlee.S,
  SS: spec.attemptsBeforeFlee.SS,
  SSS: spec.attemptsBeforeFlee.SSS,
};

export const CONSOLATION_FRAGMENTS_MIN = spec.totalFail.consolationFragmentsMin;
export const CONSOLATION_FRAGMENTS_MAX = spec.totalFail.consolationFragmentsMax;
export const SCROLL_CRAFT_PER_STEP = spec.scrollCraft.perStep;

export const SCROLL_CAPTURE_MULTIPLIER: Record<SealingScrollTierId, number> = {
  'item-sealing-scroll': spec.scrollMultiplier['item-sealing-scroll'],
  'item-sealing-scroll-rare': spec.scrollMultiplier['item-sealing-scroll-rare'],
};

export function appearanceWeight(quality: CharacterQuality): number {
  return Math.max(0, APPEARANCE_WEIGHTS[quality] ?? 0);
}

export function captureBaseChance(quality: CharacterQuality): number {
  return CAPTURE_BASE_CHANCE[quality] ?? CAPTURE_BASE_CHANCE.D;
}

export function attemptsBeforeFlee(quality: CharacterQuality): number {
  return ATTEMPTS_BEFORE_FLEE[quality] ?? 3;
}

export function scrollCaptureMultiplier(scrollId: string): number {
  return SCROLL_CAPTURE_MULTIPLIER[scrollId as SealingScrollTierId] ?? 1;
}

export function computeCaptureChance(quality: CharacterQuality, scrollId: string): number {
  const raw = captureBaseChance(quality) * scrollCaptureMultiplier(scrollId);
  return Math.min(CAPTURE_CHANCE_CAP, clampCaptureChance(raw));
}

export function appearanceTotalWeight(): number {
  return CHARACTER_QUALITIES.reduce((sum, quality) => sum + appearanceWeight(quality), 0);
}

export function appearancePercents(): Record<CharacterQuality, number> {
  const total = appearanceTotalWeight();
  return Object.fromEntries(
    CHARACTER_QUALITIES.map((quality) => [
      quality,
      total > 0 ? (100 * appearanceWeight(quality)) / total : 0,
    ]),
  ) as Record<CharacterQuality, number>;
}
