import * as Phaser from 'phaser';
import { LOOT_SCATTER_RADIUS, LOOT_SPRITE_URL, LOOT_TEXTURE_KEY } from '@/constants/loot';
import { GroundLoot, toGroundLootData } from '@/entities/ground-loot';
import type { RolledLoot } from '@/types/loot';

/**
 * Spawna loot no chão (legado / casos especiais).
 * Kills de hunt concedem loot direto no inventário — sem chão.
 */
export class LootManager {
  private readonly drops = new Map<string, GroundLoot>();

  constructor(private readonly scene: Phaser.Scene) {}

  static preload(scene: Phaser.Scene): void {
    scene.load.image(LOOT_TEXTURE_KEY, LOOT_SPRITE_URL);
  }

  spawnRolled(rolled: RolledLoot[], originX: number, originY: number): GroundLoot[] {
    const created: GroundLoot[] = [];

    rolled.forEach((drop, index) => {
      const angle = (Math.PI * 2 * index) / Math.max(1, rolled.length) + Math.random() * 0.4;
      const radius = 6 + Math.random() * LOOT_SCATTER_RADIUS;
      const lootX = originX + Math.cos(angle) * radius;
      const lootY = originY + Math.sin(angle) * radius;
      const ground = new GroundLoot(this.scene, toGroundLootData(drop, lootX, lootY));
      this.drops.set(ground.id, ground);
      created.push(ground);
    });

    return created;
  }

  update(time: number): void {
    for (const [id, drop] of this.drops) {
      if (!drop.isExpired(time)) continue;
      drop.destroy();
      this.drops.delete(id);
    }
  }

  list(): GroundLoot[] {
    return Array.from(this.drops.values());
  }

  values(): IterableIterator<GroundLoot> {
    return this.drops.values();
  }

  remove(id: string): boolean {
    const drop = this.drops.get(id);
    if (!drop) return false;
    drop.destroy();
    this.drops.delete(id);
    return true;
  }

  clear(): void {
    for (const drop of this.drops.values()) {
      drop.destroy();
    }
    this.drops.clear();
  }
}
