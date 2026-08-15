import type { ItemDefinition } from '@/types/loot';
import {
  SEALING_SCROLL_TIERS,
  type SealingScrollTierId,
} from '@/constants/sealing';

/** Poção — cura percentual do HP máximo. */
export const HP_POTION_ITEM_ID = 'item-hp-potion';
/** Poção Concentrada — cura intermediária. O id antigo fica para não zerar inventários salvos. */
export const HP_POTION_CONCENTRATED_ITEM_ID = 'item-hp-potion-ultra';
/** Poção Ultra Concentrada — cura total. */
export const HP_POTION_ULTRA_ITEM_ID = 'item-hp-potion-ultra-concentrada';
/** Revive — necessário para Auto Revive. */
export const REVIVE_ITEM_ID = 'item-revive';

export type HelperConsumableKind = 'heal-percent' | 'revive';

export interface HelperConsumableDef {
  kind: HelperConsumableKind;
  /** Fração do HP máximo (só heal-percent). */
  healPercent?: number;
}

/** Efeitos dos consumíveis do Helper (mapa paralelo ao catálogo). */
export const HELPER_CONSUMABLES: Readonly<Record<string, HelperConsumableDef>> = {
  [HP_POTION_ITEM_ID]: { kind: 'heal-percent', healPercent: 0.35 },
  [HP_POTION_CONCENTRATED_ITEM_ID]: { kind: 'heal-percent', healPercent: 0.7 },
  [HP_POTION_ULTRA_ITEM_ID]: { kind: 'heal-percent', healPercent: 1 },
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
    stackMax: 999,
    iconSrc: '/ui/items/potions/pocao.png',
  },
  [HP_POTION_CONCENTRATED_ITEM_ID]: {
    id: HP_POTION_CONCENTRATED_ITEM_ID,
    name: 'Poção Concentrada',
    rarity: 'uncommon',
    stackMax: 999,
    iconSrc: '/ui/items/potions/pocao-concentrada.png',
  },
  [HP_POTION_ULTRA_ITEM_ID]: {
    id: HP_POTION_ULTRA_ITEM_ID,
    name: 'Poção Ultra Concentrada',
    rarity: 'epic',
    stackMax: 999,
    iconSrc: '/ui/items/potions/pocao-ultra-concentrada.png',
  },
  [REVIVE_ITEM_ID]: {
    id: REVIVE_ITEM_ID,
    name: 'Revive',
    rarity: 'rare',
    stackMax: 99,
    iconSrc: '/ui/items/potions/revive.png',
  },
};

export function getHelperConsumable(itemId: string): HelperConsumableDef | undefined {
  return HELPER_CONSUMABLES[itemId];
}

export function isHelperPotion(itemId: string): itemId is HelperPotionId {
  return (HELPER_POTION_IDS as readonly string[]).includes(itemId);
}

export function isSealingScrollId(itemId: string): itemId is SealingScrollTierId {
  return SEALING_SCROLL_TIERS.some((t) => t.itemId === itemId);
}

/** Preços de compra no market (cobre). */
export const HELPER_SHOP_PRICES = {
  [HP_POTION_ITEM_ID]: 40,
  [HP_POTION_CONCENTRATED_ITEM_ID]: 120,
  [HP_POTION_ULTRA_ITEM_ID]: 300,
  [REVIVE_ITEM_ID]: 350,
} as const;
