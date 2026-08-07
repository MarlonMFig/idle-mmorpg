import type { Enemy } from '@/entities/enemy';
import { grantPlayerXp } from '@/lib/grant-player-xp';
import { questStore } from '@/stores/quest-store';
import { villageStore } from '@/stores/village-store';
import type { LootManager } from '@/systems/loot-manager';
import { trySealEnemy } from '@/systems/sealing';

/**
 * Recompensas e progresso ao matar um inimigo (XP, vila, quest, loot, selamento).
 * Único ponto usado por combate automático e habilidades.
 */
export function handleEnemyKill(
  enemy: Enemy,
  lootManager: LootManager,
  dropX: number,
  dropY: number,
): void {
  questStore.onEnemyKilled(enemy.definition.id, enemy.definition.name);
  villageStore.onEnemyKilled();
  grantPlayerXp(enemy.xp);
  lootManager.spawnFromEnemyAt(enemy, dropX, dropY);
  trySealEnemy(enemy.definition);
}
