/**
 * Item 45 — Guild Shop local provider (DEV).
 * Membership/level via local guild provider; limits by playerId+offerId+cycleId.
 */

import { getGuildShopOffer, listGuildShopOffers } from '@/data/guild-shop';
import { getLocalGuildProvider } from '@/lib/guild-local-provider';
import { getDailyCycleId, getWeeklyCycleId } from '@/lib/mission-cycle';
import type {
  GuildShopAuthorizeResult,
  GuildShopCatalogEntry,
  GuildShopOffer,
  GuildShopProvider,
  GuildShopPurchaseLimitReset,
} from '@/types/guild-shop';

const STORAGE_KEY = 'idle-mmorpg:guild-shop-v1';

type PurchaseKey = string; // playerId|offerId|cycleId

interface PersistedState {
  purchases: Record<PurchaseKey, number>;
  transactions: Record<
    string,
    { playerId: string; offerId: string; cycleId: string; price: number; quantity: number }
  >;
}

function purchaseKey(playerId: string, offerId: string, cycleId: string): PurchaseKey {
  return `${playerId}|${offerId}|${cycleId}`;
}

function cycleIdForOffer(resetType: GuildShopPurchaseLimitReset): string {
  if (resetType === 'none') return '';
  if (resetType === 'weekly') return getWeeklyCycleId();
  return getDailyCycleId();
}

