/**
 * Item 24 — Missions (obrigatórios).
 * Run: npx --yes tsx scripts/test-missions.ts
 */
import './lib/critical-test-bootstrap';
import { DEV_FLAGS, resetDangerousDevOverrides, resetDevLabSessionState } from '../src/config/devConfig';
import { DEFAULT_VITALS } from '../src/constants/hud';
import { SHOP_CURRENCY_ITEM_ID } from '../src/constants/sealing';
import { POTION_ITEM_IDS } from '../src/config/gameConfig';
import {
  DAILY_MISSION_POOL,
  WEEKLY_MISSION_POOL,
  getMissionDefinition,
} from '../src/data/missions/mission-registry';
import { grantMissionRewards } from '../src/lib/mission-rewards';
import { catalogHasCompleteHuntCondition, validateMissionCatalog } from '../src/lib/mission-validation';
import { selectCycleMissions } from '../src/lib/mission-select';
import { setMissionClockOverride } from '../src/lib/mission-cycle';
import { grantMasteryXp } from '../src/lib/grant-mastery-xp';
import { accountStore } from '../src/stores/account-store';
import { inventoryStore } from '../src/stores/inventory-store';
import { missionsStore } from '../src/stores/missions-store';
import { teamStore } from '../src/stores/team-store';
import { vitalsStore } from '../src/stores/vitals-store';
import type { MissionWorldSnapshot } from '../src/types/missions';

function assert(name: string, cond: boolean): void {
  if (!cond) throw new Error(`FAIL ${name}`);
  console.log(`ok  ${name}`);
}

const WORLD_LV1: MissionWorldSnapshot = {
  playerLevel: 1,
  maxCharacterLevel: 1,
  maxMastery: 0,
  maxStars: 0,
  maxAwakening: 0,
  uniqueCharacters: 1,
  hasLineage: false,
  lineageId: null,
  lineageRank: 0,
  hasSpecialization: false,
  specializationLevel: 0,
};

function resetAll(): void {
  missionsStore.reset();
  accountStore.reset();
  teamStore.reset();
  inventoryStore.reset();
  vitalsStore.reset({ ...DEFAULT_VITALS, level: 1, xp: 0, xpMax: 100, hp: 100, hpMax: 100 });
}

