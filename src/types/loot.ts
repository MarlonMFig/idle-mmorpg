import type { ItemBonuses } from '@/types/attributes';

export type { ItemBonuses } from '@/types/attributes';

export const ITEM_RARITIES = [
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary',
  'mythic',
] as const;

export type ItemRarity = (typeof ITEM_RARITIES)[number];

export const ITEM_RARITY_LABELS: Record<ItemRarity, string> = {
  common: 'Comum',
  uncommon: 'Incomum',
  rare: 'Raro',
  epic: 'Épico',
  legendary: 'Lendário',
  mythic: 'Mítico',
};

export const ITEM_CATEGORIES = [
  'currency',
  'material',
  'consumable',
  'scroll',
  'fragment',
  'quest',
  'special',
] as const;

export type ItemCategory = (typeof ITEM_CATEGORIES)[number];

export function isItemRarity(value: unknown): value is ItemRarity {
  return typeof value === 'string' && (ITEM_RARITIES as readonly string[]).includes(value);
}

export interface ItemDefinition {
  id: string;
  name: string;
  rarity: ItemRarity;
  /** Máximo por stack (`stackLimit` conceitual). */
  stackMax: number;
  category?: ItemCategory;
  /** Venda NPC unitária. Ausente = fallback oficial em getItemSellValue. */
  /** Se false, não aparece na venda NPC. Default: true quando sellValue resolvido > 0. */
  sellable?: boolean;
  sellValue?: number;
  /** Fragmento de personagem. */
  relatedCharacterId?: string;
  /** true se o item é Signature de pelo menos um personagem. */
  signatureItem?: boolean;
  lootRole?: 'signature' | 'generic';
  associatedCharacterIds?: string[];
  iconSrc?: string;
  /**
   * @deprecated Item 36 — Equipment removido. Campo ignorado se presente em dados legados.
   */
  bonuses?: ItemBonuses;
}

/**
 * Chance sempre em 0–1 (0.25 = 25%). quantityMin/Max = minQuantity/maxQuantity.
 * `rarity` nas entries é legado visual — o registry do item prevalece.
 */
export interface LootDropEntry {
  itemId: string;
  chance: number;
  quantityMin: number;
  quantityMax: number;
  rarity?: ItemRarity;
  minQuantity?: number;
  maxQuantity?: number;
}

export interface LootTable {
  id: string;
  entries: readonly LootDropEntry[];
}

export interface RewardItem {
  itemId: string;
  quantity: number;
}

export interface RewardResult {
  copper: number;
  items: RewardItem[];
}

export interface RolledLoot {
  itemId: string;
  name: string;
  quantity: number;
  rarity: ItemRarity;
  /** Origem técnica do roll (DEV / testes). Ausente = legado. */
  lootSource?: 'general' | 'secondary' | 'signature' | 'fragment';
}

export interface GroundLootData {
  id: string;
  itemId: string;
  name: string;
  quantity: number;
  rarity: ItemRarity;
  x: number;
  y: number;
}
