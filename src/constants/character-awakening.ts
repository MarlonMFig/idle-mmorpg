import { getMaxStarsForRarity } from '@/config/gameConfig';
import type { CharacterQuality } from '@/types/character-meta';

/**
 * Despertar da CharacterInstance — progressão avançada independente de
 * Level / Stars / Maestria.
 *
 * Requisitos (Item 18) ficam aqui. Rewards (Item 19) ficam em
 * `CharacterDefinition.awakeningConfig.rewards` / `CHARACTER_AWAKENING_CONFIGS`.
 *
 * Valores de Copper / itens / fragmentos abaixo são DEV, fáceis de alterar.
 * Não são economia definitiva.
 */

export const MAX_AWAKENING_LEVEL = 3;

export const AWAKENING_DEFAULT_LEVEL = 0;

/** Sem `awakeningConfig` no CharacterDefinition: ainda assim disponível (DEV). */
export const AWAKENING_ENABLED_WITHOUT_CONFIG = true;

/**
 * Placeholder de material. Nome NÃO é definitivo de design.
 * ID estável para config / inventário.
 */
export const AWAKENING_MATERIAL_ITEM_ID = 'item-awakening-material';

export const AWAKENING_ROMAN = ['0', 'I', 'II', 'III'] as const;

export type AwakeningLevel = 0 | 1 | 2 | 3;
export type AwakeningTargetLevel = 1 | 2 | 3;

export interface AwakeningItemCost {
  itemId: string;
  quantity: number;
}

/**
 * Requisitos para sair de `target - 1` e alcançar `target`.
 * Campos omitidos ou 0 = não exigidos.
 */
export interface AwakeningLevelRequirement {
  /** character.level >= requiredLevel */
  level?: number;
  /** Estrelas; o runtime recorta pelo teto da raridade. */
  stars?: number;
  /** Maestria como requisito — nunca consumida. */
  masteryLevel?: number;
  /** Cobre via Currency Engine (`item-copper-coin`). */
  copper?: number;
  /** Itens do registry oficial. */
  items?: readonly AwakeningItemCost[];
  /**
   * Quantidade de fragmentos daquele personagem
   * (`narutoFragmentItemId` / fallback genérico).
   */
  fragments?: number;
}

export type AwakeningRequirements = Record<AwakeningTargetLevel, AwakeningLevelRequirement>;

/**
 * Bônus percentuais derivados. Não escrevem em baseAttack/baseHP/baseDefense.
 * Chaves oficiais; valores 0.05 = +5%.
 */
export interface AwakeningStatPercents {
  attackPercent?: number;
  hpPercent?: number;
  defensePercent?: number;
  speedPercent?: number;
  accuracyPercent?: number;
  criticalPercent?: number;
}

/** Campos permitidos num Skill Override. Qualquer outra chave é inválida. */
export const AWAKENING_SKILL_OVERRIDE_KEYS = [
  'skillId',
  'slot',
  'damageMultiplier',
  'cooldownMs',
  'vfxId',
  'poseAnimationId',
  'executionType',
  'element',
  'statusEffects',
] as const;

export type AwakeningSkillSlot = 1 | 2 | 3 | 4;

/**
 * Override runtime da Skill base (não reescreve o arquivo).
 * Matching principal: `skillId`. `slot` é só lookup.
 */
export interface AwakeningSkillOverride {
  skillId: string;
  slot?: AwakeningSkillSlot;
  damageMultiplier?: number;
  cooldownMs?: number;
  vfxId?: string;
  poseAnimationId?: string;
  executionType?: 'single-hit' | 'multi-hit' | 'beam' | 'area' | 'persistent';
  element?: string;
  statusEffects?: readonly unknown[];
}

export interface AwakeningReward {
  stats?: AwakeningStatPercents;
  passiveId?: string;
  skillOverrides?: readonly AwakeningSkillOverride[];
  appearanceId?: string;
  skinId?: string;
  formId?: string;
  poseAnimationId?: string;
}

export type AwakeningRewards = Record<AwakeningTargetLevel, AwakeningReward>;

export interface CharacterAwakeningConfig {
  /** `false` = personagem sem Despertar. */
  enabled?: boolean;
  requirements?: Partial<AwakeningRequirements>;
  rewards?: Partial<AwakeningRewards>;
}

/** DEV — alterar aqui, não na UI. */
export const AWAKENING_REQUIREMENTS: AwakeningRequirements = {
  1: {
    level: 20,
    stars: 1,
    masteryLevel: 25,
    copper: 1_000,
    items: [{ itemId: AWAKENING_MATERIAL_ITEM_ID, quantity: 1 }],
  },
  2: {
    level: 50,
    stars: 2,
    masteryLevel: 50,
    copper: 5_000,
    items: [{ itemId: AWAKENING_MATERIAL_ITEM_ID, quantity: 3 }],
  },
  3: {
    level: 100,
    stars: 4,
    masteryLevel: 100,
    copper: 20_000,
    items: [{ itemId: AWAKENING_MATERIAL_ITEM_ID, quantity: 5 }],
    fragments: 10,
  },
};

export const AWAKENING_REWARDS: AwakeningRewards = {
  1: {},
  2: {},
  3: {},
};

export function clampAwakeningLevel(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return AWAKENING_DEFAULT_LEVEL;
  return Math.max(0, Math.min(MAX_AWAKENING_LEVEL, Math.floor(value)));
}

/** Nunca exige mais estrelas do que a raridade permite. */
export function getEffectiveStarRequirement(
  requiredStars: number | undefined,
  quality: CharacterQuality,
): number {
  const want = Math.max(0, Math.floor(requiredStars ?? 0));
  if (want <= 0) return 0;
  return Math.min(want, getMaxStarsForRarity(quality));
}

export function formatAwakeningRoman(level: number): string {
  const safe = clampAwakeningLevel(level);
  return AWAKENING_ROMAN[safe] ?? String(safe);
}
