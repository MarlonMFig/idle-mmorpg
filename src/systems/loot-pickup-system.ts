import { addItemsToInventory } from '@/systems/reward-application';
import { huntAnalyzerStore } from '@/stores/hunt-analyzer-store';
import { missionsStore } from '@/stores/missions-store';
import { SHOP_CURRENCY_ITEM_ID } from '@/constants/sealing';
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
      const leftoverQty = addItemsToInventory(
        [{ itemId: drop.data.itemId, quantity: before }],
        'combat-loot',
      )[0]?.quantity ?? 0;
      if (leftoverQty >= before) continue;

      const gained = before - leftoverQty;
      if (gained > 0) {
        huntAnalyzerStore.recordLootItems(drop.data.itemId, gained);
        if (drop.data.itemId !== SHOP_CURRENCY_ITEM_ID) {
          missionsStore.applyGameplayEvent(
            { kind: 'combatDrop', amount: gained, itemId: drop.data.itemId },
            'gameplay',
          );
        }
      }

      if (leftoverQty > 0) {
        drop.setQuantity(leftoverQty);
      } else {
        this.lootManager.remove(drop.id);
      }
    }
  }
}