function newTxId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `gshop-${crypto.randomUUID()}`;
  }
  return `gshop-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildEntry(
  offer: GuildShopOffer,
  guildLevel: number,
  bought: number,
  copperBalance: number,
): GuildShopCatalogEntry {
  const cycleId = cycleIdForOffer(offer.resetType);
  const unlocked = guildLevel >= offer.guildLevelRequirement;
  const remaining =
    offer.purchaseLimit == null ? null : Math.max(0, offer.purchaseLimit - bought);
  return {
    offer,
    guildLevel,
    unlocked,
    bought,
    remaining,
    cycleId,
    canAfford: copperBalance >= offer.price,
  };
}

export class LocalGuildShopProvider implements GuildShopProvider {
  readonly id = 'local-mock';
  private purchases = new Map<PurchaseKey, number>();
  private transactions = new Map<
    string,
    { playerId: string; offerId: string; cycleId: string; price: number; quantity: number }
  >();
  private loaded = false;
  private forceFail = false;
  /** DEV: override guild level for catalog/authorize (null = use real guild). */
  private mockGuildLevel: number | null = null;

  setForceFail(fail: boolean): void {
    this.forceFail = fail;
  }

  async setMockGuildLevel(level: number | null): Promise<void> {
    this.mockGuildLevel = level == null ? null : Math.max(1, Math.floor(level));
  }

  private assertReady(): void {
    if (this.forceFail) throw new Error('Guild Shop provider indisponível');
  }

  private ensureLoaded(): void {
    if (this.loaded) return;
    this.loaded = true;
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as PersistedState;
      if (parsed.purchases) {
        for (const [k, v] of Object.entries(parsed.purchases)) {
          if (typeof v === 'number') this.purchases.set(k, v);
        }
      }
      if (parsed.transactions) {
        for (const [id, tx] of Object.entries(parsed.transactions)) {
          if (tx?.playerId && tx.offerId) this.transactions.set(id, tx);
        }
      }
    } catch {
      // ignore
    }
  }

  private persist(): void {
    if (typeof window === 'undefined') return;
    try {
      const state: PersistedState = {
        purchases: Object.fromEntries(this.purchases),
        transactions: Object.fromEntries(this.transactions),
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  }

  private resolveGuild(playerId: string): { guildId: string; level: number } | null {
    const provider = getLocalGuildProvider();
    const guildId = provider.findGuildIdByPlayer(playerId);
    if (!guildId) return null;
    const g = provider.listAll().find((x) => x.id === guildId);
    const realLevel = g?.level ?? 1;
    const level = this.mockGuildLevel ?? realLevel;
    return { guildId, level };
  }

  private getBought(playerId: string, offerId: string, cycleId: string): number {
    return this.purchases.get(purchaseKey(playerId, offerId, cycleId)) ?? 0;
  }

  async listCatalog(input: {
    playerId: string;
    copperBalance: number;
  }): Promise<{
    ok: boolean;
    reason?: string;
    guildId?: string | null;
    guildLevel?: number;
    entries: GuildShopCatalogEntry[];
  }> {
    this.assertReady();
    this.ensureLoaded();
    const resolved = this.resolveGuild(input.playerId);
    if (!resolved) {
      return { ok: false, reason: 'Sem Guild.', guildId: null, guildLevel: 0, entries: [] };
    }
    const entries = listGuildShopOffers().map((offer) => {
      const cycleId = cycleIdForOffer(offer.resetType);
      const bought = this.getBought(input.playerId, offer.id, cycleId);
      return buildEntry(offer, resolved.level, bought, input.copperBalance);
    });
    return {
      ok: true,
      guildId: resolved.guildId,
      guildLevel: resolved.level,
      entries,
    };
  }

  async authorizePurchase(input: {
    playerId: string;
    nickname: string;
    offerId: string;
    transactionId: string;
  }): Promise<GuildShopAuthorizeResult> {
    this.assertReady();
    this.ensureLoaded();
    const { playerId, offerId, transactionId } = input;
    if (!transactionId.trim()) return { ok: false, reason: 'transactionId obrigatório.' };

    const offer = getGuildShopOffer(offerId);
    if (!offer) return { ok: false, reason: 'Oferta inexistente.' };

    const cycleId = cycleIdForOffer(offer.resetType);
    const fields = {
      transactionId,
      offerId: offer.id,
      itemId: offer.itemId,
      quantity: offer.quantityPerPurchase,
      currency: offer.currency,
      price: offer.price,
    };

    const existing = this.transactions.get(transactionId);
    if (existing) {
      if (existing.playerId !== playerId) {
        return { ok: false, reason: 'transactionId de outro jogador.' };
      }
      return { ok: true, alreadyProcessed: true, ...fields };
    }

    const resolved = this.resolveGuild(playerId);
    if (!resolved) return { ok: false, reason: 'Sem Guild.' };

    // Re-check membership (race with leave)
    const still = getLocalGuildProvider().findGuildIdByPlayer(playerId);
    if (!still || still !== resolved.guildId) {
      return { ok: false, reason: 'Você não é membro desta Guild.' };
    }

    if (resolved.level < offer.guildLevelRequirement) {
      return {
        ok: false,
        reason: `Guild Level insuficiente (requer ${offer.guildLevelRequirement}).`,
      };
    }

    const bought = this.getBought(playerId, offer.id, cycleId);
    if (offer.purchaseLimit != null && bought >= offer.purchaseLimit) {
      return { ok: false, reason: 'Limite de compra atingido.' };
    }

    this.transactions.set(transactionId, {
      playerId,
      offerId: offer.id,
      cycleId,
      price: offer.price,
      quantity: offer.quantityPerPurchase,
    });
    this.purchases.set(purchaseKey(playerId, offer.id, cycleId), bought + 1);
    this.persist();

    return { ok: true, alreadyProcessed: false, ...fields };
  }

  async getPurchaseCount(input: {
    playerId: string;
    offerId: string;
  }): Promise<{ bought: number; cycleId: string; limit: number | null }> {
    this.assertReady();
    this.ensureLoaded();
    const offer = getGuildShopOffer(input.offerId);
    if (!offer) return { bought: 0, cycleId: '', limit: null };
    const cycleId = cycleIdForOffer(offer.resetType);
    return {
      bought: this.getBought(input.playerId, input.offerId, cycleId),
      cycleId,
      limit: offer.purchaseLimit ?? null,
    };
  }

  async resetPurchaseLimit(playerId: string, offerId?: string): Promise<void> {
    this.ensureLoaded();
    if (offerId) {
      for (const key of [...this.purchases.keys()]) {
        if (key.startsWith(`${playerId}|${offerId}|`)) this.purchases.delete(key);
      }
    } else {
      for (const key of [...this.purchases.keys()]) {
        if (key.startsWith(`${playerId}|`)) this.purchases.delete(key);
      }
    }
    this.persist();
  }

  /** Test helper — clear all in-memory state. */
  clearAll(): void {
    this.purchases.clear();
    this.transactions.clear();
    this.mockGuildLevel = null;
    this.persist();
  }
}

let singleton: LocalGuildShopProvider | null = null;

export function getLocalGuildShopProvider(): LocalGuildShopProvider {
  if (!singleton) singleton = new LocalGuildShopProvider();
  return singleton;
}

export function resetLocalGuildShopProvider(): void {
  singleton?.clearAll();
  singleton = null;
}

export { newTxId as newGuildShopTransactionId };
