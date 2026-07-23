import * as Phaser from 'phaser';
import { LOOT_PICKUP_RANGE } from '@/constants/inventory';
import type { Player } from '@/entities/player';
import { inventoryStore } from '@/stores/inventory-store';
import type { LootManager } from '@/systems/loot-manager';

/**
 * Coleta loot do chão para o inventário ao aproximar.
 */
export class LootPickupSystem {
  constructor(
    private readonly player: Player,
    private readonly lootManager: LootManager,
  ) {}

  update(): void {
    for (const drop of this.lootManager.values()) {
      const dist = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        drop.data.x,
        drop.data.y,
      );
      if (dist > LOOT_PICKUP_RANGE) continue;

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
