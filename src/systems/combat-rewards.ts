import * as Phaser from 'phaser';
import { isLabDummyId } from '@/stores/character-lab-store';
import type { Enemy } from '@/entities/enemy';
import { decimalToUnsafeNumber } from '@/lib/decimal';
import { grantHuntKillXp } from '@/lib/grant-player-xp';
import { grantMasteryXpFromKills } from '@/lib/grant-mastery-xp';
import { grantLineageOnlineKill } from '@/lib/promote-lineage-rank';
import { isCharacterCompatibleWithLineage } from '@/lib/lineage-compatibility';
import { rewardService } from '@/lib/reward-service';
import { accountStore } from '@/stores/account-store';
import { missionsStore } from '@/stores/missions-store';
import { huntAnalyzerStore } from '@/stores/hunt-analyzer-store';
import { gemStore } from '@/stores/gem-store';
import { captureStore } from '@/stores/capture-store';
import { helperStore } from '@/stores/helper-store';
import { questStore } from '@/stores/quest-store';
import { villageStore } from '@/stores/village-store';
import { locationStore } from '@/stores/location-store';
import { teamStore } from '@/stores/team-store';
import { bossStore } from '@/stores/boss-store';
import { guildStore } from '@/stores/guild-store';
import { resolveLootFromEnemy, rewardItemsToRolled } from '@/systems/loot-engine';
import type { RewardResult } from '@/types/loot';
import type { LootManager } from '@/systems/loot-manager';
import { attemptCapture } from '@/systems/capture-engine';
import { offlineProgressStore } from '@/stores/offline-progress-store';
import { isNarutoLootTarget } from '@/data/anime-loot';

/** Stores React/UI — separados do loot visual para não bloquear combate. */
const STORE_REWARD_DEFER_MS = 48;

function shouldSkipEnemyKill(enemy: Enemy): boolean {
  if (isLabDummyId(enemy.id) || isLabDummyId(enemy.definition.id)) return true;
  if (locationStore.getSnapshot().encounterKind === 'boss') return true;
  if (bossStore.isEncounterActive()) return true;
  if (enemy.rewardClaimed) return true;
  return false;
}

function applyEnemyKillStoreRewards(enemy: Enemy, reward: RewardResult): void {
  questStore.onEnemyKilled(enemy.definition.id, enemy.definition.name);
  villageStore.onEnemyKilled();
  const enemyLevel = enemy.stats.level;
  const xpGranted = grantHuntKillXp(enemy.stats.hpMax, enemyLevel);
  const activeInstance = teamStore.getActive();
  const masteryGranted = activeInstance
    ? (grantMasteryXpFromKills(activeInstance.id, enemy.stats.level, 1)?.xpGranted ?? 0)
    : 0;
  grantLineageOnlineKill(1);
  gemStore.recordKill();
  guildStore.notifyOnlineKill({ source: 'online' });

  if (reward.copper > 0) {
    const grant = rewardService.grant({
      rewards: { copper: reward.copper },
      source: 'hunt',
      sourceId: enemy.definition.id,
      allowPartial: true,
    });
    const grantedCopper = grant.granted.copper ?? 0;
    if (grantedCopper > 0) {
      missionsStore.applyGameplayEvent({ kind: 'combatCopper', amount: grantedCopper }, 'gameplay');
    }
  }

  huntAnalyzerStore.recordKill({
    xp: decimalToUnsafeNumber(xpGranted),
    copper: reward.copper,
    masteryXp: masteryGranted,
    quality: enemy.definition.sealable?.quality,
  });
  for (const item of reward.items) {
    huntAnalyzerStore.recordLootItems(item.itemId, item.quantity);
  }

  const active = teamStore.getActive();
  const playerLineage = accountStore.getLineageProgress().lineageId;
  const lineageCompatible = Boolean(
    active && playerLineage && isCharacterCompatibleWithLineage(active, playerLineage),
  );
  missionsStore.applyGameplayEvent(
    {
      kind: 'onlineKill',
      huntId: locationStore.getSnapshot().huntId,
      enemyId: enemy.definition.id,
      lineageCompatible,
    },
    'gameplay',
  );

  const seal = enemy.definition.sealable;
  offlineProgressStore.rememberLootContext({
    huntId: locationStore.getSnapshot().huntId,
    enemyLevel: enemy.stats.level,
    isNaruto: Boolean(
      seal && isNarutoLootTarget({ lookType: seal.lookType, sourceId: seal.sourceId }),
    ),
    lookType: seal?.lookType ?? null,
    characterId: seal?.characterId ?? null,
    table: enemy.definition.loot,
  });

  if (!helperStore.getSnapshot().autoSeal && enemy.definition.sealable) {
    captureStore.offer(
      enemy.definition,
      enemy.definition.sealable?.level ?? enemy.stats.level,
    );
    return;
  }

  if (enemy.captureResolved) return;
  attemptCapture({
    target: enemy.definition,
    source: 'auto',
    attemptKey: enemy.id,
  });
  enemy.captureResolved = true;
}

function applyEnemyKillRewards(
  enemy: Enemy,
  lootManager: LootManager,
  dropX: number,
  dropY: number,
): void {
  const reward = resolveLootFromEnemy(enemy, 1);
  lootManager.spawnRolled(rewardItemsToRolled(reward.items), dropX, dropY);
  applyEnemyKillStoreRewards(enemy, reward);
}

function scheduleEnemyKillRewardPhases(
  scene: Phaser.Scene,
  enemy: Enemy,
  lootManager: LootManager,
  dropX: number,
  dropY: number,
): void {
  scene.time.delayedCall(0, () => {
    const reward = resolveLootFromEnemy(enemy, 1);
    lootManager.spawnRolled(rewardItemsToRolled(reward.items), dropX, dropY);
    scene.time.delayedCall(STORE_REWARD_DEFER_MS, () => {
      applyEnemyKillStoreRewards(enemy, reward);
    });
  });
}

/**
 * Recompensas ao matar: XP/vila/quest + Loot Engine + selamento (sistema separado).
 */
export function handleEnemyKill(
  enemy: Enemy,
  lootManager: LootManager,
  dropX: number,
  dropY: number,
): void {
  if (shouldSkipEnemyKill(enemy)) return;
  enemy.rewardClaimed = true;
  applyEnemyKillRewards(enemy, lootManager, dropX, dropY);
}

/**
 * Agenda recompensas fora do frame da morte (loot visual primeiro; stores depois).
 */
export function scheduleHandleEnemyKill(
  scene: Phaser.Scene,
  enemy: Enemy,
  lootManager: LootManager,
  dropX: number,
  dropY: number,
): void {
  if (shouldSkipEnemyKill(enemy)) return;
  enemy.rewardClaimed = true;
  scheduleEnemyKillRewardPhases(scene, enemy, lootManager, dropX, dropY);
}
