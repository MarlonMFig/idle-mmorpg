import { createStore } from '@/stores/create-store';
import {
  getNpcSellPrice,
  getShopOffer,
  SHOP_OFFERS,
  type ShopOffer,
} from '@/data/shop';
import { inventoryStore } from '@/stores/inventory-store';
import { emitSystemMessage } from '@/lib/system-log';
import { getItem } from '@/data/items';
import { SHOP_CURRENCY_ITEM_ID } from '@/constants/sealing';

export type ShopTabId = 'buy' | 'sell';

export interface ShopState {
  isOpen: boolean;
  tab: ShopTabId;
  lastResult: string | null;
}

const store = createStore<ShopState>({
  isOpen: false,
  tab: 'buy',
  lastResult: null,
});

/**
 * Loja do hub (Kuro) — compra e venda com moeda de cobre.
 */
export const shopStore = {
  subscribe: store.subscribe,
  getSnapshot: store.getSnapshot,

  reset(): void {
    store.setState({ isOpen: false, tab: 'buy', lastResult: null });
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
    const state = store.getSnapshot();
    store.setState({
      ...state,
      isOpen,
      lastResult: null,
    });
  },

  setTab(tab: ShopTabId): void {
    store.setState({ ...store.getSnapshot(), tab, lastResult: null });
  },

  listOffers(): readonly ShopOffer[] {
    return SHOP_OFFERS;
  },

  /** Stacks inventário vendáveis (preço unitário > 0), agregados por itemId. */
  listSellable(): readonly { itemId: string; quantity: number; unitPrice: number }[] {
    const byId = new Map<string, number>();
    for (const slot of inventoryStore.getSnapshot().slots) {
      if (!slot) continue;
      byId.set(slot.itemId, (byId.get(slot.itemId) ?? 0) + slot.quantity);
    }

    const out: { itemId: string; quantity: number; unitPrice: number }[] = [];
    for (const [itemId, quantity] of byId) {
      const unitPrice = getNpcSellPrice(itemId);
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

  buy(offerId: string, quantity = 1): boolean {
    const offer = getShopOffer(offerId);
    if (!offer || quantity <= 0) return false;

    const result = inventoryStore.buyItem({
      itemId: offer.itemId,
      quantity,
      price: offer.price,
      currencyItemId: offer.currencyItemId,
    });

    const currency = getItem(offer.currencyItemId);
    let message: string;
    if (result === 'ok') {
      message = `Comprou ${quantity}× ${offer.name}.`;
      emitSystemMessage(message);
      store.setState({ ...store.getSnapshot(), lastResult: message });
      return true;
    }
    if (result === 'no-funds') {
      message = `Cobre insuficiente. Precisa de ${offer.price * quantity} ${currency?.name ?? 'moedas'}.`;
    } else if (result === 'no-space') {
      message = 'Inventário cheio — liberte um slot antes de comprar.';
    } else {
      message = 'Não foi possível concluir a compra.';
    }
    emitSystemMessage(message);
    store.setState({ ...store.getSnapshot(), lastResult: message });
    return false;
  },

  sell(itemId: string, quantity = 1): boolean {
    const unitPrice = getNpcSellPrice(itemId);
    if (unitPrice <= 0 || quantity <= 0) return false;

    const def = getItem(itemId);
    const result = inventoryStore.sellItem({
      itemId,
      quantity,
      unitPrice,
      currencyItemId: SHOP_CURRENCY_ITEM_ID,
    });

    let message: string;
    if (result === 'ok') {
      const total = unitPrice * quantity;
      message = `Vendeu ${quantity}× ${def?.name ?? itemId} por ${total} cobre.`;
      emitSystemMessage(message);
      store.setState({ ...store.getSnapshot(), lastResult: message });
      return true;
    }
    if (result === 'no-stock') {
      message = 'Quantidade insuficiente no inventário.';
    } else {
      message = 'Não foi possível concluir a venda.';
    }
    emitSystemMessage(message);
    store.setState({ ...store.getSnapshot(), lastResult: message });
    return false;
  },
};
