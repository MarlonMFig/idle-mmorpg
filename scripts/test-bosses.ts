/**
 * Item 26 — Boss foundation (obrigatórios).
 * Run: npx --yes tsx scripts/test-bosses.ts
 */
import { SHOP_CURRENCY_ITEM_ID } from '../src/constants/sealing';
import { POTION_ITEM_IDS } from '../src/config/gameConfig';
import { TEST_BOSS_ID } from '../src/data/bosses/boss-registry';
import { createBossAiState, decideBossAction } from '../src/lib/boss-ai';
import { onBossDefeated } from '../src/lib/boss-events';
import { validateBossCatalog } from '../src/lib/boss-validation';
import { consumeAttempt, remainingAttempts, resolveBossPhase } from '../src/lib/boss-runtime';
import { getBossDefinition } from '../src/data/bosses/boss-registry';
import { inventoryStore } from '../src/stores/inventory-store';
import { bossStore } from '../src/stores/boss-store';
import { locationStore } from '../src/stores/location-store';
import { vitalsStore } from '../src/stores/vitals-store';

function assert(name: string, cond: boolean): void {
  if (!cond) throw new Error(`FAIL ${name}`);
  console.log(`ok  ${name}`);
}

function resetAll(): void {
  bossStore.reset();
  inventoryStore.reset();
  locationStore.reset();
  vitalsStore.reset();
}

