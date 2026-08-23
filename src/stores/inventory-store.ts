import { INVENTORY_SLOT_COUNT } from '@/constants/inventory';
import { getItem } from '@/data/items';
import { STARTER_INVENTORY_LOADOUT } from '@/data/starter-loadout';
import { emitItemConsumed, emitItemGained, type ItemGainSource } from '@/lib/item-events';
import {
  parsePersistedInventory,
  snapshotInventorySlots,
  slotsFromPersisted,
  type PersistedInventory,
} from '@/lib/inventory-persist';
import { attributesStore } from '@/stores/attributes-store';
import { createStore } from '@/stores/create-store';
import type { InventoryItemStack, InventorySlot, InventoryState } from '@/types/inventory';

function emptySlots(): InventorySlot[] {
  return Array.from({ length: INVENTORY_SLOT_COUNT }, () => null);
}

function cloneSlots(slots: InventorySlot[]): InventorySlot[] {
  return slots.map((slot) => (slot ? { ...slot } : null));
}

/** Tenta inserir stack; retorna restante ou null se coube tudo. */
function insertStack(slots: InventorySlot[], stack: InventoryItemStack): InventoryItemStack | null {
  const def = getItem(stack.itemId);
  if (!def) return stack;

  let remaining = stack.quantity;

  for (let i = 0; i < slots.length && remaining > 0; i += 1) {
    const slot = slots[i];
    if (!slot || slot.itemId !== stack.itemId) continue;
    const space = def.stackMax - slot.quantity;
    if (space <= 0) continue;
    const add = Math.min(space, remaining);
    slots[i] = { itemId: stack.itemId, quantity: slot.quantity + add };
    remaining -= add;
  }

  for (let i = 0; i < slots.length && remaining > 0; i += 1) {
    if (slots[i]) continue;
    const add = Math.min(def.stackMax, remaining);
    slots[i] = { itemId: stack.itemId, quantity: add };
    remaining -= add;
  }

  return remaining > 0 ? { itemId: stack.itemId, quantity: remaining } : null;
}

const store = createStore<InventoryState>({
  slots: emptySlots(),
  selectedIndex: null,
  isOpen: false,
});

function commit(next: InventoryState): void {
  store.setState(next);
}

/**
 * Inventário (React) — mover, empilhar, descartar.
 * Sem sistema de Equipment (Item 36).
 */
