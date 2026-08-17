import * as Phaser from 'phaser';
import type { Enemy } from '@/entities/enemy';
import type { EnemyManager } from '@/systems/enemy-manager';

export interface FindEnemyOptions {
  /**
   * Ignora candidatos (ex.: alvo já reservado por outro membro da equipe).
   * Quando nenhum sobra, o chamador decide se aceita um alvo ignorado.
   */
  skip?: (enemy: Enemy) => boolean;
}

/** Inimigo vivo mais próximo dentro do alcance (sem alocar array). */
export function findNearestAliveEnemy(
  enemyManager: EnemyManager,
  fromX: number,
  fromY: number,
  range: number,
  options?: FindEnemyOptions,
): Enemy | null {
  let best: Enemy | null = null;
  let bestDist = range;

  for (const enemy of enemyManager.values()) {
    if (!enemy.isAlive) continue;
    if (options?.skip?.(enemy)) continue;
    const dist = Phaser.Math.Distance.Between(fromX, fromY, enemy.sprite.x, enemy.sprite.y);
    if (dist <= bestDist) {
      bestDist = dist;
      best = enemy;
    }
  }

  return best;
}

/**
 * Alvo exclusivo do caçador: prefere um inimigo ainda não reservado e só
 * repete o alvo de outro quando não há monstro livre no alcance.
 */
export function findUnclaimedEnemy(
  enemyManager: EnemyManager,
  fromX: number,
  fromY: number,
  range: number,
  claims: { takenByOther(enemyId: string, claimantId: string): boolean } | null,
  claimantId: string,
): Enemy | null {
  if (!claims) return findNearestAliveEnemy(enemyManager, fromX, fromY, range);
  const free = findNearestAliveEnemy(enemyManager, fromX, fromY, range, {
    skip: (enemy) => claims.takenByOther(enemy.id, claimantId),
  });
  return free ?? findNearestAliveEnemy(enemyManager, fromX, fromY, range);
}
