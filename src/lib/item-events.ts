/**
 * Eventos de inventário desacoplados — evita ciclo store↔store.
 */

export type ItemGainSource =
  | 'unknown'
  | 'combat'
  | 'combat-loot'
  | 'mission-reward'
  | 'achievement-reward'
  | 'daily-login'
  | 'boss-reward'
  | 'dev';

type ItemGainedListener = (itemId: string, quantity: number, source: ItemGainSource) => void;
type ItemConsumedListener = (itemId: string, quantity: number) => void;

const itemGainedListeners = new Set<ItemGainedListener>();
const itemConsumedListeners = new Set<ItemConsumedListener>();

export function onItemGained(listener: ItemGainedListener): () => void {
  itemGainedListeners.add(listener);
  return () => itemGainedListeners.delete(listener);
}

export function emitItemGained(
  itemId: string,
  quantity: number,
  source: ItemGainSource = 'unknown',
): void {
  if (quantity <= 0) return;
  for (const listener of itemGainedListeners) listener(itemId, quantity, source);
}

export function onItemConsumed(listener: ItemConsumedListener): () => void {
  itemConsumedListeners.add(listener);
  return () => itemConsumedListeners.delete(listener);
}

export function emitItemConsumed(itemId: string, quantity: number): void {
  if (quantity <= 0) return;
  for (const listener of itemConsumedListeners) listener(itemId, quantity);
}
