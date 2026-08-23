type Handler = (payload: Record<string, unknown>) => void;

const listeners = new Map<string, Set<Handler>>();

function on(event: string, handler: Handler): () => void {
  let set = listeners.get(event);
  if (!set) {
    set = new Set();
    listeners.set(event, set);
  }
  set.add(handler);
  return () => set!.delete(handler);
}

function emit(event: string, payload: Record<string, unknown>): void {
  const set = listeners.get(event);
  if (!set) return;
  for (const h of set) {
    try {
      h(payload);
    } catch {
      // never break gameplay
    }
  }
}

export function onShopPurchaseCompleted(handler: Handler): () => void {
  return on('shopPurchaseCompleted', handler);
}

export function onItemSold(handler: Handler): () => void {
  return on('itemSold', handler);
}

export function emitShopPurchaseCompleted(payload: {
  offerId: string;
  currency: string;
  price: number;
  itemId: string;
  quantity: number;
}): void {
  emit('shopPurchaseCompleted', payload);
}

export function emitItemSold(payload: {
  itemId: string;
  quantity: number;
  unitPrice: number;
  totalCopper: number;
}): void {
  emit('itemSold', payload);
}
