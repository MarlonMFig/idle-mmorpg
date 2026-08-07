import { inventoryStore } from '@/stores/inventory-store';
import type { LootManager } from '@/systems/loot-manager';

/**
 * Coleta automaticamente todo loot do mapa para o inventário.
 * Quando não houver espaço, o restante permanece no chão.
 */
export class LootPickupSystem {
  constructor(private readonly lootManager: LootManager) {}

  update(): void {
    for (const drop of this.lootManager.values()) {
      const before = drop.data.quantity;
      const leftover = inventoryStore.addItem(drop.data.itemId, before);
      if (leftover >= before) continue;

      if (leftover > 0) {
        drop.setQuantity(leftover);
      } else {
        this.lootManager.remove(drop.id);
      }
    }
  }
}
