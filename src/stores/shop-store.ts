import { createStore } from '@/stores/create-store';
import {
  getItemSellValue,
  getOfferDisplayName,
  getShopOffer,
  listShopOffers,
  listShopOffersByCategory,
  type ShopOffer,
} from '@/data/shop';
import { getItem } from '@/data/items';
import { emitSystemMessage } from '@/lib/system-log';
import { economyService } from '@/lib/economy-service';
import { emitItemSold, emitShopPurchaseCompleted } from '@/lib/economy-events';
import { isItemSellable } from '@/lib/economy-validation';
import { getDailyCycleId, getWeeklyCycleId } from '@/lib/mission-cycle';
import { inventoryStore } from '@/stores/inventory-store';
import { vitalsStore } from '@/stores/vitals-store';
import type { ShopCategoryId } from '@/types/shop';
import { SHOP_CATEGORY_LABEL } from '@/types/shop';

export type ShopTabId = 'buy' | 'sell';

export interface ShopPurchaseBucket {
  bought: number;
  resetCycleId: string | null;
}

export interface ShopState {
  isOpen: boolean;
  tab: ShopTabId;
  category: ShopCategoryId;
  lastResult: string | null;
  purchases: Record<string, ShopPurchaseBucket>;
  /** DEV: ignora requirements de nível. */
  forceEligible: boolean;
}

const store = createStore<ShopState>({
  isOpen: false,
  tab: 'buy',
  category: 'consumables',
  lastResult: null,
  purchases: {},
  forceEligible: false,
});

const purchaseInFlight = new Set<string>();

/** Bolsa sem teto de slots — só empilha no stackMax do item. */
function inventoryRoomFor(_itemId: string): number {
  return Number.MAX_SAFE_INTEGER;
}

function cycleForOffer(offer: ShopOffer): string | null {
  if (offer.resetType === 'none' || offer.resetType === 'lifetime') return null;
  if (offer.resetType === 'weekly') return getWeeklyCycleId();
  return getDailyCycleId();
}

function syncedBucket(offer: ShopOffer, previous?: ShopPurchaseBucket): ShopPurchaseBucket {
  const cycleId = cycleForOffer(offer);
  if (offer.resetType === 'lifetime') {
    return previous ?? { bought: 0, resetCycleId: 'lifetime' };
  }
  if (offer.resetType === 'none' || cycleId == null) {
    return { bought: 0, resetCycleId: null };
  }
  if (!previous || previous.resetCycleId !== cycleId) {
    return { bought: 0, resetCycleId: cycleId };
  }
  return previous;
}

function getBucket(offer: ShopOffer): ShopPurchaseBucket {
  return syncedBucket(offer, store.getSnapshot().purchases[offer.id]);
}

function setBucket(offerId: string, bucket: ShopPurchaseBucket): void {
  const state = store.getSnapshot();
  store.setState({
    ...state,
    purchases: { ...state.purchases, [offerId]: bucket },
  });
}

/**
 * Loja do hub — compra/venda via Economy Service.
 * Limites daily/weekly: getDailyCycleId / getWeeklyCycleId.
 */
