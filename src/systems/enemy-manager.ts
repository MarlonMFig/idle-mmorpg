import * as Phaser from 'phaser';
import {
  ENEMY_FRAME_HEIGHT,
  ENEMY_FRAME_WIDTH,
  ENEMY_SPRITE_URL,
  ENEMY_TEXTURE_KEY,
} from '@/constants/enemy';
import { getEnemiesForMap } from '@/data/enemies';
import { Enemy } from '@/entities/enemy';
import type { MapKey } from '@/maps/map-registry';
import type { EnemyDefinition } from '@/types/enemy';

/**
 * Carrega e gerencia monstros do mapa (spawn, update, respawn).
 */
export class EnemyManager {
  private readonly enemies = new Map<string, Enemy>();
  private mapKey: MapKey | null = null;

  constructor(private readonly scene: Phaser.Scene) {}

  static preload(scene: Phaser.Scene): void {
    scene.load.spritesheet(ENEMY_TEXTURE_KEY, ENEMY_SPRITE_URL, {
      frameWidth: ENEMY_FRAME_WIDTH,
      frameHeight: ENEMY_FRAME_HEIGHT,
    });
  }

  loadForMap(mapKey: MapKey): Enemy[] {
    this.clear();
    this.mapKey = mapKey;

    const definitions = getEnemiesForMap(mapKey);
    for (const definition of definitions) {
      this.spawn(definition);
    }

    return this.list();
  }

  update(time: number): void {
    for (const enemy of this.enemies.values()) {
      enemy.update(time);
    }
  }

  get(id: string): Enemy | undefined {
    return this.enemies.get(id);
  }

  list(): Enemy[] {
    return Array.from(this.enemies.values());
  }

  /** Iteração sem alocar array (update / nearest). */
  values(): IterableIterator<Enemy> {
    return this.enemies.values();
  }

  get currentMapKey(): MapKey | null {
    return this.mapKey;
  }

  clear(): void {
    for (const enemy of this.enemies.values()) {
      enemy.destroy();
    }
    this.enemies.clear();
    this.mapKey = null;
  }

  private spawn(definition: EnemyDefinition): Enemy {
    if (this.enemies.has(definition.id)) {
      throw new Error(`Monstro duplicado no mapa: ${definition.id}`);
    }
    const enemy = new Enemy(this.scene, definition);
    this.enemies.set(definition.id, enemy);
    return enemy;
  }
}
