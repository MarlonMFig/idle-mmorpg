import { INVENTORY_SLOT_COUNT } from '@/constants/inventory';
import { getEquipSlot, getItem } from '@/data/items';
import { WONSR_STARTER_LOADOUT } from '@/data/wonsr-equip-subset';
import { emitItemGained } from '@/lib/item-events';
import { attributesStore } from '@/stores/attributes-store';
import { createStore } from '@/stores/create-store';
import type {
  EquipmentState,
  InventoryItemStack,
  InventorySlot,
  InventoryState,
} from '@/types/inventory';
import type { EquipSlot } from '@/types/attributes';
import { createEmptyEquipment } from '@/utils/equipment';

function emptySlots(): InventorySlot[] {
  return Array.from({ length: INVENTORY_SLOT_COUNT }, () => null);
}

function cloneSlots(slots: InventorySlot[]): InventorySlot[] {
  return slots.map((slot) => (slot ? { ...slot } : null));
}

function cloneEquipment(equipment: EquipmentState): EquipmentState {
  return {
    bandana: equipment.bandana ? { ...equipment.bandana } : null,
    weapon: equipment.weapon ? { ...equipment.weapon } : null,
    clothing: equipment.clothing ? { ...equipment.clothing } : null,
    gloves: equipment.gloves ? { ...equipment.gloves } : null,
    boots: equipment.boots ? { ...equipment.boots } : null,
    accessory: equipment.accessory ? { ...equipment.accessory } : null,
  };
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
  equipment: createEmptyEquipment(),
  selectedIndex: null,
  isOpen: true,
});

function commit(next: InventoryState, syncAttributes = false): void {
  store.setState(next);
  if (syncAttributes) {
    attributesStore.recalculate(next.equipment);
  }
}

/**
 * Inventário (React) — mover, empilhar, equipar, descartar.
 * Equipar/desequipar recalcula atributos.
 */
export const inventoryStore = {
  subscribe: store.subscribe,
  getSnapshot: store.getSnapshot,

  reset(): void {
    const slots = emptySlots();
    let index = 0;
    for (const entry of WONSR_STARTER_LOADOUT) {
      if (!getItem(entry.itemId) || index >= INVENTORY_SLOT_COUNT) continue;
      slots[index] = { itemId: entry.itemId, quantity: entry.quantity };
      index += 1;
    }

    const equipment = createEmptyEquipment();
    store.setState({
      slots,
      equipment,
      selectedIndex: null,
      isOpen: true,
    });
    attributesStore.recalculate(equipment, true);
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

  addItem(itemId: string, quantity: number): number {
    const def = getItem(itemId);
    if (!def || quantity <= 0) return quantity;

    const state = store.getSnapshot();
    const slots = cloneSlots(state.slots);
    const leftover = insertStack(slots, { itemId, quantity });
    commit({ ...state, slots });

    const remaining = leftover?.quantity ?? 0;
    const gained = quantity - remaining;
    if (gained > 0) emitItemGained(itemId, gained);

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

  equipFromSlot(index: number): boolean {
    const state = store.getSnapshot();
    const slots = cloneSlots(state.slots);
    const stack = slots[index];
    if (!stack) return false;

    const equipSlot = getEquipSlot(stack.itemId);
    if (!equipSlot) return false;

    const equipment = cloneEquipment(state.equipment);
    const previous = equipment[equipSlot];

    if (stack.quantity <= 1) {
      slots[index] = null;
    } else {
      slots[index] = { itemId: stack.itemId, quantity: stack.quantity - 1 };
    }

    if (previous) {
      const leftover = insertStack(slots, previous);
      if (leftover) return false;
    }

    equipment[equipSlot] = { itemId: stack.itemId, quantity: 1 };
    commit({ ...state, slots, equipment, selectedIndex: null }, true);
    return true;
  },

  unequip(slot: EquipSlot): boolean {
    const state = store.getSnapshot();
    const equipment = cloneEquipment(state.equipment);
    const equipped = equipment[slot];
    if (!equipped) return false;

    const slots = cloneSlots(state.slots);
    const leftover = insertStack(slots, equipped);
    if (leftover) return false;

    equipment[slot] = null;
    commit({ ...state, slots, equipment, selectedIndex: null }, true);
    return true;
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

  /** Quantidade total de um item no inventário (todos os stacks). */
  countItem(itemId: string): number {
    return store.getSnapshot().slots.reduce((total, slot) => {
      if (!slot || slot.itemId !== itemId) return total;
      return total + slot.quantity;
    }, 0);
  },

  /** Remove quantidade de um item; falha sem alterar nada se não houver estoque. */
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
        state.selectedIndex != null && !slots[state.selectedIndex]
          ? null
          : state.selectedIndex,
    });
    return remaining === 0;
  },

  /**
   * Compra transacional: só desconta moeda se o item caber no inventário.
   * @returns null em sucesso, ou motivo da falha.
   */
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
      // Reembolso defensivo — não deveria ocorrer após o trial.
      this.addItem(currencyItemId, totalCost);
      this.removeItem(itemId, quantity - remaining);
      return 'no-space';
    }
    return 'ok';
  },
};
