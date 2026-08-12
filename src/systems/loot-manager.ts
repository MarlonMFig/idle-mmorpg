import * as Phaser from 'phaser';
import { LOOT_SCATTER_RADIUS, LOOT_SPRITE_URL, LOOT_TEXTURE_KEY } from '@/constants/loot';
import { isNarutoLootTarget, rollNarutoCharacterLoot } from '@/data/anime-loot';
import { GroundLoot, toGroundLootData } from '@/entities/ground-loot';
import type { Enemy } from '@/entities/enemy';
import { rollDropTable } from '@/systems/loot-table';
import type { RolledLoot } from '@/types/loot';

/**
 * Gera drops no chão a partir da tabela do inimigo.
 */
export class LootManager {
  private readonly drops = new Map<string, GroundLoot>();

  constructor(private readonly scene: Phaser.Scene) {}

  static preload(scene: Phaser.Scene): void {
    scene.load.image(LOOT_TEXTURE_KEY, LOOT_SPRITE_URL);
  }

  /** Rola a tabela do inimigo e spawna os itens no chão (posição da morte). */
  spawnFromEnemy(enemy: Enemy): GroundLoot[] {
    return this.spawnFromEnemyAt(enemy, enemy.sprite.x, enemy.sprite.y);
  }

  spawnFromEnemyAt(enemy: Enemy, x: number, y: number): GroundLoot[] {
    const rolled = rollEnemyLoot(enemy);
    return this.spawnRolled(rolled, x, y);
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

/** Naruto: raridade + assinatura em runtime; outros: tabela fixa. */
function rollEnemyLoot(enemy: Enemy): RolledLoot[] {
  const seal = enemy.definition.sealable;
  if (
    seal &&
    isNarutoLootTarget({ lookType: seal.lookType, sourceId: seal.sourceId })
  ) {
    return rollNarutoCharacterLoot({ lookType: seal.lookType });
  }
  return rollDropTable(enemy.definition.loot);
}
