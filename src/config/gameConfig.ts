import type { CharacterQuality } from '@/types/character-meta';
import { CHARACTER_QUALITIES } from '@/types/character-meta';

/**
 * Fonte única de regras globais (raridade, estrelas, stacks, poções, nível/XP).
 * Guild, VIP, captura e economia permanecem nos módulos atuais.
 */

export const RARITIES: Record<
  CharacterQuality,
  { id: CharacterQuality; label: string; color: string }
> = {
  D: { id: 'D', label: 'Comum', color: '#9aa3ad' },
  C: { id: 'C', label: 'Incomum', color: '#5fb85f' },
  B: { id: 'B', label: 'Raro', color: '#4a90d9' },
  A: { id: 'A', label: 'Épico', color: '#a86ede' },
  S: { id: 'S', label: 'Lendário', color: '#f0932b' },
  SS: { id: 'SS', label: 'Mítico', color: '#e34a4a' },
  SSS: { id: 'SSS', label: 'Supremo', color: '#e34a4a' },
};

export const STAR_RULES = {
  /** Teto oficial por raridade. Bônus continua +8% por estrela. */
  maxByRarity: {
    D: 2,
    C: 2,
    B: 3,
    A: 4,
    S: 4,
    SS: 5,
    SSS: 5,
  } satisfies Record<CharacterQuality, number>,
  starsOnUnlock: {
    D: 0,
    C: 0,
    B: 2,
    A: 2,
    S: 3,
    SS: 3,
    SSS: 3,
  } satisfies Record<CharacterQuality, number>,
  absoluteMax: 5,
} as const;

export const STAR_BONUSES = {
  /** +8% nos atributos base por estrela (0★ = base, 5★ = +40%). */
  perStar: 0.08,
} as const;

export interface XpStageBand {
  minLevel: number;
  maxLevel: number;
  multiplier: number;
}

/**
 * Curva oficial de progressão (independente da Hunt e das faixas WONSR).
 * xpRequired = floor(XP_BASE * level ^ XP_EXPONENT)
 */
export const LEVEL_RULES = {
  maxLevel: 9999,
  xpBase: 100,
  xpExponent: 1.65,
  minXpRequired: 1,
} as const;

export const XP_BASE = LEVEL_RULES.xpBase;
export const XP_EXPONENT = LEVEL_RULES.xpExponent;

/** Faixas WONSR — só o ganho de XP de combate (`applyStageXpGain`), não a XP necessária. */
export const LEVEL_XP_RANGES: readonly XpStageBand[] = [
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
];

export const MAX_PLAYER_LEVEL = LEVEL_RULES.maxLevel;

export const ITEM_STACK_LIMITS = {
  potion: 999,
  revive: 99,
} as const;

/** IDs reais já usados no inventário / localStorage — não alterar. */
export const POTION_ITEM_IDS = {
  normal: 'item-hp-potion',
  concentrated: 'item-hp-potion-ultra',
  ultra: 'item-hp-potion-ultra-concentrada',
  revive: 'item-revive',
} as const;

export const POTION_RULES = {
  [POTION_ITEM_IDS.normal]: { kind: 'heal-percent' as const, healPercent: 0.35 },
  [POTION_ITEM_IDS.concentrated]: { kind: 'heal-percent' as const, healPercent: 0.7 },
  [POTION_ITEM_IDS.ultra]: { kind: 'heal-percent' as const, healPercent: 1 },
  [POTION_ITEM_IDS.revive]: { kind: 'revive' as const },
} as const;

/** Cálculo de captura permanece em `src/constants/sealing.ts` até a próxima etapa. */
export const CAPTURE_RULES = {} as const;

export const GAME_LIMITS = {
  absoluteMaxStars: STAR_RULES.absoluteMax,
  maxPlayerLevel: MAX_PLAYER_LEVEL,
} as const;

export const gameConfig = {
  RARITIES,
  STAR_RULES,
  STAR_BONUSES,
  LEVEL_RULES,
  LEVEL_XP_RANGES,
  XP_BASE,
  XP_EXPONENT,
  MAX_PLAYER_LEVEL,
  ITEM_STACK_LIMITS,
  POTION_RULES,
  CAPTURE_RULES,
  GAME_LIMITS,
} as const;

export function getRarityLabel(rarity: CharacterQuality): string {
  return RARITIES[rarity]?.label ?? RARITIES.D.label;
}

export function getRarityColor(rarity: CharacterQuality): string {
  return RARITIES[rarity]?.color ?? RARITIES.D.color;
}

export const MAX_STARS_BY_RARITY = STAR_RULES.maxByRarity;

export function getMaxStarsForRarity(rarity: CharacterQuality): number {
  return MAX_STARS_BY_RARITY[rarity] ?? 0;
}

export function formatMaxStarsReachedMessage(rarity: CharacterQuality): string {
  const max = getMaxStarsForRarity(rarity);
  return `Este personagem alcançou o máximo de ${max}★ para a raridade ${getRarityLabel(rarity)}.`;
}

export function getStartingStarsForRarity(rarity: CharacterQuality): number {
  const cap = getMaxStarsForRarity(rarity);
  return Math.min(STAR_RULES.starsOnUnlock[rarity] ?? 0, cap);
}

export function starAttributeMultiplier(stars: number): number {
  const clamped = Math.max(0, Math.min(STAR_RULES.absoluteMax, Math.floor(stars)));
  return 1 + STAR_BONUSES.perStar * clamped;
}

export function getPotionHealPercent(itemId: string): number | undefined {
  const rule = (POTION_RULES as Record<string, { kind: string; healPercent?: number }>)[itemId];
  if (!rule || rule.kind !== 'heal-percent') return undefined;
  return rule.healPercent;
}

export function getConsumableStackMax(itemId: string): number {
  if (itemId === POTION_ITEM_IDS.revive) return ITEM_STACK_LIMITS.revive;
  if (itemId in POTION_RULES) return ITEM_STACK_LIMITS.potion;
  return ITEM_STACK_LIMITS.potion;
}

export const RARITY_ORDER: readonly CharacterQuality[] = CHARACTER_QUALITIES;