export const inventoryStore = {
  subscribe: store.subscribe,
  getSnapshot: store.getSnapshot,

  reset(): void {
    const slots = emptySlots();
    let index = 0;
    for (const entry of STARTER_INVENTORY_LOADOUT) {
      if (!getItem(entry.itemId) || index >= INVENTORY_SLOT_COUNT) continue;
      slots[index] = { itemId: entry.itemId, quantity: entry.quantity };
      index += 1;
    }

    store.setState({
      slots,
      selectedIndex: null,
      isOpen: false,
    });
    attributesStore.recalculate(true);
  },

  /**
   * Restaura slots do session save.
   * Não altera isOpen. Campos equipment legados no save são ignorados.
   */
  hydrate(persisted: PersistedInventory | null | undefined): void {
    if (!persisted) {
      this.reset();
      return;
    }
    const slots = slotsFromPersisted(persisted);
    store.setState({
      slots,
      selectedIndex: null,
      isOpen: false,
    });
    attributesStore.recalculate(true);
  },

  /** Snapshot oficial para session (somente slots / itens). */
  getPersistedInventory(): PersistedInventory {
    return snapshotInventorySlots(store.getSnapshot().slots);
  },

  parsePersistedInventory(raw: unknown): PersistedInventory | null {
    return parsePersistedInventory(raw);
  },

  toggleOpen(): void {
    const state = store.getSnapshot();
    commit({ ...state, isOpen: !state.isOpen, selectedIndex: null });
  },

  setOpen(isOpen: boolean): void {
    const state = store.getSnapshot();
    commit({ ...state, isOpen, selectedIndex: isOpen ? state.selectedIndex : null });
  },

  selectSlot(index: number | null): void {
    if (index != null && (index < 0 || index >= INVENTORY_SLOT_COUNT)) return;
    commit({ ...store.getSnapshot(), selectedIndex: index });
  },

  addItem(itemId: string, quantity: number, source: ItemGainSource = 'unknown'): number {
    const def = getItem(itemId);
    if (!def || quantity <= 0) return quantity;

    const state = store.getSnapshot();
    const slots = cloneSlots(state.slots);
    const leftover = insertStack(slots, { itemId, quantity });
    commit({ ...state, slots });

    const remaining = leftover?.quantity ?? 0;
    const gained = quantity - remaining;
    if (gained > 0) emitItemGained(itemId, gained, source);

    return remaining;
  },

  moveSlot(fromIndex: number, toIndex: number): boolean {
    if (fromIndex === toIndex) return false;
    if (
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= INVENTORY_SLOT_COUNT ||
      toIndex >= INVENTORY_SLOT_COUNT
    ) {
      return false;
    }

    const state = store.getSnapshot();
    const slots = cloneSlots(state.slots);
    const from = slots[fromIndex];
    const to = slots[toIndex];
    if (!from) return false;

    const def = getItem(from.itemId);
    if (!def) return false;

    if (to && to.itemId === from.itemId && to.quantity < def.stackMax) {
      const space = def.stackMax - to.quantity;
      const moved = Math.min(space, from.quantity);
      slots[toIndex] = { itemId: from.itemId, quantity: to.quantity + moved };
      const left = from.quantity - moved;
      slots[fromIndex] = left > 0 ? { itemId: from.itemId, quantity: left } : null;
      commit({ ...state, slots, selectedIndex: null });
      return true;
    }

    slots[toIndex] = from;
    slots[fromIndex] = to;
    commit({ ...state, slots, selectedIndex: null });
    return true;
  },

  interactSlot(index: number): void {
    const { selectedIndex, slots } = store.getSnapshot();
    if (selectedIndex == null) {
      if (!slots[index]) return;
      this.selectSlot(index);
      return;
    }
    this.moveSlot(selectedIndex, index);
  },

  discardSlot(index: number, quantity?: number): boolean {
    const state = store.getSnapshot();
    const slots = cloneSlots(state.slots);
    const stack = slots[index];
    if (!stack) return false;

    const remove = quantity == null ? stack.quantity : Math.min(quantity, stack.quantity);
    const left = stack.quantity - remove;
    slots[index] = left > 0 ? { itemId: stack.itemId, quantity: left } : null;

    commit({
      ...state,
      slots,
      selectedIndex: state.selectedIndex === index && left <= 0 ? null : state.selectedIndex,
    });
    return true;
  },

  countItem(itemId: string): number {
    return store.getSnapshot().slots.reduce((total, slot) => {
      if (!slot || slot.itemId !== itemId) return total;
      return total + slot.quantity;
    }, 0);
  },

  canFit(items: readonly { itemId: string; quantity: number }[]): boolean {
    const slots = cloneSlots(store.getSnapshot().slots);
    for (const row of items) {
      if (row.quantity <= 0) continue;
      if (!getItem(row.itemId)) return false;
      const leftover = insertStack(slots, { itemId: row.itemId, quantity: row.quantity });
      if (leftover) return false;
    }
    return true;
  },

  removeItem(itemId: string, quantity: number): boolean {
    if (quantity <= 0) return true;
    if (this.countItem(itemId) < quantity) return false;

    const state = store.getSnapshot();
    const slots = cloneSlots(state.slots);
    let remaining = quantity;

    for (let i = slots.length - 1; i >= 0 && remaining > 0; i -= 1) {
      const slot = slots[i];
      if (!slot || slot.itemId !== itemId) continue;
      const remove = Math.min(slot.quantity, remaining);
      const left = slot.quantity - remove;
      slots[i] = left > 0 ? { itemId, quantity: left } : null;
      remaining -= remove;
    }

    commit({
      ...state,
      slots,
      selectedIndex:
        state.selectedIndex != null && !slots[state.selectedIndex] ? null : state.selectedIndex,
    });
    return remaining === 0;
  },

  consumeItem(itemId: string, quantity: number): boolean {
    const ok = this.removeItem(itemId, quantity);
    if (ok && quantity > 0) emitItemConsumed(itemId, quantity);
    return ok;
  },

  buyItem(params: {
    itemId: string;
    quantity: number;
    price: number;
    currencyItemId: string;
  }): 'ok' | 'invalid' | 'no-funds' | 'no-space' {
    const { itemId, quantity, price, currencyItemId } = params;
    const def = getItem(itemId);
    if (!def || quantity <= 0 || price < 0) return 'invalid';

    const totalCost = price * quantity;
    if (this.countItem(currencyItemId) < totalCost) return 'no-funds';

    const state = store.getSnapshot();
    const trialSlots = cloneSlots(state.slots);
    const leftover = insertStack(trialSlots, { itemId, quantity });
    if (leftover) return 'no-space';

    if (!this.removeItem(currencyItemId, totalCost)) return 'no-funds';
    const remaining = this.addItem(itemId, quantity);
    if (remaining > 0) {
      this.addItem(currencyItemId, totalCost);
      this.removeItem(itemId, quantity - remaining);
      return 'no-space';
    }
    return 'ok';
  },

  sellItem(params: {
    itemId: string;
    quantity: number;
    unitPrice: number;
    currencyItemId: string;
  }): 'ok' | 'invalid' | 'no-stock' {
    const { itemId, quantity, unitPrice, currencyItemId } = params;
    const def = getItem(itemId);
    if (!def || quantity <= 0 || unitPrice < 0 || itemId === currencyItemId) {
      return 'invalid';
    }
    if (this.countItem(itemId) < quantity) return 'no-stock';
    if (!this.removeItem(itemId, quantity)) return 'no-stock';
    this.addItem(currencyItemId, unitPrice * quantity);
    return 'ok';
  },
};