export const shopStore = {
  subscribe: store.subscribe,
  getSnapshot: store.getSnapshot,

  reset(): void {
    store.setState({
      isOpen: false,
      tab: 'buy',
      category: 'consumables',
      lastResult: null,
      purchases: {},
      forceEligible: false,
    });
  },

  hydrate(partial: { purchases?: Record<string, ShopPurchaseBucket> | null }): void {
    if (!partial.purchases) return;
    store.setState({
      ...store.getSnapshot(),
      purchases: { ...partial.purchases },
    });
  },

  getPersistedPurchases(): Record<string, ShopPurchaseBucket> {
    return { ...store.getSnapshot().purchases };
  },

  toggleOpen(): void {
    const state = store.getSnapshot();
    store.setState({
      ...state,
      isOpen: !state.isOpen,
      lastResult: null,
      tab: state.isOpen ? state.tab : 'buy',
    });
  },

  setOpen(isOpen: boolean): void {
    store.setState({ ...store.getSnapshot(), isOpen, lastResult: null });
  },

  setTab(tab: ShopTabId): void {
    store.setState({ ...store.getSnapshot(), tab, lastResult: null });
  },

  setCategory(category: ShopCategoryId): void {
    store.setState({ ...store.getSnapshot(), category, lastResult: null });
  },

  listOffers(): readonly ShopOffer[] {
    return listShopOffers();
  },

  listOffersCurrentCategory(): readonly ShopOffer[] {
    return listShopOffersByCategory(store.getSnapshot().category);
  },

  categoryLabel(id: ShopCategoryId): string {
    return SHOP_CATEGORY_LABEL[id];
  },

  getPurchased(offerId: string): number {
    const offer = getShopOffer(offerId);
    if (!offer) return 0;
    return getBucket(offer).bought;
  },

  getRemainingLimit(offerId: string): number | null {
    const offer = getShopOffer(offerId);
    if (!offer || offer.purchaseLimit == null) return null;
    return Math.max(0, offer.purchaseLimit - getBucket(offer).bought);
  },

  maxAffordablePacks(offerId: string): number {
    const offer = getShopOffer(offerId);
    if (!offer) return 0;
    const balance = economyService.getBalance(offer.currency);
    const byFunds = Math.floor(balance / Math.max(1, offer.price));
    let capped = byFunds;
    const remaining = this.getRemainingLimit(offerId);
    if (remaining != null) capped = Math.min(capped, remaining);
    if (offer.stock != null) capped = Math.min(capped, Math.max(0, offer.stock));
    const room = inventoryRoomFor(offer.itemId);
    const perPack = Math.max(1, offer.quantityPerPurchase);
    let bundleExtra = 0;
    if (offer.bundleRewards?.length) {
      for (const row of offer.bundleRewards) {
        const need = Math.max(0, Math.floor(row.quantity));
        if (need <= 0) continue;
        const br = inventoryRoomFor(row.itemId);
        bundleExtra = Math.max(bundleExtra, Math.floor(br / need));
      }
    }
    const byStack = Math.floor(room / perPack);
    const byInv = offer.bundleRewards?.length ? Math.min(byStack, bundleExtra || byStack) : byStack;
    return Math.max(0, Math.min(capped, byInv));
  },

  isEligible(offer: ShopOffer): { ok: boolean; reason?: string } {
    if (store.getSnapshot().forceEligible) return { ok: true };
    const level = vitalsStore.getLevel();
    if (offer.requirements?.playerLevel != null && level < offer.requirements.playerLevel) {
      return { ok: false, reason: `Requer nível ${offer.requirements.playerLevel}` };
    }
    return { ok: true };
  },

  /** DEV — força elegibilidade de ofertas. */
  setForceEligible(force: boolean): void {
    store.setState({ ...store.getSnapshot(), forceEligible: force });
  },

  listSellable(): readonly { itemId: string; quantity: number; unitPrice: number }[] {
    const byId = new Map<string, number>();
    for (const slot of inventoryStore.getSnapshot().slots) {
      if (!slot) continue;
      byId.set(slot.itemId, (byId.get(slot.itemId) ?? 0) + slot.quantity);
    }
    const out: { itemId: string; quantity: number; unitPrice: number }[] = [];
    for (const [itemId, quantity] of byId) {
      if (!isItemSellable(itemId)) continue;
      const unitPrice = getItemSellValue(itemId);
      if (unitPrice <= 0) continue;
      out.push({ itemId, quantity, unitPrice });
    }
    out.sort((a, b) => {
      const na = getItem(a.itemId)?.name ?? a.itemId;
      const nb = getItem(b.itemId)?.name ?? b.itemId;
      return na.localeCompare(nb, 'pt-BR');
    });
    return out;
  },

  /**
   * Compra `packs` da oferta (cada pack entrega quantityPerPurchase itens).
   * Atômica + anti double-click.
   */
  buy(offerId: string, packs = 1): boolean {
    const offer = getShopOffer(offerId);
    const packCount = Math.floor(packs);
    if (!offer || packCount <= 0) return false;

    if (purchaseInFlight.has(offerId) || purchaseInFlight.has('*')) {
      emitSystemMessage('Compra em andamento…');
      return false;
    }

    const eligible = this.isEligible(offer);
    if (!eligible.ok) {
      emitSystemMessage(eligible.reason ?? 'Oferta bloqueada.');
      return false;
    }

    const remaining = this.getRemainingLimit(offerId);
    if (remaining != null && packCount > remaining) {
      emitSystemMessage(`Limite de compra atingido (${remaining} restantes).`);
      return false;
    }

    const totalCost = offer.price * packCount;
    const totalItems = offer.quantityPerPurchase * packCount;
    const name = getOfferDisplayName(offer);

    if (!economyService.canAfford(offer.currency, totalCost)) {
      const label = offer.currency === 'copper' ? 'Copper' : 'Anime Coins';
      emitSystemMessage(`${label} insuficiente. Precisa de ${totalCost}.`);
      store.setState({ ...store.getSnapshot(), lastResult: 'Sem saldo' });
      return false;
    }

    purchaseInFlight.add(offerId);
    purchaseInFlight.add('*');
    try {
      inventoryStore.repack();
      // Gasta primeiro; reembolsa se entrega falhar.
      if (!economyService.spendCurrency(offer.currency, totalCost, 'shopPurchase', {
        offerId,
        itemId: offer.itemId,
        quantity: totalItems,
      })) {
        emitSystemMessage('Saldo insuficiente.');
        return false;
      }

      const leftover = inventoryStore.addItem(offer.itemId, totalItems, 'unknown');
      if (leftover > 0) {
        economyService.grantCurrency(offer.currency, totalCost, 'shopPurchase', {
          refund: true,
          offerId,
        });
        if (leftover < totalItems) {
          inventoryStore.removeItem(offer.itemId, totalItems - leftover);
        }
        emitSystemMessage('Inventário cheio — moeda reembolsada.');
        store.setState({ ...store.getSnapshot(), lastResult: 'Inventário cheio' });
        return false;
      }

      if (offer.bundleRewards?.length) {
        for (const row of offer.bundleRewards) {
          const qty = Math.max(0, Math.floor(row.quantity)) * packCount;
          if (qty <= 0) continue;
          const left = inventoryStore.addItem(row.itemId, qty, 'unknown');
          if (left > 0) {
            // Reembolso total se bundle falhar parcialmente.
            inventoryStore.removeItem(offer.itemId, totalItems);
            for (const prev of offer.bundleRewards) {
              if (prev === row) break;
              inventoryStore.removeItem(prev.itemId, Math.floor(prev.quantity) * packCount);
            }
            if (left < qty) inventoryStore.removeItem(row.itemId, qty - left);
            economyService.grantCurrency(offer.currency, totalCost, 'shopPurchase', {
              refund: true,
              offerId,
              bundle: true,
            });
            emitSystemMessage('Inventário cheio (bundle) — moeda reembolsada.');
            return false;
          }
        }
      }

      if (offer.purchaseLimit != null) {
        const bucket = getBucket(offer);
        setBucket(offer.id, {
          bought: bucket.bought + packCount,
          resetCycleId: bucket.resetCycleId ?? cycleForOffer(offer),
        });
      }

      emitShopPurchaseCompleted({
        offerId: offer.id,
        currency: offer.currency,
        price: totalCost,
        itemId: offer.itemId,
        quantity: totalItems,
      });
      const message = `Comprou ${totalItems}× ${name}.`;
      emitSystemMessage(message);
      store.setState({ ...store.getSnapshot(), lastResult: message });
      return true;
    } finally {
      purchaseInFlight.delete(offerId);
      purchaseInFlight.delete('*');
    }
  },

  sell(itemId: string, quantity = 1): boolean {
    const qty = Math.floor(quantity);
    if (!isItemSellable(itemId) || qty <= 0) {
      emitSystemMessage('Item não vendável.');
      return false;
    }
    const unitPrice = getItemSellValue(itemId);
    if (unitPrice <= 0) return false;

    const def = getItem(itemId);
    if (purchaseInFlight.has('sell') || purchaseInFlight.has('*')) return false;
    purchaseInFlight.add('sell');
    purchaseInFlight.add('*');
    try {
      if (!inventoryStore.removeItem(itemId, qty)) {
        emitSystemMessage('Quantidade insuficiente.');
        return false;
      }
      const total = unitPrice * qty;
      economyService.grantCurrency('copper', total, 'shopSale', {
        itemId,
        quantity: qty,
        unitPrice,
      });
      emitItemSold({ itemId, quantity: qty, unitPrice, totalCopper: total });
      const message = `Vendeu ${qty}× ${def?.name ?? itemId} por ${total} cobre.`;
      emitSystemMessage(message);
      store.setState({ ...store.getSnapshot(), lastResult: message });
      return true;
    } finally {
      purchaseInFlight.delete('sell');
      purchaseInFlight.delete('*');
    }
  },

  /** Vende todos os stacks vendáveis de uma vez (mesmo critério de `listSellable`). */
  sellAll(): boolean {
    const entries = this.listSellable();
    if (entries.length === 0) {
      emitSystemMessage('Nada para vender.');
      return false;
    }
    if (purchaseInFlight.has('sell') || purchaseInFlight.has('*')) return false;
    purchaseInFlight.add('sell');
    purchaseInFlight.add('*');
    const removed: { itemId: string; quantity: number }[] = [];
    try {
      for (const entry of entries) {
        if (!inventoryStore.removeItem(entry.itemId, entry.quantity)) {
          for (const row of removed) {
            inventoryStore.addItem(row.itemId, row.quantity, 'unknown');
          }
          emitSystemMessage('Não foi possível vender todos os itens.');
          return false;
        }
        removed.push({ itemId: entry.itemId, quantity: entry.quantity });
      }

      let totalCopper = 0;
      let totalQty = 0;
      for (const entry of entries) {
        const line = entry.unitPrice * entry.quantity;
        totalCopper += line;
        totalQty += entry.quantity;
        emitItemSold({
          itemId: entry.itemId,
          quantity: entry.quantity,
          unitPrice: entry.unitPrice,
          totalCopper: line,
        });
      }

      economyService.grantCurrency('copper', totalCopper, 'shopSale', {
        bulk: true,
        quantity: totalQty,
        kinds: entries.length,
      });
      const message = `Vendeu ${totalQty} itens (${entries.length} tipos) por ${totalCopper} cobre.`;
      emitSystemMessage(message);
      store.setState({ ...store.getSnapshot(), lastResult: message });
      return true;
    } finally {
      purchaseInFlight.delete('sell');
      purchaseInFlight.delete('*');
    }
  },

  /** Compat VIP restock — mesma compra atômica. */
  buyForVipRestock(offerId: string, quantity: number): boolean {
    const offer = getShopOffer(offerId);
    if (!offer || offer.quantityPerPurchase !== 1) {
      // packs: quantity = packs
      return this.buy(offerId, quantity);
    }
    return this.buy(offerId, quantity);
  },

  devResetLimits(): void {
    store.setState({ ...store.getSnapshot(), purchases: {} });
  },
};
