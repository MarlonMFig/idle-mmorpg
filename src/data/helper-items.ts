import type { ItemDefinition } from '@/types/loot';
import {
  listCaptureScrollTiers,
  type SealingScrollTierId,
} from '@/constants/sealing';
import {
  ITEM_STACK_LIMITS,
  POTION_ITEM_IDS,
  getPotionHealPercent,
} from '@/config/gameConfig';

/** Poção — cura percentual do HP máximo. */
export const HP_POTION_ITEM_ID = POTION_ITEM_IDS.normal;
/** Poção Concentrada — cura intermediária. O id antigo fica para não zerar inventários salvos. */
export const HP_POTION_CONCENTRATED_ITEM_ID = POTION_ITEM_IDS.concentrated;
/** Poção Ultra Concentrada — cura total. */
export const HP_POTION_ULTRA_ITEM_ID = POTION_ITEM_IDS.ultra;
/** Revive — necessário para Auto Revive. */
export const REVIVE_ITEM_ID = POTION_ITEM_IDS.revive;

export type HelperConsumableKind = 'heal-percent' | 'revive';

export interface HelperConsumableDef {
  kind: HelperConsumableKind;
  /** Fração do HP máximo (só heal-percent). */
  healPercent?: number;
}

/** Efeitos dos consumíveis do Helper (fonte: gameConfig.POTION_RULES). */
export const HELPER_CONSUMABLES: Readonly<Record<string, HelperConsumableDef>> = {
  [HP_POTION_ITEM_ID]: {
    kind: 'heal-percent',
    healPercent: getPotionHealPercent(HP_POTION_ITEM_ID),
  },
  [HP_POTION_CONCENTRATED_ITEM_ID]: {
    kind: 'heal-percent',
    healPercent: getPotionHealPercent(HP_POTION_CONCENTRATED_ITEM_ID),
  },
  [HP_POTION_ULTRA_ITEM_ID]: {
    kind: 'heal-percent',
    healPercent: getPotionHealPercent(HP_POTION_ULTRA_ITEM_ID),
  },
  [REVIVE_ITEM_ID]: { kind: 'revive' },
};

export const HELPER_POTION_IDS = [
  HP_POTION_ITEM_ID,
  HP_POTION_CONCENTRATED_ITEM_ID,
  HP_POTION_ULTRA_ITEM_ID,
] as const;

export type HelperPotionId = (typeof HELPER_POTION_IDS)[number];

export const HELPER_ITEM_DEFS: Record<string, ItemDefinition> = {
  [HP_POTION_ITEM_ID]: {
    id: HP_POTION_ITEM_ID,
    name: 'Poção',
    rarity: 'common',
    stackMax: ITEM_STACK_LIMITS.potion,
    iconSrc: '/ui/items/potions/pocao.png?v=2',
  },
  [HP_POTION_CONCENTRATED_ITEM_ID]: {
    id: HP_POTION_CONCENTRATED_ITEM_ID,
    name: 'Poção Concentrada',
    rarity: 'uncommon',
    stackMax: ITEM_STACK_LIMITS.potion,
    iconSrc: '/ui/items/potions/pocao-concentrada.png?v=2',
  },
  [HP_POTION_ULTRA_ITEM_ID]: {
    id: HP_POTION_ULTRA_ITEM_ID,
    name: 'Poção Ultra Concentrada',
    rarity: 'epic',
    stackMax: ITEM_STACK_LIMITS.potion,
    iconSrc: '/ui/items/potions/pocao-ultra-concentrada.png?v=2',
  },
  [REVIVE_ITEM_ID]: {
    id: REVIVE_ITEM_ID,
    name: 'Revive',
    rarity: 'rare',
    stackMax: ITEM_STACK_LIMITS.revive,
    iconSrc: '/ui/items/potions/revive.png?v=2',
  },
};

export function getHelperConsumable(itemId: string): HelperConsumableDef | undefined {
  return HELPER_CONSUMABLES[itemId];
}

export function isHelperPotion(itemId: string): itemId is HelperPotionId {
  return (HELPER_POTION_IDS as readonly string[]).includes(itemId);
}

export function isSealingScrollId(itemId: string): itemId is SealingScrollTierId {
  return listCaptureScrollTiers().some((t) => t.itemId === itemId);
}

/** Preços de compra no market (cobre). */
export const HELPER_SHOP_PRICES = {
  [HP_POTION_ITEM_ID]: 15,
  [HP_POTION_CONCENTRATED_ITEM_ID]: 80,
  [HP_POTION_ULTRA_ITEM_ID]: 500,
  [REVIVE_ITEM_ID]: 2000,
} as const;
