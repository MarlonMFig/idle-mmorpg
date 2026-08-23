import { LAB_DUMMY_ID } from '@/stores/character-lab-store';
import type { Enemy } from '@/entities/enemy';
import { grantPlayerXp } from '@/lib/grant-player-xp';
import { huntEnemyXpForLevel } from '@/lib/hunt-enemy-xp';
import { xpLevelGapMultiplier } from '@/lib/xp-level-gap';
import { vitalsStore } from '@/stores/vitals-store';
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
import { resolveLootFromEnemy, rewardItemsToRolled } from '@/systems/loot-engine';
import type { LootManager } from '@/systems/loot-manager';
import { attemptCapture } from '@/systems/capture-engine';
import { offlineProgressStore } from '@/stores/offline-progress-store';
import { isNarutoLootTarget } from '@/data/anime-loot';

/**
 * Recompensas ao matar: XP/vila/quest + Loot Engine + selamento (sistema separado).
 */
export function handleEnemyKill(
  enemy: Enemy,
  lootManager: LootManager,
  dropX: number,
  dropY: number,
): void {
  if (enemy.id === LAB_DUMMY_ID || enemy.definition.id === LAB_DUMMY_ID) return;
  if (locationStore.getSnapshot().encounterKind === 'boss') return;
  if (bossStore.isEncounterActive()) return;
  if (enemy.rewardClaimed) return;
  enemy.rewardClaimed = true;

  questStore.onEnemyKilled(enemy.definition.id, enemy.definition.name);
  villageStore.onEnemyKilled();
  const playerLevel = vitalsStore.getLevel();
  const enemyLevel = enemy.stats.level;
  const baseXp = huntEnemyXpForLevel(enemyLevel);
  const afterGap = baseXp * xpLevelGapMultiplier(playerLevel, enemyLevel);
  const xpGranted = grantPlayerXp(afterGap);
  const activeInstance = teamStore.getActive();
  const masteryGranted = activeInstance
    ? (grantMasteryXpFromKills(activeInstance.id, enemy.stats.level, 1)?.xpGranted ?? 0)
    : 0;
  grantLineageOnlineKill(1);
  gemStore.recordKill();
  void import('@/stores/guild-store').then(({ guildStore }) => {
    guildStore.notifyOnlineKill({ source: 'online' });
  });

  const reward = resolveLootFromEnemy(enemy, 1);
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
    xp: xpGranted,
    copper: reward.copper,
    masteryXp: masteryGranted,
    quality: enemy.definition.sealable?.quality,
  });
  lootManager.spawnRolled(rewardItemsToRolled(reward.items), dropX, dropY);

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
  enemy.captureResolved = true;
  attemptCapture({
    target: enemy.definition,
    source: 'auto',
    attemptKey: enemy.id,
  });
}
