import type { ItemCategory, ItemDefinition, ItemRarity } from '@/types/loot';
import { isItemRarity } from '@/types/loot';
import { ANIME_LOOT_ITEMS } from '@/data/anime-items';
import { HELPER_ITEM_DEFS } from '@/data/helper-items';
import { NARUTO_CHARACTER_LOOT, signatureItemIdsOf } from '@/data/naruto-loot-tiers';

/**
 * Catálogo de itens (Item 36 — sem Equipment).
 * Bandana / Amuleto preservados como drop/quest (não equipáveis).
 */
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
    iconSrc: '/ui/items/copper-coin.png',
    sellable: false,
    sellValue: 0,
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
  'item-awakening-material': {
    id: 'item-awakening-material',
    name: 'Material de Despertar (DEV)',
    rarity: 'rare',
    stackMax: 999,
    category: 'material',
  },
  /** Quest reward — colecionável / simbólico (não equipável). */
  'item-leaf-band': {
    id: 'item-leaf-band',
    name: 'Bandana da Folha',
    rarity: 'common',
    stackMax: 99,
    category: 'quest',
  },
  /** Loot drop — colecionável (não equipável). */
  'item-lucky-charm': {
    id: 'item-lucky-charm',
    name: 'Amuleto da Sorte',
    rarity: 'rare',
    stackMax: 99,
    category: 'material',
  },
  'item-sealing-scroll': {
    id: 'item-sealing-scroll',
    name: 'Cartão de Recrutamento',
    rarity: 'common',
    stackMax: 999999,
    iconSrc: '/ui/items/recruitment-cards/common.png',
    sellable: false,
    sellValue: 0,
  },
  'item-sealing-scroll-rare': {
    id: 'item-sealing-scroll-rare',
    name: 'Cartão de Recrutamento (Raro)',
    rarity: 'rare',
    stackMax: 999999,
    iconSrc: '/ui/items/recruitment-cards/rare.png',
    sellable: false,
    sellValue: 0,
  },
  'item-sealing-scroll-epic': {
    id: 'item-sealing-scroll-epic',
    name: 'Cartão de Recrutamento (Épico)',
    rarity: 'epic',
    stackMax: 999999,
    iconSrc: '/ui/items/recruitment-cards/epic.png',
    sellable: false,
    sellValue: 0,
  },
  'item-sealing-scroll-legendary': {
    id: 'item-sealing-scroll-legendary',
    name: 'Cartão de Recrutamento (Lendário)',
    rarity: 'legendary',
    stackMax: 999999,
    iconSrc: '/ui/items/recruitment-cards/legendary.png',
    sellable: false,
    sellValue: 0,
  },
  ...HELPER_ITEM_DEFS,
  ...ANIME_LOOT_ITEMS,
};

export type ItemId =
  | 'item-slime-gel'
  | 'item-copper-coin'
  | 'item-wolf-fang'
  | 'item-wood-scrap'
  | 'item-chakra-shard'
  | 'item-awakening-material'
  | 'item-leaf-band'
  | 'item-lucky-charm'
  | 'item-sealing-scroll'
  | 'item-sealing-scroll-rare'
  | 'item-sealing-scroll-epic'
  | 'item-sealing-scroll-legendary'
  | 'item-hp-potion'
  | 'item-hp-potion-ultra'
  | 'item-hp-potion-ultra-concentrada'
  | 'item-revive';

export const RARITY_COLOR: Record<ItemRarity, number> = {
  common: 0xb0b0b0,
  uncommon: 0x3ecf5a,
  rare: 0x3d8bfd,
  epic: 0xc45cff,
  legendary: 0xffb020,
  mythic: 0xff4d6d,
};

export const RARITY_CSS: Record<ItemRarity, string> = {
  common: '#b0b0b0',
  uncommon: '#3ecf5a',
  rare: '#3d8bfd',
  epic: '#c45cff',
  legendary: '#ffb020',
  mythic: '#ff4d6d',
};

export function getItem(itemId: string): ItemDefinition | undefined {
  return ITEMS[itemId];
}

export function getItemDefinition(itemId: string): ItemDefinition | undefined {
  return getItem(itemId);
}

export function listItemDefinitions(): ItemDefinition[] {
  return Object.values(ITEMS);
}

export function getItemStackLimit(itemId: string): number {
  return Math.max(1, getItem(itemId)?.stackMax ?? 1);
}

export function inferItemCategory(item: ItemDefinition): ItemCategory {
  if (item.category) return item.category;
  if (item.id === 'item-copper-coin') return 'currency';
  if (item.id.includes('sealing-scroll')) return 'scroll';
  if (item.id.includes('fragmento') || item.id.includes('fragment')) return 'fragment';
  if (item.id.includes('potion') || item.id.includes('revive') || item.id.includes('pocao')) {
    return 'consumable';
  }
  if (item.id.includes('quest')) return 'quest';
  return 'material';
}

function attachNarutoSignatureMetadata(): void {
  const byItem = new Map<string, string[]>();
  for (const [characterId, profile] of Object.entries(NARUTO_CHARACTER_LOOT)) {
    for (const itemId of signatureItemIdsOf(profile)) {
      const list = byItem.get(itemId) ?? [];
      list.push(characterId);
      byItem.set(itemId, list);
    }
  }
  for (const [itemId, characterIds] of byItem) {
    const item = ITEMS[itemId];
    if (!item) continue;
    ITEMS[itemId] = {
      ...item,
      signatureItem: true,
      lootRole: 'signature',
      associatedCharacterIds: characterIds,
    };
  }
}

attachNarutoSignatureMetadata();

export function validateItemRegistry(): string[] {
  const warnings: string[] = [];
  const seen = new Set<string>();
  for (const item of listItemDefinitions()) {
    if (seen.has(item.id)) warnings.push(`ID duplicado: ${item.id}`);
    seen.add(item.id);
    if (!isItemRarity(item.rarity)) warnings.push(`${item.id}: raridade inválida`);
    if (!Number.isFinite(item.stackMax) || item.stackMax < 1) {
      warnings.push(`${item.id}: stackLimit inválido`);
    }
    if (item.sellValue != null && item.sellValue < 0) {
      warnings.push(`${item.id}: sellValue negativo`);
    }
    if (item.iconSrc && !item.iconSrc.startsWith('/')) {
      warnings.push(`${item.id}: iconSrc deve ser caminho /public`);
    }
  }
  return warnings;
}
