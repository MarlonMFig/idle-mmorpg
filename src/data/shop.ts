import {
  SEALING_SCROLL_ITEM_ID,
  SEALING_SCROLL_PRICE,
  SHOP_CURRENCY_ITEM_ID,
} from '@/constants/sealing';
import {
  HELPER_SHOP_PRICES,
  HP_POTION_ITEM_ID,
  HP_POTION_ULTRA_ITEM_ID,
  REVIVE_ITEM_ID,
} from '@/data/helper-items';
import { getItem } from '@/data/items';
import type { ItemRarity } from '@/types/loot';

export interface ShopOffer {
  id: string;
  itemId: string;
  name: string;
  description: string;
  price: number;
  currencyItemId: string;
}

export const SHOP_OFFERS: readonly ShopOffer[] = [
  {
    id: 'offer-sealing-scroll',
    itemId: SEALING_SCROLL_ITEM_ID,
    name: 'Pergaminho de Selamento (Comum)',
    description: 'Chance de sealar ~90%. Consumido ao matar.',
    price: SEALING_SCROLL_PRICE,
    currencyItemId: SHOP_CURRENCY_ITEM_ID,
  },
  {
    id: 'offer-sealing-scroll-rare',
    itemId: 'item-sealing-scroll-rare',
    name: 'Pergaminho de Selamento (Raro)',
    description: 'Chance de selamento ~94%. Priorizado sobre o Comum.',
    price: SEALING_SCROLL_PRICE * 3,
    currencyItemId: SHOP_CURRENCY_ITEM_ID,
  },
  {
    id: 'offer-sealing-scroll-epic',
    itemId: 'item-sealing-scroll-epic',
    name: 'Pergaminho de Selamento (Épico)',
    description: 'Chance de selamento ~97%. Priorizado sobre Raro.',
    price: SEALING_SCROLL_PRICE * 8,
    currencyItemId: SHOP_CURRENCY_ITEM_ID,
  },
  {
    id: 'offer-sealing-scroll-legendary',
    itemId: 'item-sealing-scroll-legendary',
    name: 'Pergaminho de Selamento (Lendário)',
    description: 'Chance de selamento ~99%. Máxima prioridade de consumo.',
    price: SEALING_SCROLL_PRICE * 20,
    currencyItemId: SHOP_CURRENCY_ITEM_ID,
  },
  {
    id: 'offer-hp-potion',
    itemId: HP_POTION_ITEM_ID,
    name: 'Poção de HP',
    description: 'Cura ~35% do HP máximo. Usada pelo Auto Cura.',
    price: HELPER_SHOP_PRICES[HP_POTION_ITEM_ID],
    currencyItemId: SHOP_CURRENCY_ITEM_ID,
  },
  {
    id: 'offer-hp-potion-ultra',
    itemId: HP_POTION_ULTRA_ITEM_ID,
    name: 'Ultra Poção',
    description: 'Cura ~70% do HP máximo. Usada pelo Auto Cura.',
    price: HELPER_SHOP_PRICES[HP_POTION_ULTRA_ITEM_ID],
    currencyItemId: SHOP_CURRENCY_ITEM_ID,
  },
  {
    id: 'offer-revive',
    itemId: REVIVE_ITEM_ID,
    name: 'Revive',
    description: 'Necessário para Auto Revive ao desmaiar.',
    price: HELPER_SHOP_PRICES[REVIVE_ITEM_ID],
    currencyItemId: SHOP_CURRENCY_ITEM_ID,
  },
];

/** Proporção do preço de compra ao vender de volta à loja (pergaminhos de selamento). */
export const SHOP_BUYBACK_RATIO = 0.4;

/**
 * Preços de venda NPC — materiais Naruto (cobre unitário).
 * Fragmentos de personagem e demais itens usam fallback por raridade.
 */
export const NARUTO_NPC_SELL_PRICES: Readonly<Record<string, number>> = {
  // Comum
  'item-anime-naruto-bandagem': 5,
  'item-anime-naruto-shuriken': 6,
  'item-anime-naruto-kunai-gasta': 8,
  'item-anime-naruto-fio-aco': 10,
  'item-anime-naruto-papel-bomba': 15,
  'item-anime-naruto-pilula-soldado': 18,
  'item-anime-naruto-bandana-riscada': 22,
  // Incomum
  'item-anime-naruto-racao-militar': 40,
  'item-anime-naruto-pergaminho-basico': 45,
  'item-anime-naruto-bolsa-shuriken': 55,
  'item-anime-naruto-papel-chakra': 70,
  // Raro
  'item-anime-naruto-colete-tatico': 220,
  'item-anime-naruto-tanto': 260,
  'item-anime-naruto-pergaminho-selamento': 300,
  'item-anime-naruto-mascara-anbu': 320,
  'item-anime-naruto-livro-bingo': 380,
  'item-anime-naruto-fuma-shuriken': 400,
  // Épico
  'item-anime-naruto-frasco-veneno': 950,
  'item-anime-naruto-casulo-insetos': 1_000,
  'item-anime-naruto-peca-marionete': 1_100,
  'item-anime-naruto-cabaca-areia': 1_400,
  'item-anime-naruto-selo-elemental': 1_600,
  'item-anime-naruto-lente-ocular': 1_800,
  // Lendário
  'item-anime-naruto-presa-ninken': 5_000,
  'item-anime-naruto-fragmento-bestial': 7_500,
  'item-anime-naruto-contrato-invocacao': 8_000,
  'item-anime-naruto-nucleo-chakra': 9_000,
  // Mítico
  'item-anime-naruto-pergaminho-proibido': 40_000,
};

/** Fallback de venda por raridade (itens fora da tabela explícita). */
const SELL_PRICE_BY_RARITY: Record<ItemRarity, number> = {
  common: 5,
  uncommon: 40,
  rare: 220,
  epic: 950,
  legendary: 5_000,
  mythic: 40_000,
};

export function getShopOffer(offerId: string): ShopOffer | undefined {
  return SHOP_OFFERS.find((offer) => offer.id === offerId);
}

export function getShopOfferByItemId(itemId: string): ShopOffer | undefined {
  return SHOP_OFFERS.find((offer) => offer.itemId === itemId);
}

/** Preço unitário de venda ao mercado (0 = não vendável). */
export function getNpcSellPrice(itemId: string): number {
  if (itemId === SHOP_CURRENCY_ITEM_ID) return 0;

  const tablePrice = NARUTO_NPC_SELL_PRICES[itemId];
  if (tablePrice != null) return tablePrice;

  const offer = getShopOfferByItemId(itemId);
  if (offer) {
    return Math.max(1, Math.floor(offer.price * SHOP_BUYBACK_RATIO));
  }

  const def = getItem(itemId);
  if (!def) return 0;
  const base = SELL_PRICE_BY_RARITY[def.rarity] ?? 1;
  return def.equipSlot ? base * 3 : base;
}

export function formatCopper(n: number): string {
  return n.toLocaleString('pt-BR');
}
