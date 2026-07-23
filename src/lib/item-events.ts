/**
 * Eventos de inventário desacoplados — evita ciclo store↔store.
 * Quest e outros sistemas registram listeners na inicialização do jogo.
 */

type ItemGainedListener = (itemId: string, quantity: number) => void;

const itemGainedListeners = new Set<ItemGainedListener>();

export function onItemGained(listener: ItemGainedListener): () => void {
  itemGainedListeners.add(listener);
  return () => itemGainedListeners.delete(listener);
}

export function emitItemGained(itemId: string, quantity: number): void {
  if (quantity <= 0) return;
  for (const listener of itemGainedListeners) listener(itemId, quantity);
}
