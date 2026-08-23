/**
 * Catálogo Guild Shop (Item 45) — BALANCEAMENTO INICIAL / PROVISÓRIO.
 * Preços ≥ hub shop quando o item compete com a loja normal (não desvalorizar).
 * Itens exclusivos: preço > sellValue.
 * Sem Guild Coin. Contribution não é custo.
 */

import type { GuildShopOffer } from '@/types/guild-shop';
import { POTION_ITEM_IDS } from '@/config/gameConfig';
import { SEALING_SCROLL_ITEM_ID } from '@/constants/sealing';

/** BALANCEAMENTO INICIAL — 10 ofertas, Copper only. */
export const GUILD_SHOP_OFFERS: readonly GuildShopOffer[] = [
  {
    id: 'gshop-hp-potion',
    itemId: POTION_ITEM_IDS.normal,
    category: 'consumables',
    currency: 'copper',
    price: 45,
    quantityPerPurchase: 1,
    purchaseLimit: 5,
    resetType: 'daily',
    guildLevelRequirement: 1,
    stock: null,
    provisionalPrice: true,
  },
  {
    id: 'gshop-hp-concentrated',
    itemId: POTION_ITEM_IDS.concentrated,
    category: 'consumables',
    currency: 'copper',
    price: 130,
    quantityPerPurchase: 1,
    purchaseLimit: 3,
    resetType: 'daily',
    guildLevelRequirement: 2,
    stock: null,
    provisionalPrice: true,
  },
  {
    id: 'gshop-hp-ultra',
    itemId: POTION_ITEM_IDS.ultra,
    category: 'consumables',
    currency: 'copper',
    price: 320,
    quantityPerPurchase: 1,
    purchaseLimit: 2,
    resetType: 'daily',
    guildLevelRequirement: 4,
    stock: null,
    provisionalPrice: true,
  },
  {
    id: 'gshop-revive',
    itemId: POTION_ITEM_IDS.revive,
    category: 'consumables',
    currency: 'copper',
    price: 360,
    quantityPerPurchase: 1,
    purchaseLimit: 2,
    resetType: 'daily',
    guildLevelRequirement: 3,
    stock: null,
    provisionalPrice: true,
  },
  {
    id: 'gshop-seal-common',
    itemId: SEALING_SCROLL_ITEM_ID,
    category: 'scrolls',
    currency: 'copper',
    price: 28,
    quantityPerPurchase: 1,
    purchaseLimit: 10,
    resetType: 'daily',
    guildLevelRequirement: 1,
    stock: null,
    provisionalPrice: true,
  },
  {
    id: 'gshop-seal-rare',
    itemId: 'item-sealing-scroll-rare',
    category: 'scrolls',
    currency: 'copper',
    price: 80,
    quantityPerPurchase: 1,
    purchaseLimit: 3,
    resetType: 'daily',
    guildLevelRequirement: 3,
    stock: null,
    provisionalPrice: true,
  },
  {
    id: 'gshop-seal-epic',
    itemId: 'item-sealing-scroll-epic',
    category: 'scrolls',
    currency: 'copper',
    price: 210,
    quantityPerPurchase: 1,
    purchaseLimit: 3,
    resetType: 'weekly',
    guildLevelRequirement: 5,
    stock: null,
    provisionalPrice: true,
  },
  {
    id: 'gshop-bandagem',
    itemId: 'item-anime-naruto-bandagem',
    category: 'materials',
    currency: 'copper',
    price: 22,
    quantityPerPurchase: 1,
    purchaseLimit: 5,
    resetType: 'weekly',
    guildLevelRequirement: 1,
    stock: null,
    provisionalPrice: true,
  },
  {
    id: 'gshop-awakening',
    itemId: 'item-awakening-material',
    category: 'specials',
    currency: 'copper',
    price: 280,
    quantityPerPurchase: 1,
    purchaseLimit: 1,
    resetType: 'weekly',
    guildLevelRequirement: 5,
    stock: null,
    provisionalPrice: true,
  },
  {
    id: 'gshop-chakra-shard',
    itemId: 'item-chakra-shard',
    category: 'specials',
    currency: 'copper',
    price: 300,
    quantityPerPurchase: 1,
    purchaseLimit: 2,
    resetType: 'weekly',
    guildLevelRequirement: 7,
    stock: null,
    provisionalPrice: true,
  },
];

export function listGuildShopOffers(): readonly GuildShopOffer[] {
  return GUILD_SHOP_OFFERS;
}

export function getGuildShopOffer(offerId: string): GuildShopOffer | null {
  return GUILD_SHOP_OFFERS.find((o) => o.id === offerId) ?? null;
}
