import type { EquipSlot, ItemDefinition, ItemRarity } from '@/types/loot';
import { formatModifierLine } from '@/utils/attributes';
import { WONSR_EQUIP_ITEMS } from '@/data/wonsr-equip-subset';

export const ITEMS: Record<string, ItemDefinition> = {
  'item-slime-gel': {
    id: 'item-slime-gel',
    name: 'Bandagem Usada',
    rarity: 'common',
    stackMax: 99,
  },
  'item-copper-coin': {
    id: 'item-copper-coin',
    name: 'Moeda de Cobre',
    rarity: 'common',
    stackMax: 999999,
  },
  'item-wolf-fang': {
    id: 'item-wolf-fang',
    name: 'Presa de Lobo',
    rarity: 'uncommon',
    stackMax: 50,
  },
  'item-wood-scrap': {
    id: 'item-wood-scrap',
    name: 'Lasca de Madeira',
    rarity: 'common',
    stackMax: 99,
  },
  'item-chakra-shard': {
    id: 'item-chakra-shard',
    name: 'Fragmento de Chakra',
    rarity: 'rare',
    stackMax: 20,
  },
  'item-leaf-band': {
    id: 'item-leaf-band',
    name: 'Bandana da Folha',
    rarity: 'common',
    stackMax: 1,
    equipSlot: 'bandana',
    bonuses: { defense: 1, hp: 5, accuracy: 3 },
  },
  'item-kunai': {
    id: 'item-kunai',
    name: 'Kunai',
    rarity: 'uncommon',
    stackMax: 1,
    equipSlot: 'weapon',
    bonuses: { strength: 6, critical: 2 },
  },
  'item-flak-vest': {
    id: 'item-flak-vest',
    name: 'Roupa Shinobi',
    rarity: 'uncommon',
    stackMax: 1,
    equipSlot: 'clothing',
    bonuses: { defense: 4, hp: 15 },
  },
  'item-shinobi-gloves': {
    id: 'item-shinobi-gloves',
    name: 'Luvas Shinobi',
    rarity: 'common',
    stackMax: 1,
    equipSlot: 'gloves',
    bonuses: { strength: 2, defense: 1, accuracy: 2 },
  },
  'item-shinobi-boots': {
    id: 'item-shinobi-boots',
    name: 'Botas Shinobi',
    rarity: 'common',
    stackMax: 1,
    equipSlot: 'boots',
    bonuses: { defense: 2, speed: 15, hp: 5 },
  },
  'item-lucky-charm': {
    id: 'item-lucky-charm',
    name: 'Amuleto da Sorte',
    rarity: 'rare',
    stackMax: 1,
    equipSlot: 'accessory',
    bonuses: { strength: 3, hp: 10, critical: 5 },
  },
  'item-sealing-scroll': {
    id: 'item-sealing-scroll',
    name: 'Pergaminho de Selamento',
    rarity: 'uncommon',
    stackMax: 999,
  },
  ...Object.fromEntries(WONSR_EQUIP_ITEMS.map((item) => [item.id, item])),
};

/** Ids conhecidos do catálogo (fechado em compile-time quando possível). */
export type ItemId =
  | 'item-slime-gel'
  | 'item-copper-coin'
  | 'item-wolf-fang'
  | 'item-wood-scrap'
  | 'item-chakra-shard'
  | 'item-leaf-band'
  | 'item-kunai'
  | 'item-flak-vest'
  | 'item-shinobi-gloves'
  | 'item-shinobi-boots'
  | 'item-lucky-charm'
  | 'item-sealing-scroll'
  | `wonsr-item-${number}`;

export const RARITY_COLOR: Record<ItemRarity, number> = {
  common: 0xb0b0b0,
  uncommon: 0x3ecf5a,
  rare: 0x3d8bfd,
  epic: 0xc45cff,
};

export const RARITY_CSS: Record<ItemRarity, string> = {
  common: '#b0b0b0',
  uncommon: '#3ecf5a',
  rare: '#3d8bfd',
  epic: '#c45cff',
};

export function getItem(itemId: string): ItemDefinition | undefined {
  return ITEMS[itemId];
}

export function isEquippable(itemId: string): boolean {
  return getItem(itemId)?.equipSlot != null;
}

export function getEquipSlot(itemId: string): EquipSlot | undefined {
  return getItem(itemId)?.equipSlot;
}

/** Texto curto dos bônus para tooltip. */
export function formatItemBonuses(itemId: string): string {
  const bonuses = getItem(itemId)?.bonuses;
  if (!bonuses) return '';
  return formatModifierLine(bonuses);
}
