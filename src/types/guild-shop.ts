/**
 * Guild Shop (Item 45) — extensão do Shop System para membros de Guild.
 * Sem Guild Coin. Limites por playerId (não guildId).
 */

import type { ShopCategoryId, ShopOffer, ShopPurchaseLimitReset } from '@/types/shop';
import type { EconomyCurrencyId } from '@/types/economy';

export interface GuildShopOfferRequirements {
  /** Guild Level mínimo (validado no backend). */
  guildLevel: number;
  /** Preparado — Contribution NÃO é custo; só requisito futuro. */
  minimumContribution?: number;
  playerLevel?: number;
}

/**
 * Oferta da Guild Shop — composição sobre ShopOffer + guildLevelRequirement.
 */
export interface GuildShopOffer extends Omit<ShopOffer, 'requirements' | 'stock' | 'resetType'> {
  guildLevelRequirement: number;
  requirements?: GuildShopOfferRequirements;
  /** Estoque coletivo global — NÃO usado neste item. */
  stock: null;
  resetType: GuildShopPurchaseLimitReset;
}

export type GuildShopPurchaseLimitReset = Extract<
  ShopPurchaseLimitReset,
  'none' | 'daily' | 'weekly'
>;

export interface GuildShopPurchaseBucket {
  offerId: string;
  cycleId: string;
  bought: number;
}

export interface GuildShopCatalogEntry {
  offer: GuildShopOffer;
  guildLevel: number;
  unlocked: boolean;
  bought: number;
  remaining: number | null;
  cycleId: string;
  canAfford: boolean;
}

export interface GuildShopAuthorizeResult {
  ok: boolean;
  reason?: string;
  alreadyProcessed?: boolean;
  transactionId?: string;
  offerId?: string;
  itemId?: string;
  quantity?: number;
  currency?: EconomyCurrencyId;
  price?: number;
  /** A compra já foi debitada e aplicada no save em nuvem. */
  serverApplied?: boolean;
}

export interface GuildShopProvider {
  readonly id: string;
  listCatalog(input: { playerId: string; copperBalance: number }): Promise<{
    ok: boolean;
    reason?: string;
    guildId?: string | null;
    guildLevel?: number;
    entries: GuildShopCatalogEntry[];
  }>;
  authorizePurchase(input: {
    playerId: string;
    nickname: string;
    offerId: string;
    transactionId: string;
  }): Promise<GuildShopAuthorizeResult>;
  getPurchaseCount(input: {
    playerId: string;
    offerId: string;
  }): Promise<{ bought: number; cycleId: string; limit: number | null }>;
  /** DEV */
  resetPurchaseLimit?(playerId: string, offerId?: string): Promise<void>;
  setMockGuildLevel?(level: number | null): Promise<void>;
  setForceFail?(fail: boolean): void;
}

export type { ShopCategoryId };
