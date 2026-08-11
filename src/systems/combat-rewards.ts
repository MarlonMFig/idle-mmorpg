import { SHOP_CURRENCY_ITEM_ID } from '@/constants/sealing';
import { copperRewardForKill } from '@/data/anime-loot';
import type { Enemy } from '@/entities/enemy';
import { grantPlayerXp } from '@/lib/grant-player-xp';
import { inventoryStore } from '@/stores/inventory-store';
import { huntAnalyzerStore } from '@/stores/hunt-analyzer-store';
import { questStore } from '@/stores/quest-store';
import { villageStore } from '@/stores/village-store';
import type { LootManager } from '@/systems/loot-manager';
import { trySealEnemy } from '@/systems/sealing';

/**
 * Recompensas e progresso ao matar um inimigo (XP, cobre, vila, quest, loot, selamento).
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
  const xpGranted = grantPlayerXp(enemy.xp);

  // Cobre garantido (não depende de roll de chão / chance).
  const copper = copperRewardForKill(enemy.level);
  if (copper > 0) {
    inventoryStore.addItem(SHOP_CURRENCY_ITEM_ID, copper);
  }

  huntAnalyzerStore.recordKill({ xp: xpGranted, copper });

  lootManager.spawnFromEnemyAt(enemy, dropX, dropY);
  const seal = trySealEnemy(enemy.definition);
  if (seal.kind !== 'skipped') {
    huntAnalyzerStore.recordSealAttempt(true);
  }
  if (seal.kind === 'success') {
    huntAnalyzerStore.recordSealSuccess(seal.name);
  }
}
