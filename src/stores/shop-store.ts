import { createStore } from '@/stores/create-store';
import { getShopOffer, SHOP_OFFERS, type ShopOffer } from '@/data/shop';
import { inventoryStore } from '@/stores/inventory-store';
import { emitSystemMessage } from '@/lib/system-log';
import { getItem } from '@/data/items';

export interface ShopState {
  isOpen: boolean;
  lastResult: string | null;
}

const store = createStore<ShopState>({
  isOpen: false,
  lastResult: null,
});

/**
 * Loja do hub — compra de itens utilitários (pergaminho de selamento).
 */
export const shopStore = {
  subscribe: store.subscribe,
  getSnapshot: store.getSnapshot,

  reset(): void {
    store.setState({ isOpen: false, lastResult: null });
  },

  toggleOpen(): void {
    const state = store.getSnapshot();
    store.setState({ ...state, isOpen: !state.isOpen, lastResult: null });
  },

  setOpen(isOpen: boolean): void {
    store.setState({ ...store.getSnapshot(), isOpen, lastResult: isOpen ? null : null });
  },

  listOffers(): readonly ShopOffer[] {
    return SHOP_OFFERS;
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
      message = `Moedas insuficientes. Precisa de ${offer.price * quantity} ${currency?.name ?? 'moedas'}.`;
    } else if (result === 'no-space') {
      message = 'Inventário cheio — liberte um slot antes de comprar.';
    } else {
      message = 'Não foi possível concluir a compra.';
    }
    emitSystemMessage(message);
    store.setState({ ...store.getSnapshot(), lastResult: message });
    return false;
  },
};
