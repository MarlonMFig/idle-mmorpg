/** Kit inicial do inventário (New Game). Sem equipamentos. */
export const STARTER_INVENTORY_LOADOUT: readonly { itemId: string; quantity: number }[] = [
  { itemId: 'item-copper-coin', quantity: 250 },
  { itemId: 'item-sealing-scroll', quantity: 20 },
] as const;

/** @deprecated Use STARTER_INVENTORY_LOADOUT */
export const WONSR_STARTER_LOADOUT = STARTER_INVENTORY_LOADOUT;