function main(): void {
  const warnings = validateBossCatalog();
  assert('catalog validator clean', warnings.length === 0);

  const def = getBossDefinition(TEST_BOSS_ID)!;
  assert('one test boss', def.id === TEST_BOSS_ID);
  assert('two phases', def.phases.length === 2);

  const p1 = resolveBossPhase(0.8, def.phases);
  const p2 = resolveBossPhase(0.5, def.phases);
  const p2b = resolveBossPhase(0.49, def.phases);
  assert('phase 1 above 50%', p1?.id === 'phase-1');
  assert('phase 2 at 50%', p2?.id === 'phase-2');
  assert('phase 2 below 50%', p2b?.id === 'phase-2');

  resetAll();
  let defeatedEvents = 0;
  const off = onBossDefeated(() => {
    defeatedEvents += 1;
  });
  const start = bossStore.startAttempt(TEST_BOSS_ID, 1_000);
  assert('start attempt', start.ok === true);
  assert('attempts used 1', bossStore.getRemainingAttempts(TEST_BOSS_ID) === 2);
  bossStore.syncFromEnemy(0, def.hp);
  const victory = bossStore.finishVictory({ officialReward: true });
  assert('one victory', victory?.victory === true);
  assert('one event', defeatedEvents === 1);
  off();

  const pending = bossStore.getSnapshot().pendingReward;
  assert('pending reward', Boolean(pending && !pending.claimed));
  const copper0 = inventoryStore.countItem(SHOP_CURRENCY_ITEM_ID);
  const potion0 = inventoryStore.countItem(POTION_ITEM_IDS.normal);
  const claim1 = bossStore.claimPending();
  const claim2 = bossStore.claimPending();
  assert('claim once', claim1.ok === true);
  assert('double claim blocked', claim2.ok === false);
  assert('copper granted', inventoryStore.countItem(SHOP_CURRENCY_ITEM_ID) === copper0 + 220 + 80);
  assert('potion granted', inventoryStore.countItem(POTION_ITEM_IDS.normal) === potion0 + 1);

  resetAll();
  defeatedEvents = 0;
  const offMulti = onBossDefeated(() => {
    defeatedEvents += 1;
  });
  bossStore.startAttempt(TEST_BOSS_ID, 1_100);
  bossStore.finishVictory({ officialReward: false });
  bossStore.finishVictory({ officialReward: false });
  offMulti();
  assert('multi-hit one victory', defeatedEvents === 1);

  resetAll();
  bossStore.startAttempt(TEST_BOSS_ID, 2_000);
  const persist = bossStore.getPersistedProgress();
  persist.pendingReward = {
    claimId: 'boss-reward:test:reload',
    bossId: TEST_BOSS_ID,
    instanceId: 'inst',
    rewards: [{ type: 'copper', amount: 10 }],
    firstClear: false,
    claimed: false,
  };
  bossStore.reset();
  bossStore.hydrate(persist);
  assert('reload pending same', bossStore.getSnapshot().pendingReward?.claimId === 'boss-reward:test:reload');
  const copperA = inventoryStore.countItem(SHOP_CURRENCY_ITEM_ID);
  bossStore.claimPending();
  bossStore.claimPending();
  assert('reload claim once', inventoryStore.countItem(SHOP_CURRENCY_ITEM_ID) === copperA + 10);

  resetAll();
  bossStore.startAttempt(TEST_BOSS_ID, 3_000);
  const timeout = bossStore.tickTimer(180_000);
  assert('timeout ready', timeout === true);
  const defeat = bossStore.finishDefeat('timeout');
  assert('timeout defeat', defeat?.victory === false && defeat.defeatReason === 'timeout');

  resetAll();
  bossStore.startAttempt(TEST_BOSS_ID, 4_000);
  const death = bossStore.finishDefeat('player-death');
  assert('player death defeat', death?.defeatReason === 'player-death');

  resetAll();
  bossStore.startAttempt(TEST_BOSS_ID, 5_000);
  const left = bossStore.getRemainingAttempts(TEST_BOSS_ID);
  bossStore.finishDefeat('abandon');
  assert('abandon consumes attempt', bossStore.getRemainingAttempts(TEST_BOSS_ID) === left);

  resetAll();
  bossStore.startAttempt(TEST_BOSS_ID, 6_000);
  bossStore.syncFromEnemy(def.hp, def.hp);
  assert('phase start 1', bossStore.getSnapshot().runtime?.phaseId === 'phase-1');
  bossStore.syncFromEnemy(Math.floor(def.hp * 0.4), def.hp);
  assert('cross 50% once', bossStore.getSnapshot().runtime?.phaseId === 'phase-2');
  const skills = bossStore.currentSkills();
  assert('phase 2 skills', skills.includes('skill-raikiri'));

  resetAll();
  bossStore.startAttempt(TEST_BOSS_ID, 7_000);
  bossStore.startAttempt(TEST_BOSS_ID, 8_000);
  bossStore.startAttempt(TEST_BOSS_ID, 9_000);
  const blocked = bossStore.startAttempt(TEST_BOSS_ID, 10_000);
  assert('max attempts', blocked.ok === false);
  assert('not negative', remainingAttempts(3, 3) === 0);
  assert('consume clamp', consumeAttempt(3, 3) === 3);

  const ai = createBossAiState();
  const first = decideBossAction({
    now: 0,
    state: ai,
    skillIds: def.skills,
    stunned: false,
    skillGapMs: 0,
    selfHpRatio: 1,
    targetHpRatio: 1,
  });
  const second = decideBossAction({
    now: 1,
    state: ai,
    skillIds: def.skills,
    stunned: false,
    skillGapMs: 0,
    selfHpRatio: 1,
    targetHpRatio: 1,
  });
  assert(
    'ai rotation fairness',
    first.action.kind === 'skill' &&
      second.action.kind === 'skill' &&
      first.action.slot !== second.action.slot,
  );

  locationStore.enterBoss(def.mapKey, def.id);
  assert('encounter is boss not hunt', locationStore.getSnapshot().encounterKind === 'boss');
  assert('huntId empty', locationStore.getSnapshot().huntId === null);
  locationStore.enterHub();
  assert('return hub', locationStore.getSnapshot().mode === 'hub' && locationStore.getSnapshot().encounterKind === 'hunt');

  console.log('\nAll boss foundation tests passed.');
}

main();
