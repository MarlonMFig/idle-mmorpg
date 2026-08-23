import { getItem } from '@/data/items';
import { getItemSellValue, listShopOffers } from '@/data/shop';
import type { ShopOffer } from '@/types/shop';

export function isItemSellable(itemId: string): boolean {
  const def = getItem(itemId);
  if (!def) return false;
  if (def.sellable === false) return false;
  return getItemSellValue(itemId) > 0;
}

/**
 * Detecta exploração buy low / sell high no catálogo.
 * Warning se sellReturn >= buyPrice (por unidade de item).
 */
export function validateShopEconomy(offers: readonly ShopOffer[] = listShopOffers()): string[] {
  const warnings: string[] = [];
  const ids = new Set<string>();
  for (const offer of offers) {
    if (ids.has(offer.id)) warnings.push(`[Shop] offer id duplicado: ${offer.id}`);
    ids.add(offer.id);
    if (!getItem(offer.itemId)) {
      warnings.push(`[Shop] ${offer.id} itemId inválido: ${offer.itemId}`);
    }
    if (!(offer.price > 0) || !Number.isInteger(offer.price)) {
      warnings.push(`[Shop] ${offer.id} preço inválido`);
    }
    if (offer.currency !== 'copper' && offer.currency !== 'animeCoins') {
      warnings.push(`[Shop] ${offer.id} currency inválida`);
    }
    if (offer.purchaseLimit != null && offer.purchaseLimit <= 0) {
      warnings.push(`[Shop] ${offer.id} purchaseLimit inválido`);
    }
    const sell = getItemSellValue(offer.itemId);
    const units = Math.max(1, offer.quantityPerPurchase);
    const buyPerUnit = offer.price / units;
    // Só cobre ↔ cobre (Anime Coins não vende em Copper 1:1)
    if (offer.currency === 'copper' && sell > 0 && sell >= buyPerUnit) {
      warnings.push(
        `[Economy] EXPLORATION RISK ${offer.id}: buy ${buyPerUnit}/u sell ${sell}/u (buy<=sell)`,
      );
    }
  }
  return warnings;
}
