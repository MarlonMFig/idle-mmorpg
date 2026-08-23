import {
  SEALING_SCROLL_ITEM_ID,
  SEALING_SCROLL_PRICE,
  SHOP_CURRENCY_ITEM_ID,
} from '@/constants/sealing';
import {
  HELPER_SHOP_PRICES,
  HP_POTION_CONCENTRATED_ITEM_ID,
  HP_POTION_ITEM_ID,
  HP_POTION_ULTRA_ITEM_ID,
  REVIVE_ITEM_ID,
} from '@/data/helper-items';
import { getItem } from '@/data/items';
import type { ItemRarity } from '@/types/loot';
import type { ShopCategoryId, ShopOffer } from '@/types/shop';

/**
 * Catálogo da Loja (Item 30).
 * Preços marcados provisionalPrice = BALANCEAMENTO PROVISÓRIO.
 * Nome/ícone/raridade vêm do Item Registry.
 */
export const SHOP_OFFERS: readonly ShopOffer[] = [
  // —— Consumíveis ——
  {
    id: 'offer-hp-potion',
    itemId: HP_POTION_ITEM_ID,
    category: 'consumables',
    currency: 'copper',
    price: HELPER_SHOP_PRICES[HP_POTION_ITEM_ID],
    quantityPerPurchase: 1,
    purchaseLimit: null,
    resetType: 'none',
    stock: null,
    provisionalPrice: true,
  },
  {
    id: 'offer-hp-potion-ultra',
    itemId: HP_POTION_CONCENTRATED_ITEM_ID,
    category: 'consumables',
    currency: 'copper',
    price: HELPER_SHOP_PRICES[HP_POTION_CONCENTRATED_ITEM_ID],
    quantityPerPurchase: 1,
    purchaseLimit: null,
    resetType: 'none',
    stock: null,
    provisionalPrice: true,
  },
  {
    id: 'offer-hp-potion-ultra-concentrada',
    itemId: HP_POTION_ULTRA_ITEM_ID,
    category: 'consumables',
    currency: 'copper',
    price: HELPER_SHOP_PRICES[HP_POTION_ULTRA_ITEM_ID],
    quantityPerPurchase: 1,
    purchaseLimit: null,
    resetType: 'none',
    stock: null,
    provisionalPrice: true,
  },
  {
    id: 'offer-revive',
    itemId: REVIVE_ITEM_ID,
    category: 'consumables',
    currency: 'copper',
    price: HELPER_SHOP_PRICES[REVIVE_ITEM_ID],
    quantityPerPurchase: 1,
    purchaseLimit: null,
    resetType: 'none',
    stock: null,
    provisionalPrice: true,
  },
  // —— Pergaminhos ——
  {
    id: 'offer-sealing-scroll',
    itemId: SEALING_SCROLL_ITEM_ID,
    category: 'scrolls',
    currency: 'copper',
    price: SEALING_SCROLL_PRICE,
    quantityPerPurchase: 1,
    purchaseLimit: null,
    resetType: 'none',
    stock: null,
    provisionalPrice: true,
  },
  {
    id: 'offer-sealing-scroll-rare',
    itemId: 'item-sealing-scroll-rare',
    category: 'scrolls',
    currency: 'copper',
    price: SEALING_SCROLL_PRICE * 3,
    quantityPerPurchase: 1,
    purchaseLimit: null,
    resetType: 'none',
    stock: null,
    provisionalPrice: true,
  },
  {
    id: 'offer-sealing-scroll-epic',
    itemId: 'item-sealing-scroll-epic',
    category: 'scrolls',
    currency: 'copper',
    price: SEALING_SCROLL_PRICE * 8,
    quantityPerPurchase: 1,
    purchaseLimit: null,
    resetType: 'none',
    stock: null,
    provisionalPrice: true,
  },
  {
    id: 'offer-sealing-scroll-legendary',
    itemId: 'item-sealing-scroll-legendary',
    category: 'scrolls',
    currency: 'copper',
    price: SEALING_SCROLL_PRICE * 20,
    quantityPerPurchase: 1,
    purchaseLimit: 3,
    resetType: 'daily',
    stock: null,
    provisionalPrice: true,
  },
  // —— Especiais (Anime Coins — conveniência, não P2W) ——
  {
    id: 'offer-special-potion-pack',
    itemId: HP_POTION_ITEM_ID,
    category: 'specials',
    currency: 'animeCoins',
    price: 5,
    quantityPerPurchase: 5,
    purchaseLimit: 1,
    resetType: 'daily',
    stock: null,
    provisionalPrice: true,
    requireConfirm: true,
    description: 'Pacote de 5 Poções (conveniência diária). BALANCEAMENTO PROVISÓRIO.',
  },
  // —— Materiais (itens já existentes; 1 oferta weekly para ciclo) ——
  {
    id: 'offer-material-bandagem',
    itemId: 'item-anime-naruto-bandagem',
    category: 'materials',
    currency: 'copper',
    price: 20,
    quantityPerPurchase: 1,
    purchaseLimit: 5,
    resetType: 'weekly',
    stock: null,
    provisionalPrice: true,
  },
];

