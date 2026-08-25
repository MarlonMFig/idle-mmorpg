/**
 * ShopOffer (Item 30) — referência itemId; preço na oferta.
 */

import type { EconomyCurrencyId } from '@/types/economy';

export type ShopCategoryId = 'consumables' | 'scrolls' | 'materials' | 'specials';

export type ShopPurchaseLimitReset = 'none' | 'daily' | 'weekly' | 'lifetime';

export interface ShopOfferRequirements {
  playerLevel?: number;
  lineageRank?: number;
}

export interface ShopOffer {
  id: string;
  itemId: string;
  /** @deprecated Prefer resolver nome via Item Registry. Mantido para UI legada. */
  name?: string;
  description?: string;
  category: ShopCategoryId;
  currency: EconomyCurrencyId;
  price: number;
  quantityPerPurchase: number;
  purchaseLimit: number | null;
  resetType: ShopPurchaseLimitReset;
  requirements?: ShopOfferRequirements;
  /** Estoque infinito se null. */
  stock: number | null;
  /** Preparado: oferta com vários itens via Reward Service (não usado no catálogo inicial). */
  bundleRewards?: readonly { itemId: string; quantity: number }[];
  /** BALANCEAMENTO PROVISÓRIO */
  provisionalPrice?: boolean;
  /** Anime Coins: exige confirmação na UI. */
  requireConfirm?: boolean;
}

export const SHOP_CATEGORY_LABEL: Record<ShopCategoryId, string> = {
  consumables: 'Consumíveis',
  scrolls: 'Recrutamento',
  materials: 'Materiais',
  specials: 'Especiais',
};
