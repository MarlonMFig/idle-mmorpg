/** Grade visual mínima (8 colunas). A bolsa cresce sem teto. */
export const INVENTORY_SLOT_COUNT = 40;
export const INVENTORY_COLUMNS = 8;

export const LOOT_PICKUP_RANGE = 36;

export function inventoryDisplaySlotCount(storedLength: number): number {
  const needed = Math.max(INVENTORY_SLOT_COUNT, storedLength + 1);
  return Math.ceil(needed / INVENTORY_COLUMNS) * INVENTORY_COLUMNS;
}
