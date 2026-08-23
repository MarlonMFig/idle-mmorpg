/**
 * Item 34 — Daily Login unificado (oficial only).
 * Run: npx --yes tsx scripts/test-daily-login-unify.ts
 */
import './lib/critical-test-bootstrap';
import { SHOP_CURRENCY_ITEM_ID } from '../src/constants/sealing';
import { onDailyRewardClaimed } from '../src/lib/daily-login-events';
import { mergeDailyLoginWithGemLegacy } from '../src/lib/daily-login-legacy-migration';
import { clearEconomyLedger, listEconomyLedger } from '../src/lib/economy-ledger';
import {
  addDaysToCycleId,
  getDailyCycleId,
  getNextDailyResetMs,
  testTimeProvider,
} from '../src/lib/mission-cycle';
import { rewardIdempotency } from '../src/lib/reward-service';
import { dailyLoginStore } from '../src/stores/daily-login-store';
import { gemStore } from '../src/stores/gem-store';
import { inventoryStore } from '../src/stores/inventory-store';
import {
  FIXED_TEST_NOW_MS,
  cleanupCriticalTestState,
  resetCriticalTestState,
} from './lib/critical-test-harness';

function assert(name: string, cond: boolean): void {
  if (!cond) throw new Error(`FAIL ${name}`);
  console.log(`ok  ${name}`);
}

function resetAll(): void {
  rewardIdempotency.clear();
  clearEconomyLedger();
  dailyLoginStore.reset();
  inventoryStore.reset();
  gemStore.hydrate({ balance: 100, lastLoginDay: null });
}

function applyMigration(): void {
  dailyLoginStore.applyGemLegacyMigration();
}

