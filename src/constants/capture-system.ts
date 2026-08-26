/**
 * Captura — etapa 1 (selar) lê capture-spec.json.
 * Etapa 2 (qualidade) é CONFIG.qualidades em raridade-potencial.js; não entra aqui.
 */

import captureSpec from '@/data/capture-spec.json';
import type { CharacterQuality } from '@/types/character-meta';
import { CHARACTER_QUALITIES } from '@/types/character-meta';
import { clampCaptureChance } from '@/constants/capture';
import type { SealingScrollTierId } from '@/constants/sealing';
import { CONFIG } from '@/lib/raridade-potencial.js';

export const CAPTURE_ENEMY_TIERS = ['comum', 'elite', 'raro', 'chefe'] as const;
export type CaptureEnemyTier = (typeof CAPTURE_ENEMY_TIERS)[number];

export const CAPTURE_ENEMY_TIER_LABELS: Record<CaptureEnemyTier, string> = {
  comum: 'Comum',
  elite: 'Elite',
  raro: 'Raro',
  chefe: 'Chefe',
};

const spec = captureSpec;

export const CAPTURE_CHANCE_CAP = spec.selarChance.teto;
export const CAPTURE_CHANCE_FLOOR = spec.selarChance.piso;

export const CAPTURE_BASE_BY_TIER: Record<CaptureEnemyTier, number> = {
  comum: spec.selarChance.basePorTier.comum,
  elite: spec.selarChance.basePorTier.elite,
  raro: spec.selarChance.basePorTier.raro,
  chefe: spec.selarChance.basePorTier.chefe,
};

const SCROLL_KEY: Record<SealingScrollTierId, keyof typeof spec.selarChance.multPorPergaminho> = {
  'item-sealing-scroll': 'basico',
  'item-sealing-scroll-rare': 'reforcado',
  'item-sealing-scroll-epic': 'superior',
  'item-sealing-scroll-legendary': 'mestre',
};

export const SCROLL_CAPTURE_MULTIPLIER: Record<SealingScrollTierId, number> = {
  'item-sealing-scroll': spec.selarChance.multPorPergaminho.basico,
  'item-sealing-scroll-rare': spec.selarChance.multPorPergaminho.reforcado,
  'item-sealing-scroll-epic': spec.selarChance.multPorPergaminho.superior,
  'item-sealing-scroll-legendary': spec.selarChance.multPorPergaminho.mestre,
};

export const APPEARANCE_WEIGHTS: Record<CharacterQuality, number> = Object.fromEntries(
  CONFIG.qualidades.map((row) => [row.id, row.peso]),
) as Record<CharacterQuality, number>;

export const SCROLL_CRAFT_PER_STEP = spec.scrollCraft.perStep;

export const QUALITY_SORTE = spec.qualidadePesos.sorte;

export function isCaptureEnemyTier(value: unknown): value is CaptureEnemyTier {
  return typeof value === 'string' && (CAPTURE_ENEMY_TIERS as readonly string[]).includes(value);
}

export function captureBaseChanceForTier(tier: CaptureEnemyTier): number {
  return CAPTURE_BASE_BY_TIER[tier] ?? CAPTURE_BASE_BY_TIER.comum;
}

export function scrollCaptureMultiplier(scrollId: string): number {
  const key = SCROLL_KEY[scrollId as SealingScrollTierId];
  if (!key) return spec.selarChance.multPorPergaminho.basico;
  return spec.selarChance.multPorPergaminho[key] ?? 1;
}

/** ETAPA 1 — selar. Qualidade não entra. */
export function computeCaptureChance(tier: CaptureEnemyTier, scrollId: string): number {
  const raw = captureBaseChanceForTier(tier) * scrollCaptureMultiplier(scrollId);
  const clamped = clampCaptureChance(raw);
  return Math.min(CAPTURE_CHANCE_CAP, Math.max(CAPTURE_CHANCE_FLOOR, clamped));
}

export function appearanceWeight(quality: CharacterQuality): number {
  return Math.max(0, APPEARANCE_WEIGHTS[quality] ?? 0);
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
