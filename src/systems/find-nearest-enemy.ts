import * as Phaser from 'phaser';
import type { Enemy } from '@/entities/enemy';
import type { EnemyManager } from '@/systems/enemy-manager';

/** Inimigo vivo mais próximo dentro do alcance (sem alocar array). */
export function findNearestAliveEnemy(
  enemyManager: EnemyManager,
  fromX: number,
  fromY: number,
  range: number,
): Enemy | null {
  let best: Enemy | null = null;
  let bestDist = range;

  for (const enemy of enemyManager.values()) {
    if (!enemy.isAlive) continue;
    const dist = Phaser.Math.Distance.Between(fromX, fromY, enemy.sprite.x, enemy.sprite.y);
    if (dist <= bestDist) {
      bestDist = dist;
      best = enemy;
    }
  }

  return best;
}