/** @deprecated Alias — currency item id for copper offers. */
export function offerCurrencyItemId(offer: ShopOffer): string {
  return offer.currency === 'copper' ? SHOP_CURRENCY_ITEM_ID : 'anime-coins';
}

/** Proporção do preço de compra ao vender de volta à loja. */
export const SHOP_BUYBACK_RATIO = 0.4;

/**
 * Preços de venda NPC — materiais Naruto (cobre unitário).
 * Não rebalanceados neste item.
 */
export const NARUTO_NPC_SELL_PRICES: Readonly<Record<string, number>> = {
  'item-anime-naruto-bandagem': 5,
  'item-anime-naruto-shuriken': 6,
  'item-anime-naruto-kunai-gasta': 8,
  'item-anime-naruto-fio-aco': 10,
  'item-anime-naruto-papel-bomba': 15,
  'item-anime-naruto-pilula-soldado': 18,
  'item-anime-naruto-bandana-riscada': 22,
  'item-anime-naruto-racao-militar': 40,
  'item-anime-naruto-pergaminho-basico': 45,
  'item-anime-naruto-bolsa-shuriken': 55,
  'item-anime-naruto-papel-chakra': 70,
  'item-anime-naruto-colete-tatico': 220,
  'item-anime-naruto-tanto': 260,
  'item-anime-naruto-pergaminho-selamento': 300,
  'item-anime-naruto-mascara-anbu': 320,
  'item-anime-naruto-livro-bingo': 380,
  'item-anime-naruto-fuma-shuriken': 400,
  'item-anime-naruto-frasco-veneno': 950,
  'item-anime-naruto-casulo-insetos': 1_000,
  'item-anime-naruto-peca-marionete': 1_100,
  'item-anime-naruto-cabaca-areia': 1_400,
  'item-anime-naruto-selo-elemental': 1_600,
  'item-anime-naruto-lente-ocular': 1_800,
  'item-anime-naruto-presa-ninken': 5_000,
  'item-anime-naruto-fragmento-bestial': 7_500,
  'item-anime-naruto-contrato-invocacao': 8_000,
  'item-anime-naruto-nucleo-chakra': 9_000,
  'item-anime-naruto-pergaminho-proibido': 40_000,
};

const SELL_PRICE_BY_RARITY: Record<ItemRarity, number> = {
  common: 5,
  uncommon: 40,
  rare: 220,
  epic: 950,
  legendary: 5_000,
  mythic: 40_000,
};

export function listShopOffers(): readonly ShopOffer[] {
  return SHOP_OFFERS;
}

export function listShopOffersByCategory(category: ShopCategoryId): readonly ShopOffer[] {
  return SHOP_OFFERS.filter((o) => o.category === category);
}

export function getShopOffer(offerId: string): ShopOffer | undefined {
  return SHOP_OFFERS.find((offer) => offer.id === offerId);
}

export function getShopOfferByItemId(itemId: string): ShopOffer | undefined {
  return SHOP_OFFERS.find((offer) => offer.itemId === itemId && offer.currency === 'copper');
}

export function getOfferDisplayName(offer: ShopOffer): string {
  if (offer.name?.trim()) return offer.name;
  return getItem(offer.itemId)?.name ?? offer.itemId;
}

/**
 * Valor de venda NPC oficial.
 * `sellValue` no item prevalece; senão tabela Naruto / buyback / raridade.
 * Não rebalanceado neste item.
 */
export function getItemSellValue(itemId: string): number {
  if (itemId === SHOP_CURRENCY_ITEM_ID) return 0;

  const def = getItem(itemId);
  if (def?.sellable === false) return 0;

  const defined = def?.sellValue;
  if (defined != null) return Math.max(0, Math.floor(defined));

  const tablePrice = NARUTO_NPC_SELL_PRICES[itemId];
  if (tablePrice != null) return tablePrice;

  const offer = getShopOfferByItemId(itemId);
  if (offer) {
    return Math.max(1, Math.floor(offer.price * SHOP_BUYBACK_RATIO));
  }

  if (!def) return 0;
  const base = SELL_PRICE_BY_RARITY[def.rarity] ?? 1;
  return base;
}

export function getNpcSellPrice(itemId: string): number {
  return getItemSellValue(itemId);
}

export function formatCopper(n: number): string {
  return n.toLocaleString('pt-BR');
}

/** Compat: currencyItemId em ofertas copper. */
export type { ShopOffer };