function main(): void {
  // Scripts DEV isolam progresso oficial por default (Item 35) — para testar missões
  // oficiais desligamos só o flag de isolate neste processo (sem Lab / sem mudar regras).
  resetDevLabSessionState();
  DEV_FLAGS.isolateOfficialSave = false;
  try {
  const warnings = validateMissionCatalog();
  assert('catalog validator clean', warnings.length === 0);
  assert('no completeHunt condition', catalogHasCompleteHuntCondition() === false);

  // 120 Daily generation + reload same 5
  resetAll();
  setMissionClockOverride(Date.UTC(2026, 7, 20, 12, 0, 0));
  missionsStore.ensureCycles();
  const dailyA = [...missionsStore.getSnapshot().daily.selectedIds];
  assert('daily count 5', dailyA.length === 5);
  const persist = missionsStore.getPersistedProgress();
  missionsStore.reset();
  missionsStore.hydrate(persist);
  missionsStore.ensureCycles();
  assert(
    'daily same after reload',
    missionsStore.getSnapshot().daily.selectedIds.join('|') === dailyA.join('|'),
  );

  // 121 Diversity
  const groups = dailyA.map((id) => getMissionDefinition(id)?.variantGroup);
  assert('daily unique variant groups', new Set(groups).size === groups.length);
  const killFamily = groups.filter((g) => g === 'online-kills' || g === 'hunt-kills' || g === 'lineage-kills');
  assert('daily max 2 kill-family', killFamily.length <= 2);

  const forced = selectCycleMissions(DAILY_MISSION_POOL, 'daily:test-diversity', 5, WORLD_LV1);
  const forcedGroups = forced.map((id) => getMissionDefinition(id)?.variantGroup);
  assert('select 5', forced.length === 5);
  assert('select unique groups', new Set(forcedGroups).size === forcedGroups.length);

  // 122 Online kill +1
  missionsStore.reset();
  missionsStore.hydrate({
    daily: {
      cycleId: missionsStore.getSnapshot().daily.cycleId || '2026-08-20',
      selectedIds: ['daily-online-kills-100'],
      missions: { 'daily-online-kills-100': { progress: 0, completed: false, claimed: false } },
    },
    weekly: {
      cycleId: '2026-W34',
      selectedIds: ['weekly-online-kills-2500'],
      missions: { 'weekly-online-kills-2500': { progress: 0, completed: false, claimed: false } },
    },
    journey: { currentId: 'journey-player-level-5', missions: {} },
  });
  missionsStore.applyGameplayEvent({ kind: 'onlineKill', huntId: 'wonsr-hunt-001', enemyId: 'e1' });
  assert(
    'online kill +1',
    missionsStore.getProgressDisplay('daily-online-kills-100').current === 1,
  );

  // 123/124 Multi-hit / DoT = one applyGameplayEvent per death
  missionsStore.applyGameplayEvent({ kind: 'onlineKill', huntId: 'wonsr-hunt-001', enemyId: 'e2' });
  assert(
    'second death +1 not +n hits',
    missionsStore.getProgressDisplay('daily-online-kills-100').current === 2,
  );

  // 125 Offline +0
  missionsStore.applyGameplayEvent(
    { kind: 'onlineKill', huntId: 'wonsr-hunt-001', enemyId: 'off' },
    'offline',
  );
  assert(
    'offline kills +0',
    missionsStore.getProgressDisplay('daily-online-kills-100').current === 2,
  );
  assert(
    'weekly offline +0',
    missionsStore.getProgressDisplay('weekly-online-kills-2500').current === 2,
  );

  // 126 Hunt specific
  missionsStore.reset();
  missionsStore.hydrate({
    daily: {
      cycleId: '2026-08-20',
      selectedIds: ['daily-hunt-001-kills-80'],
      missions: { 'daily-hunt-001-kills-80': { progress: 0, completed: false, claimed: false } },
    },
    weekly: { cycleId: '2026-W34', selectedIds: [], missions: {} },
    journey: { currentId: 'journey-player-level-5', missions: {} },
  });
  missionsStore.applyGameplayEvent({ kind: 'onlineKill', huntId: 'wonsr-hunt-001', enemyId: 'a' });
  missionsStore.applyGameplayEvent({ kind: 'onlineKill', huntId: 'wonsr-hunt-006', enemyId: 'b' });
  assert(
    'hunt X +1 Y +0',
    missionsStore.getProgressDisplay('daily-hunt-001-kills-80').current === 1,
  );

  // 128 Capture
  missionsStore.reset();
  missionsStore.hydrate({
    daily: {
      cycleId: '2026-08-20',
      selectedIds: ['daily-capture-3'],
      missions: { 'daily-capture-3': { progress: 0, completed: false, claimed: false } },
    },
    weekly: { cycleId: '2026-W34', selectedIds: [], missions: {} },
    journey: { currentId: 'journey-player-level-5', missions: {} },
  });
  missionsStore.applyGameplayEvent({ kind: 'capture' });
  assert('capture +1', missionsStore.getProgressDisplay('daily-capture-3').current === 1);

  // 129 Drop
  missionsStore.reset();
  missionsStore.hydrate({
    daily: {
      cycleId: '2026-08-20',
      selectedIds: ['daily-drops-10'],
      missions: { 'daily-drops-10': { progress: 0, completed: false, claimed: false } },
    },
    weekly: { cycleId: '2026-W34', selectedIds: [], missions: {} },
    journey: { currentId: 'journey-player-level-5', missions: {} },
  });
  missionsStore.applyGameplayEvent({ kind: 'combatDrop', amount: 3, itemId: 'item-hp-potion' });
  assert('drop +3', missionsStore.getProgressDisplay('daily-drops-10').current === 3);

  // 130 Copper combat vs mission reward
  missionsStore.reset();
  missionsStore.hydrate({
    daily: {
      cycleId: '2026-08-20',
      selectedIds: ['daily-copper-combat-200'],
      missions: { 'daily-copper-combat-200': { progress: 0, completed: false, claimed: false } },
    },
    weekly: { cycleId: '2026-W34', selectedIds: [], missions: {} },
    journey: { currentId: 'journey-player-level-5', missions: {} },
  });
  missionsStore.applyGameplayEvent({ kind: 'combatCopper', amount: 50 });
  assert('combat copper counts', missionsStore.getProgressDisplay('daily-copper-combat-200').current === 50);
  grantMissionRewards([{ type: 'copper', amount: 80 }]);
  missionsStore.applyGameplayEvent({ kind: 'combatCopper', amount: 80 }, 'mission-reward');
  assert(
    'mission copper does not count',
    missionsStore.getProgressDisplay('daily-copper-combat-200').current === 50,
  );

  // 131 Potion consume vs fail
  missionsStore.reset();
  missionsStore.hydrate({
    daily: {
      cycleId: '2026-08-20',
      selectedIds: ['daily-potions-3'],
      missions: { 'daily-potions-3': { progress: 0, completed: false, claimed: false } },
    },
    weekly: { cycleId: '2026-W34', selectedIds: [], missions: {} },
    journey: { currentId: 'journey-player-level-5', missions: {} },
  });
  inventoryStore.addItem(POTION_ITEM_IDS.normal, 2, 'unknown');
  const used = inventoryStore.consumeItem(POTION_ITEM_IDS.normal, 1);
  assert('potion consumed', used);
  missionsStore.applyGameplayEvent({ kind: 'potion', amount: 1 });
  assert('potion +1', missionsStore.getProgressDisplay('daily-potions-3').current === 1);
  const failed = inventoryStore.consumeItem(POTION_ITEM_IDS.normal, 99);
  assert('potion fail no consume', failed === false);
  assert('potion fail +0', missionsStore.getProgressDisplay('daily-potions-3').current === 1);

  // 132 Lineage kill
  missionsStore.reset();
  missionsStore.hydrate({
    daily: {
      cycleId: '2026-08-20',
      selectedIds: ['daily-lineage-kills-100'],
      missions: { 'daily-lineage-kills-100': { progress: 0, completed: false, claimed: false } },
    },
    weekly: { cycleId: '2026-W34', selectedIds: [], missions: {} },
    journey: { currentId: 'journey-player-level-5', missions: {} },
  });
  missionsStore.applyGameplayEvent({ kind: 'onlineKill', lineageCompatible: true, enemyId: 'c1' });
  missionsStore.applyGameplayEvent({ kind: 'onlineKill', lineageCompatible: false, enemyId: 'c2' });
  assert(
    'lineage compatible only',
    missionsStore.getProgressDisplay('daily-lineage-kills-100').current === 1,
  );

  // 133 Reset daily — new cycle no transfer
  const oldProgress = missionsStore.getProgressDisplay('daily-lineage-kills-100').current;
  assert('had progress', oldProgress === 1);
  setMissionClockOverride(Date.UTC(2026, 7, 21, 12, 0, 0));
  missionsStore.ensureCycles();
  assert('new daily cycle', missionsStore.getSnapshot().daily.cycleId !== '2026-08-20');
  const stillOld = missionsStore.getEntry('daily-lineage-kills-100');
  assert('old daily not carried', !stillOld || !missionsStore.getSnapshot().daily.selectedIds.includes('daily-lineage-kills-100') || missionsStore.getSnapshot().daily.missions['daily-lineage-kills-100']?.progress === 0);

  // 134 Unclaimed expires
  setMissionClockOverride(Date.UTC(2026, 7, 20, 12, 0, 0));
  missionsStore.reset();
  missionsStore.hydrate({
    daily: {
      cycleId: '2026-08-20',
      selectedIds: ['daily-online-kills-100'],
      missions: { 'daily-online-kills-100': { progress: 100, completed: true, claimed: false } },
    },
    weekly: { cycleId: '2026-W34', selectedIds: [], missions: {} },
    journey: { currentId: 'journey-player-level-5', missions: {} },
  });
  setMissionClockOverride(Date.UTC(2026, 7, 21, 12, 0, 0));
  missionsStore.ensureCycles();
  const claimExpired = missionsStore.claim('daily-online-kills-100');
  assert('expired unclaimed cannot claim', claimExpired.ok === false);

  // 135 Weekly same logic
  setMissionClockOverride(Date.UTC(2026, 7, 17, 12, 0, 0)); // Monday
  missionsStore.reset();
  missionsStore.ensureCycles();
  const weeklyA = [...missionsStore.getSnapshot().weekly.selectedIds];
  assert('weekly 5', weeklyA.length === 5);
  const weeklyPersist = missionsStore.getPersistedProgress();
  missionsStore.hydrate(weeklyPersist);
  missionsStore.ensureCycles();
  assert(
    'weekly same reload',
    missionsStore.getSnapshot().weekly.selectedIds.join('|') === weeklyA.join('|'),
  );

  // 136 Journey retroactive
  resetAll();
  setMissionClockOverride(Date.UTC(2026, 7, 20, 12, 0, 0));
  vitalsStore.reset({ ...DEFAULT_VITALS, level: 30, xp: 0, xpMax: 100, hp: 100, hpMax: 100 });
  missionsStore.hydrate({
    daily: { cycleId: '2026-08-20', selectedIds: [], missions: {} },
    weekly: { cycleId: '2026-W34', selectedIds: [], missions: {} },
    journey: {
      currentId: 'journey-player-level-20',
      missions: { 'journey-player-level-20': { progress: 0, completed: false, claimed: false } },
    },
  });
  missionsStore.syncStateMissions({ silent: true });
  assert('journey level 20 completes at 30', missionsStore.getStatus('journey-player-level-20') === 'completed');

  // 137 Journey order
  const skip = missionsStore.claim('journey-player-level-40');
  assert('cannot claim future journey', skip.ok === false);

  // 138-140 Claim / double / claim all
  resetAll();
  vitalsStore.reset({ ...DEFAULT_VITALS, level: 10, xp: 0, xpMax: 100, hp: 100, hpMax: 100 });
  missionsStore.hydrate({
    daily: {
      cycleId: getMissionDefinition('daily-online-kills-100') ? '2026-08-20' : '2026-08-20',
      selectedIds: ['daily-online-kills-100', 'daily-drops-10'],
      missions: {
        'daily-online-kills-100': { progress: 100, completed: true, claimed: false },
        'daily-drops-10': { progress: 10, completed: true, claimed: false },
      },
    },
    weekly: { cycleId: '2026-W34', selectedIds: [], missions: {} },
    journey: {
      currentId: 'journey-player-level-5',
      missions: { 'journey-player-level-5': { progress: 5, completed: true, claimed: false } },
    },
  });
  setMissionClockOverride(Date.UTC(2026, 7, 20, 15, 0, 0));
  missionsStore.ensureCycles();
  // ensureCycles may regenerate daily because clock day matches but we hydrated cycle 2026-08-20
  // Re-apply completed state if regenerated
  const copperBefore = inventoryStore.countItem(SHOP_CURRENCY_ITEM_ID);
  const first = missionsStore.claim('journey-player-level-5');
  assert('claim ok', first.ok);
  const copperMid = inventoryStore.countItem(SHOP_CURRENCY_ITEM_ID);
  assert('reward once', copperMid > copperBefore);
  const second = missionsStore.claim('journey-player-level-5');
  assert('double claim blocked', second.ok === false);
  assert('copper unchanged', inventoryStore.countItem(SHOP_CURRENCY_ITEM_ID) === copperMid);
  assert(
    'journey advanced',
    missionsStore.getSnapshot().journey.currentId === 'journey-capture-1',
  );

  // Force two completed dailies in CURRENT cycle
  const cycleId = missionsStore.getSnapshot().daily.cycleId;
  const ids = missionsStore.getSnapshot().daily.selectedIds.slice(0, 2);
  if (ids.length === 2) {
    missionsStore.hydrate({
      ...missionsStore.getPersistedProgress(),
      daily: {
        cycleId,
        selectedIds: missionsStore.getSnapshot().daily.selectedIds,
        missions: {
          ...missionsStore.getSnapshot().daily.missions,
          [ids[0]]: { progress: 999, completed: true, claimed: false },
          [ids[1]]: { progress: 999, completed: true, claimed: false },
        },
      },
    });
    const all = missionsStore.claimAll('daily');
    assert('claim all at least 2', all.claimed.length >= 2);
    const again = missionsStore.claimAll('daily');
    assert('claim all second empty', again.claimed.length === 0);
  }

  // 142 DEV force mastery xp ignored
  resetAll();
  missionsStore.hydrate({
    daily: {
      cycleId: '2026-08-20',
      selectedIds: ['daily-mastery-xp-200'],
      missions: { 'daily-mastery-xp-200': { progress: 0, completed: false, claimed: false } },
    },
    weekly: { cycleId: '2026-W34', selectedIds: [], missions: {} },
    journey: { currentId: 'journey-player-level-5', missions: {} },
  });
  const inst = teamStore.getSnapshot().collection[0];
  if (inst) {
    grantMasteryXp(inst.id, 50, { force: true });
  }
  assert(
    'dev mastery force not counted',
    missionsStore.getProgressDisplay('daily-mastery-xp-200').current === 0,
  );
  missionsStore.applyGameplayEvent({ kind: 'masteryXp', amount: 50 }, 'dev');
  assert('dev source ignored', missionsStore.getProgressDisplay('daily-mastery-xp-200').current === 0);
  missionsStore.applyGameplayEvent({ kind: 'masteryXp', amount: 50 }, 'gameplay');
  assert('gameplay mastery counted', missionsStore.getProgressDisplay('daily-mastery-xp-200').current === 50);

  // 143 Save
  const saved = missionsStore.getPersistedProgress();
  missionsStore.reset();
  missionsStore.hydrate(saved);
  assert(
    'save mastery progress',
    missionsStore.getProgressDisplay('daily-mastery-xp-200').current === 50,
  );

  // 144 new cycle after reload
  setMissionClockOverride(Date.UTC(2026, 7, 22, 12, 0, 0));
  missionsStore.ensureCycles();
  assert('cycle advanced after time jump', missionsStore.getSnapshot().daily.cycleId === '2026-08-22');

  assert('weekly pool exists', WEEKLY_MISSION_POOL.length >= 8);

  setMissionClockOverride(null);
  console.log('\nAll mission tests passed.');
  } finally {
    setMissionClockOverride(null);
    resetDevLabSessionState();
    resetDangerousDevOverrides();
  }
}

main();
