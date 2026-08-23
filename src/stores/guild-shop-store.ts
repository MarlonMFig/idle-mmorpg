/**
 * Guild Shop store (Item 45) — authorize (server) → spend → grant (client).
 */

import { getGuildShopOffer } from '@/data/guild-shop';
import { getItem } from '@/data/items';
import { economyService } from '@/lib/economy-service';
import { getGuildShopProvider, getGuildShopProviderId } from '@/lib/guild-shop-provider';
import { emitSystemMessage } from '@/lib/system-log';
import { createStore } from '@/stores/create-store';
import { guildStore } from '@/stores/guild-store';
import { inventoryStore } from '@/stores/inventory-store';
import type { GuildShopAuthorizeResult, GuildShopCatalogEntry } from '@/types/guild-shop';

interface GuildShopUiState {
  tick: number;
  entries: GuildShopCatalogEntry[];
  guildId: string | null;
  guildLevel: number;
  lastResult: string | null;
  error: string | null;
  busyOfferId: string | null;
}

const ui = createStore<GuildShopUiState>({
  tick: 0,
  entries: [],
  guildId: null,
  guildLevel: 0,
  lastResult: null,
  error: null,
  busyOfferId: null,
});

const buyInFlight = new Set<string>();

function bump(partial?: Partial<GuildShopUiState>): void {
  const cur = ui.getSnapshot();
  ui.setState({ ...cur, ...partial, tick: cur.tick + 1 });
}

function newTransactionId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `gshop-${crypto.randomUUID()}`;
  }
  return `gshop-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function provider() {
  return getGuildShopProvider();
}

function itemName(itemId: string): string {
  return getItem(itemId)?.name ?? itemId;
}

/**
 * Facade Guild Shop.
 * Flow: afford+remaining check → authorize (limit++) → spendCurrency → addItem (refund spend if fail).
 */
export const guildShopStore = {
  subscribe: ui.subscribe,
  getSnapshot: ui.getSnapshot,

  getProviderId(): string {
    return getGuildShopProviderId();
  },

  getEntries(): GuildShopCatalogEntry[] {
    return ui.getSnapshot().entries;
  },

  async refresh(): Promise<GuildShopCatalogEntry[]> {
    const playerId = guildStore.getSnapshot().playerId;
    if (!playerId) {
      bump({ entries: [], guildId: null, guildLevel: 0, error: 'Sem jogador.' });
      return [];
    }
    const copperBalance = economyService.getBalance('copper');
    try {
      const result = await provider().listCatalog({ playerId, copperBalance });
      bump({
        entries: result.entries,
        guildId: result.guildId ?? null,
        guildLevel: result.guildLevel ?? 0,
        error: result.ok ? null : result.reason ?? 'Falha ao listar loja.',
      });
      return result.entries;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Falha Guild Shop';
      bump({ error: msg, entries: [] });
      return [];
    }
  },

  async buy(offerId: string): Promise<{ ok: boolean; reason?: string }> {
    if (buyInFlight.has(offerId) || buyInFlight.has('*')) {
      return { ok: false, reason: 'Compra em andamento.' };
    }

    const playerId = guildStore.getSnapshot().playerId;
    const nickname = guildStore.getSnapshot().nickname ?? 'Jogador';
    if (!playerId) {
      emitSystemMessage('Sem jogador.');
      return { ok: false, reason: 'Sem jogador.' };
    }

    const offer = getGuildShopOffer(offerId);
    if (!offer) {
      emitSystemMessage('Oferta inválida.');
      return { ok: false, reason: 'Oferta inválida.' };
    }

    // 1) Client checks afford + local remaining first
    const local = ui.getSnapshot().entries.find((e) => e.offer.id === offerId);
    if (local && !local.unlocked) {
      const msg = `Guild Level insuficiente (requer ${offer.guildLevelRequirement}).`;
      emitSystemMessage(msg);
      bump({ lastResult: msg });
      return { ok: false, reason: msg };
    }
    if (local?.remaining != null && local.remaining <= 0) {
      const msg = 'Limite de compra atingido.';
      emitSystemMessage(msg);
      bump({ lastResult: msg });
      return { ok: false, reason: msg };
    }
    if (!economyService.canAfford(offer.currency, offer.price)) {
      const label = offer.currency === 'copper' ? 'Copper' : 'Anime Coins';
      const msg = `${label} insuficiente. Precisa de ${offer.price}.`;
      emitSystemMessage(msg);
      bump({ lastResult: msg });
      return { ok: false, reason: msg };
    }

    buyInFlight.add(offerId);
    buyInFlight.add('*');
    bump({ busyOfferId: offerId, error: null });

    try {
      const transactionId = newTransactionId();

      // 2) authorizePurchase (server increments limit)
      const auth: GuildShopAuthorizeResult = await provider().authorizePurchase({
        playerId,
        nickname,
        offerId,
        transactionId,
      });

      if (!auth.ok) {
        emitSystemMessage(auth.reason ?? 'Compra negada.');
        bump({ lastResult: auth.reason ?? 'Compra negada.' });
        await this.refresh();
        return { ok: false, reason: auth.reason };
      }

      if (auth.alreadyProcessed) {
        await this.refresh();
        return { ok: true };
      }

      // 3) spendCurrency
      if (
        !economyService.spendCurrency(offer.currency, offer.price, 'guildShopPurchase', {
          offerId,
          itemId: offer.itemId,
          quantity: offer.quantityPerPurchase,
          transactionId,
        })
      ) {
        // Limit already consumed on server — acceptable rare race
        const msg = 'Saldo insuficiente após autorização.';
        emitSystemMessage(msg);
        bump({ lastResult: msg });
        await this.refresh();
        return { ok: false, reason: msg };
      }

      // 4) inventory grant; refund spend if fail (limit already used — rare)
      const leftover = inventoryStore.addItem(
        offer.itemId,
        offer.quantityPerPurchase,
        'unknown',
      );
      if (leftover > 0) {
        if (leftover < offer.quantityPerPurchase) {
          inventoryStore.removeItem(offer.itemId, offer.quantityPerPurchase - leftover);
        }
        economyService.grantCurrency(offer.currency, offer.price, 'guildShopPurchase', {
          refund: true,
          offerId,
          transactionId,
        });
        const msg = 'Inventário cheio — moeda reembolsada (limite já consumido).';
        emitSystemMessage(msg);
        bump({ lastResult: msg });
        await this.refresh();
        return { ok: false, reason: msg };
      }

      // 5) refresh catalog
      const name = itemName(offer.itemId);
      const message = `Comprou ${offer.quantityPerPurchase}× ${name} (Guild Shop).`;
      emitSystemMessage(message);
      bump({ lastResult: message });
      await this.refresh();
      return { ok: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Falha na compra.';
      emitSystemMessage(msg);
      bump({ error: msg, lastResult: msg });
      return { ok: false, reason: msg };
    } finally {
      buyInFlight.delete(offerId);
      buyInFlight.delete('*');
      bump({ busyOfferId: null });
    }
  },

  /** DEV */
  async resetPurchaseLimit(offerId?: string): Promise<void> {
    const playerId = guildStore.getSnapshot().playerId;
    if (!playerId) return;
    const p = provider();
    if (typeof p.resetPurchaseLimit === 'function') {
      await p.resetPurchaseLimit(playerId, offerId);
    }
    await this.refresh();
  },

  /** DEV — only local provider honors mock guild level. */
  async setMockGuildLevel(level: number | null): Promise<void> {
    const p = provider();
    if (typeof p.setMockGuildLevel === 'function') {
      await p.setMockGuildLevel(level);
    }
    await this.refresh();
  },
};
