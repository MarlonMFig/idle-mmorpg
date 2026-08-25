/**
 * Serialização / validação do inventário para session-v1 (Item 31).
 * Copper permanece como item `item-copper-coin` nos slots — sem store paralelo.
 * Bolsa sem teto de slots: o save guarda todos os stacks.
 */

import { getItem, getItemStackLimit } from '@/data/items';
import { isDevMode } from '@/config/devConfig';
import type { InventoryItemStack, InventorySlot } from '@/types/inventory';

export interface PersistedInventory {
  /** Slots na ordem do inventário (null = vazio). Comprimento = o que estiver na bolsa. */
  slots: Array<{ itemId: string; quantity: number } | null>;
}

function warnDev(message: string): void {
  if (isDevMode()) console.warn(`[InventoryPersist] ${message}`);
}

/**
 * Normaliza um slot bruto do save.
 * - itemId desconhecido → null + warning
 * - quantity não finita / negativa → null
 * - quantity 0 → null
 * - overstack (qty > stackMax) → preserva qty (não destrói); warning DEV
 */
export function sanitizeInventorySlot(raw: unknown): InventorySlot {
  if (raw == null) return null;
  if (typeof raw !== 'object') {
    warnDev('slot inválido (não-objeto) — ignorado');
    return null;
  }
  const row = raw as Record<string, unknown>;
  const itemId = row.itemId;
  if (typeof itemId !== 'string' || !itemId.trim()) {
    warnDev('slot sem itemId — ignorado');
    return null;
  }
  if (!getItem(itemId)) {
    warnDev(`itemId desconhecido no save: ${itemId} — ignorado`);
    return null;
  }
  const qtyRaw = row.quantity;
  if (typeof qtyRaw !== 'number' || !Number.isFinite(qtyRaw)) {
    warnDev(`quantity inválida para ${itemId} — ignorado`);
    return null;
  }
  const quantity = Math.floor(qtyRaw);
  if (quantity <= 0) return null;
  const stackMax = getItemStackLimit(itemId);
  if (quantity > stackMax) {
    warnDev(
      `overstack preservado: ${itemId} qty=${quantity} > stackMax=${stackMax} (não destruído)`,
    );
  }
  return { itemId, quantity };
}

/** Parse seguro: nunca lança; retorna null se payload ausente/irrecuperável. */
export function parsePersistedInventory(raw: unknown): PersistedInventory | null {
  if (raw == null) return null;
  if (typeof raw !== 'object') {
    warnDev('inventory blob inválido — fallback starter');
    return null;
  }
  const data = raw as Record<string, unknown>;
  if ('equipment' in data) {
    warnDev('inventory.equipment legado descartado (sistema Equipment removido)');
  }
  const slotsRaw = data.slots;
  if (!Array.isArray(slotsRaw)) {
    warnDev('inventory.slots ausente — fallback starter');
    return null;
  }

  const slots: Array<{ itemId: string; quantity: number } | null> = [];
  for (const entry of slotsRaw) {
    const sanitized = sanitizeInventorySlot(entry);
    slots.push(sanitized ? { itemId: sanitized.itemId, quantity: sanitized.quantity } : null);
  }
  while (slots.length > 0 && slots[slots.length - 1] == null) slots.pop();
  return { slots };
}

export function snapshotInventorySlots(slots: readonly InventorySlot[]): PersistedInventory {
  const out: Array<{ itemId: string; quantity: number } | null> = [];
  for (const slot of slots) {
    if (!slot) {
      out.push(null);
      continue;
    }
    const quantity = Math.floor(slot.quantity);
    if (quantity <= 0 || !getItem(slot.itemId)) {
      out.push(null);
      continue;
    }
    out.push({ itemId: slot.itemId, quantity });
  }
  while (out.length > 0 && out[out.length - 1] == null) out.pop();
  return { slots: out };
}

export function slotsFromPersisted(persisted: PersistedInventory): InventorySlot[] {
  return persisted.slots.map((row) => {
    if (!row) return null;
    const stack: InventoryItemStack = { itemId: row.itemId, quantity: row.quantity };
    return sanitizeInventorySlot(stack);
  });
}