function main(): void {
  resetCriticalTestState({ fixedClock: true });
  try {
    testTimeProvider.setNow(FIXED_TEST_NOW_MS);
    const today = getDailyCycleId();
    const yesterday = addDaysToCycleId(today, -1);

    // —— 37 official only ——
    resetAll();
    dailyLoginStore.hydrate({ currentDay: 3, lastClaimCycleId: yesterday, totalClaims: 5 });
    gemStore.hydrate({ balance: 100, lastLoginDay: null });
    const beforeOfficial = dailyLoginStore.getPersistedProgress();
    applyMigration();
    const afterOfficial = dailyLoginStore.getPersistedProgress();
    assert(
      'official-only unchanged',
      afterOfficial.currentDay === beforeOfficial.currentDay &&
        afterOfficial.lastClaimCycleId === beforeOfficial.lastClaimCycleId &&
        afterOfficial.totalClaims === beforeOfficial.totalClaims,
    );
    assert('official-only available', dailyLoginStore.isAvailable());

    // —— 38 legacy only ——
    resetAll();
    dailyLoginStore.hydrate(null);
    gemStore.hydrate({ balance: 50, lastLoginDay: today });
    applyMigration();
    assert('legacy-only claimed today → blocked', dailyLoginStore.isAvailable() === false);
    assert('legacy-only currentDay stays 1', dailyLoginStore.getSnapshot().currentDay === 1);
    assert('legacy field cleared', gemStore.getSnapshot().lastLoginDay === null);
    assert('legacy balance untouched', gemStore.getSnapshot().balance === 50);
    applyMigration();
    assert(
      'migration idempotent',
      dailyLoginStore.getSnapshot().lastClaimCycleId === today &&
        dailyLoginStore.getSnapshot().currentDay === 1,
    );

    // —— 39 both unclaimed ——
    resetAll();
    dailyLoginStore.hydrate({ currentDay: 2, lastClaimCycleId: yesterday, totalClaims: 1 });
    gemStore.hydrate({ balance: 10, lastLoginDay: null });
    applyMigration();
    assert('both unclaimed → available', dailyLoginStore.isAvailable());
    const events: number[] = [];
    const offEvt = onDailyRewardClaimed(() => events.push(1));
    const gemsBefore = gemStore.getSnapshot().balance;
    const claim = dailyLoginStore.claim();
    offEvt();
    assert('one claim ok', claim.ok === true);
    assert('one event', events.length === 1);
    assert('gems unchanged by official day2', gemStore.getSnapshot().balance === gemsBefore);
    assert(
      'ledger dailyLogin at most one',
      listEconomyLedger().filter((e) => e.source === 'dailyLogin').length <= 1,
    );

    // —— 40 official claimed / legacy unclaimed ——
    resetAll();
    dailyLoginStore.hydrate({ currentDay: 4, lastClaimCycleId: today, totalClaims: 3 });
    gemStore.hydrate({ balance: 10, lastLoginDay: null });
    applyMigration();
    assert('official claimed → blocked', dailyLoginStore.isAvailable() === false);
    assert('day preserved 4', dailyLoginStore.getSnapshot().currentDay === 4);

    // —— 41 official unclaimed / legacy claimed ——
    resetAll();
    dailyLoginStore.hydrate({ currentDay: 4, lastClaimCycleId: yesterday, totalClaims: 3 });
    gemStore.hydrate({ balance: 10, lastLoginDay: today });
    applyMigration();
    assert('legacy claimed → blocked', dailyLoginStore.isAvailable() === false);
    assert('day stays 4 (not reset)', dailyLoginStore.getSnapshot().currentDay === 4);
    assert('no reward on migration', gemStore.getSnapshot().balance === 10);
    assert('claim blocked after migration', dailyLoginStore.claim().ok === false);

    // —— 42 both claimed ——
    resetAll();
    dailyLoginStore.hydrate({ currentDay: 5, lastClaimCycleId: today, totalClaims: 4 });
    gemStore.hydrate({ balance: 10, lastLoginDay: today });
    applyMigration();
    assert('both claimed → blocked', dailyLoginStore.isAvailable() === false);
    assert('day stays 5', dailyLoginStore.getSnapshot().currentDay === 5);

    // —— 43 day progress ——
    resetAll();
    dailyLoginStore.hydrate({ currentDay: 4, lastClaimCycleId: yesterday, totalClaims: 10 });
    gemStore.hydrate({ lastLoginDay: yesterday });
    applyMigration();
    assert('day 4 preserved', dailyLoginStore.getSnapshot().currentDay === 4);

    // —— merge unit: do not sum sequences ——
    const merged = mergeDailyLoginWithGemLegacy({
      official: { currentDay: 3, lastClaimCycleId: yesterday, totalClaims: 2 },
      legacyLastLoginDay: today,
      currentCycleId: today,
    });
    assert('merge does not invent day 6', merged.state.currentDay === 3);
    assert('merge blocks today', merged.state.lastClaimCycleId === today);

    // —— 45 day 7 wrap (hydrate — não depende de isDevMode / DEV helpers) ——
    resetAll();
    dailyLoginStore.hydrate({
      currentDay: 7,
      lastClaimCycleId: yesterday,
      totalClaims: 6,
    });
    const d7 = dailyLoginStore.claim();
    assert('day 7 claim', d7.ok === true && d7.day === 7);
    assert('wrap to day 1', dailyLoginStore.getSnapshot().currentDay === 1);

    // —— sequência determinística 1→7→1 com advanceDays ——
    resetAll();
    testTimeProvider.setNow(FIXED_TEST_NOW_MS);
    for (let day = 1; day <= 7; day += 1) {
      assert(`seq day ${day} available`, dailyLoginStore.isAvailable());
      assert(`seq currentDay ${day}`, dailyLoginStore.getSnapshot().currentDay === day);
      const r = dailyLoginStore.claim();
      assert(`seq claim day ${day}`, r.ok === true && r.day === day);
      assert(`seq same-day blocked ${day}`, dailyLoginStore.claim().ok === false);
      testTimeProvider.advanceDays(1);
    }
    assert('after day7 next is day1', dailyLoginStore.getSnapshot().currentDay === 1);
    assert('after day7 claim available', dailyLoginStore.isAvailable());

    // —— 46 double click ——
    resetAll();
    testTimeProvider.setNow(FIXED_TEST_NOW_MS);
    dailyLoginStore.hydrate({ currentDay: 1, lastClaimCycleId: yesterday, totalClaims: 0 });
    const a = dailyLoginStore.claim();
    const b = dailyLoginStore.claim();
    assert('double click one reward', a.ok === true && b.ok === false);

    // —— 47/48 reload + 10 reloads ——
    const persist = dailyLoginStore.getPersistedProgress();
    for (let i = 0; i < 10; i += 1) {
      dailyLoginStore.reset();
      dailyLoginStore.hydrate(persist);
      applyMigration();
    }
    assert('10 reloads same state', !dailyLoginStore.isAvailable());
    assert(
      '10 reloads identical',
      dailyLoginStore.getSnapshot().currentDay === persist.currentDay &&
        dailyLoginStore.getSnapshot().lastClaimCycleId === persist.lastClaimCycleId,
    );

    // —— 49 gem balance: official claim does not grant +5 gems ——
    resetAll();
    testTimeProvider.setNow(FIXED_TEST_NOW_MS);
    gemStore.hydrate({ balance: 200, lastLoginDay: null });
    applyMigration();
    const g0 = gemStore.getSnapshot().balance;
    const copper0 = inventoryStore.countItem(SHOP_CURRENCY_ITEM_ID);
    dailyLoginStore.claim();
    assert('official claim does not grant legacy gems', gemStore.getSnapshot().balance === g0);
    assert('official day1 grants copper', inventoryStore.countItem(SHOP_CURRENCY_ITEM_ID) === copper0 + 80);

    // —— Game Cycle + Daily Login integration ——
    testTimeProvider.setNow(FIXED_TEST_NOW_MS);
    resetAll();
    const cycleShared = getDailyCycleId();
    assert('daily sees same cycle id', dailyLoginStore.getCycleId() === cycleShared);
    dailyLoginStore.claim();
    assert('same day second claim blocked', dailyLoginStore.claim().ok === false);
    testTimeProvider.advanceDays(1);
    assert('after advance new cycle', getDailyCycleId() !== cycleShared);
    assert('claim available after advance', dailyLoginStore.isAvailable());

    // —— 52 timezone: SP midnight flip ——
    testTimeProvider.setNow(FIXED_TEST_NOW_MS);
    const dayA = getDailyCycleId();
    const resetMs = getNextDailyResetMs();
    testTimeProvider.setNow(resetMs - 60_000);
    resetAll();
    dailyLoginStore.claim();
    assert('claimed before midnight', !dailyLoginStore.isAvailable());
    testTimeProvider.setNow(resetMs);
    assert('available after SP midnight', dailyLoginStore.isAvailable());
    assert('cycle changed', getDailyCycleId() !== dayA);

    // —— 53 UTC already next calendar day while still dayA in SP ——
    testTimeProvider.setNow(resetMs - 2 * 3600_000);
    const spDay = getDailyCycleId();
    const utcDay = new Date(resetMs - 2 * 3600_000).toISOString().slice(0, 10);
    if (utcDay !== spDay) {
      assert('UTC ahead ignored', spDay === dayA);
    } else {
      console.log('ok  (UTC not ahead — soft-pass)');
    }

    // —— claimDailyLogin removed ——
    assert('claimDailyLogin removed', !('claimDailyLogin' in gemStore));

    console.log('\nAll daily-login-unify tests passed.');
  } finally {
    cleanupCriticalTestState();
  }
}

main();
