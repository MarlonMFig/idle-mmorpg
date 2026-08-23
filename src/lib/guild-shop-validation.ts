/**
 * Validator Guild Shop (Item 45) — ofertas + anti buy/sell loop.
 */

import { getItem } from '@/data/items';
import { getItemSellValue } from '@/data/shop';
import { listGuildShopOffers } from '@/data/guild-shop';
import type { GuildShopOffer } from '@/types/guild-shop';

export function validateGuildShopCatalog(
  offers: readonly GuildShopOffer[] = listGuildShopOffers(),
): string[] {
  const warnings: string[] = [];
  const ids = new Set<string>();
  for (const offer of offers) {
    if (ids.has(offer.id)) warnings.push(`[GuildShop] offer id duplicado: ${offer.id}`);
    ids.add(offer.id);
    if (!getItem(offer.itemId)) {
      warnings.push(`[GuildShop] ${offer.id} itemId inválido: ${offer.itemId}`);
    }
    if (!(offer.price > 0) || !Number.isInteger(offer.price)) {
      warnings.push(`[GuildShop] ${offer.id} preço inválido`);
    }
    if (offer.currency !== 'copper' && offer.currency !== 'animeCoins') {
      warnings.push(`[GuildShop] ${offer.id} currency inválida`);
    }
    if (!(offer.guildLevelRequirement >= 1) || !Number.isInteger(offer.guildLevelRequirement)) {
      warnings.push(`[GuildShop] ${offer.id} guildLevelRequirement inválido`);
    }
    if (offer.purchaseLimit != null && offer.purchaseLimit <= 0) {
      warnings.push(`[GuildShop] ${offer.id} purchaseLimit inválido`);
    }
    if (offer.resetType !== 'none' && offer.resetType !== 'daily' && offer.resetType !== 'weekly') {
      warnings.push(`[GuildShop] ${offer.id} resetType inválido`);
    }
    if (offer.purchaseLimit != null && offer.resetType === 'none') {
      warnings.push(`[GuildShop] ${offer.id} limit sem reset`);
    }
    const sell = getItemSellValue(offer.itemId);
    const units = Math.max(1, offer.quantityPerPurchase);
    const buyPerUnit = offer.price / units;
    if (offer.currency === 'copper' && sell > 0 && sell >= buyPerUnit) {
      warnings.push(
        `[GuildShop] EXPLORATION RISK ${offer.id}: buy ${buyPerUnit}/u sell ${sell}/u`,
      );
    }
  }
  return warnings;
}

/** Throws if catalog has hard errors (missing item / bad price / loops). */
export function assertGuildShopCatalogSafe(): void {
  const warnings = validateGuildShopCatalog();
  const fatal = warnings.filter(
    (w) =>
      w.includes('inválido') ||
      w.includes('duplicado') ||
      w.includes('EXPLORATION'),
  );
  if (fatal.length > 0) {
    throw new Error(`Guild Shop catalog invalid:\n${fatal.join('\n')}`);
  }
}
