'use client';

import { useStore } from '@/hooks/use-store';
import { inventoryStore } from '@/stores/inventory-store';
import type { InventoryState } from '@/types/inventory';

export function useInventoryStore(): InventoryState {
  return useStore(inventoryStore);
}
