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
import { resolveLootFromEnemy } from '@/systems/loot-engine';
import type { RewardItem, RewardResult } from '@/types/loot';
import { attemptCapture } from '@/systems/capture-engine';
import { offlineProgressStore } from '@/stores/offline-progress-store';
import { isNarutoLootTarget } from '@/data/anime-loot';
import { SHOP_CURRENCY_ITEM_ID } from '@/constants/sealing';
import { heritageCombatExtras } from '@/lib/heritage-runtime';
import { vitalsStore } from '@/stores/vitals-store';
import { Decimal, d } from '@/lib/decimal';

/** Recompensas fora do frame da morte — sem loot no chão. */
const STORE_REWARD_DEFER_MS = 80;

function shouldSkipEnemyKill(enemy: Enemy): boolean {
  if (isLabDummyId(enemy.id) || isLabDummyId(enemy.definition.id)) return true;
  if (locationStore.getSnapshot().encounterKind === 'boss') return true;
  if (bossStore.isEncounterActive()) return true;
  if (enemy.rewardClaimed) return true;
  return false;
}

/** Inventário direto. Sem espaço = item não dropa (sem spawn no chão). */
function deliverKillLoot(
  reward: RewardResult,
  sourceId: string,
): { grantedCopper: number; grantedItems: RewardItem[] } {
  const grant = rewardService.grant({
    rewards: {
      copper: reward.copper > 0 ? reward.copper : undefined,
      items: reward.items.length ? reward.items : undefined,
    },
    source: 'hunt',
    sourceId,
    allowPartial: true,
  });

  return {
    grantedCopper: grant.granted.copper ?? 0,
    grantedItems: grant.granted.items ?? [],
  };
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

  const regenPerKill = heritageCombatExtras().regenPerKill ?? 0;
  if (regenPerKill > 0) {
    const { hpMax } = vitalsStore.getSnapshot();
    const amount = Decimal.max(d(1), hpMax.mul(regenPerKill).floor());
    vitalsStore.heal(amount);
  }

  const delivered = deliverKillLoot(reward, enemy.definition.id);
  if (delivered.grantedCopper > 0) {
    missionsStore.applyGameplayEvent(
      { kind: 'combatCopper', amount: delivered.grantedCopper },
      'gameplay',
    );
  }
  for (const item of delivered.grantedItems) {
    if (item.itemId === SHOP_CURRENCY_ITEM_ID) continue;
    missionsStore.applyGameplayEvent(
      { kind: 'combatDrop', amount: item.quantity, itemId: item.itemId },
      'gameplay',
    );
  }

  huntAnalyzerStore.recordKill({
    xp: decimalToUnsafeNumber(xpGranted),
    copper: delivered.grantedCopper,
    masteryXp: masteryGranted,
    quality: enemy.definition.sealable?.quality,
  });
  for (const item of delivered.grantedItems) {
    if (item.itemId === SHOP_CURRENCY_ITEM_ID) continue;
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

/**
 * Recompensas ao matar: XP/vila/quest + Loot Engine + selamento.
 * LootManager permanece na assinatura por compatibilidade — kills não usam chão.
 */
export function handleEnemyKill(enemy: Enemy): void {
  if (shouldSkipEnemyKill(enemy)) return;
  enemy.rewardClaimed = true;
  applyEnemyKillStoreRewards(enemy, resolveLootFromEnemy(enemy, 1));
}

/**
 * Agenda recompensas fora do frame da morte.
 */
export function scheduleHandleEnemyKill(scene: Phaser.Scene, enemy: Enemy): void {
  if (shouldSkipEnemyKill(enemy)) return;
  enemy.rewardClaimed = true;
  scene.time.delayedCall(STORE_REWARD_DEFER_MS, () => {
    if (!enemy.rewardClaimed) return;
    applyEnemyKillStoreRewards(enemy, resolveLootFromEnemy(enemy, 1));
  });
}
