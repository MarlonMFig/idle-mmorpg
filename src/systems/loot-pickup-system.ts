import { inventoryStore } from '@/stores/inventory-store';
import { huntAnalyzerStore } from '@/stores/hunt-analyzer-store';
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

      const gained = before - leftover;
      if (gained > 0) {
        huntAnalyzerStore.recordLootItems(drop.data.itemId, gained);
      }

      if (leftover > 0) {
        drop.setQuantity(leftover);
      } else {
        this.lootManager.remove(drop.id);
      }
    }
  }
}
