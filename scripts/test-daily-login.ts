/**
 * Item 25 — Daily Login (obrigatórios).
 * Run: npx --yes tsx scripts/test-daily-login.ts
 */
import { POTION_ITEM_IDS } from '../src/config/gameConfig';
import { SHOP_CURRENCY_ITEM_ID } from '../src/constants/sealing';
import { onItemGained } from '../src/lib/item-events';
import { getDailyCycleId, clearDevClockOverride } from '../src/lib/mission-cycle';
import { rewardIdempotency } from '../src/lib/reward-service';
import { validateDailyLoginCatalog } from '../src/lib/daily-login-validation';
import { addDaysToCycleId, dailyLoginStore } from '../src/stores/daily-login-store';
import { inventoryStore } from '../src/stores/inventory-store';
import { missionsStore } from '../src/stores/missions-store';

function assert(name: string, cond: boolean): void {
  if (!cond) throw new Error(`FAIL ${name}`);
  console.log(`ok  ${name}`);
}

function resetAll(): void {
  clearDevClockOverride();
  rewardIdempotency.clear();
  dailyLoginStore.reset();
  inventoryStore.reset();
}

function main(): void {
  const warnings = validateDailyLoginCatalog();
  assert('catalog validator clean', warnings.length === 0);

  missionsStore.reset();
  missionsStore.ensureCycles();
  resetAll();
  assert(
    'same daily cycle as missions',
    dailyLoginStore.getCycleId() === getDailyCycleId() &&
      dailyLoginStore.getCycleId() === missionsStore.getSnapshot().daily.cycleId,
  );

  // 45 first claim
  resetAll();
  const copper0 = inventoryStore.countItem(SHOP_CURRENCY_ITEM_ID);
  assert('new player day 1 available', dailyLoginStore.isAvailable() && dailyLoginStore.getSnapshot().currentDay === 1);
  const copperSources: string[] = [];
  const off = onItemGained((itemId, _qty, source) => {
    if (itemId === SHOP_CURRENCY_ITEM_ID) copperSources.push(source);
  });
  const first = dailyLoginStore.claim();
  off();
  assert('first claim ok', first.ok === true && first.day === 1);
  assert('currentDay becomes 2', dailyLoginStore.getSnapshot().currentDay === 2);
  assert('copper granted once', inventoryStore.countItem(SHOP_CURRENCY_ITEM_ID) === copper0 + 80);
  assert('copper source daily-login', copperSources.every((s) => s === 'daily-login') && copperSources.length === 1);
  assert('totalClaims 1', dailyLoginStore.getSnapshot().totalClaims === 1);

  // 46 same day blocked
  const sameDay = dailyLoginStore.claim();
  assert('same day blocked', sameDay.ok === false);
  assert('copper not doubled', inventoryStore.countItem(SHOP_CURRENCY_ITEM_ID) === copper0 + 80);

  // 50 double click
  resetAll();
  const copperStart = inventoryStore.countItem(SHOP_CURRENCY_ITEM_ID);
  const a = dailyLoginStore.claim();
  const b = dailyLoginStore.claim();
  assert('double claim one reward', a.ok === true && b.ok === false && inventoryStore.countItem(SHOP_CURRENCY_ITEM_ID) === copperStart + 80);

  // 51 reload
  const persist = dailyLoginStore.getPersistedProgress();
  dailyLoginStore.reset();
  dailyLoginStore.hydrate(persist);
  assert('reload still claimed', dailyLoginStore.isAvailable() === false);
  const afterReload = dailyLoginStore.claim();
  assert('reload cannot claim again', afterReload.ok === false);

  // 47 new day → day 2
  dailyLoginStore.devSimulateNextDay();
  assert('new cycle available day 2', dailyLoginStore.isAvailable() && dailyLoginStore.getSnapshot().currentDay === 2);
  const day2 = dailyLoginStore.claim();
  assert('day 2 potions', day2.ok === true && inventoryStore.countItem(POTION_ITEM_IDS.normal) === 2);

  // 48 skip 3 days — sequence stays, no backfill
  const beforeSkip = dailyLoginStore.getSnapshot().currentDay;
  assert('after day 2 next is 3', beforeSkip === 3);
  dailyLoginStore.devSimulateNextDay();
  dailyLoginStore.devSimulateNextDay();
  dailyLoginStore.devSimulateNextDay();
  assert('skip days keeps day 3', dailyLoginStore.getSnapshot().currentDay === 3);
  assert('skip days available once', dailyLoginStore.isAvailable());
  const copperBeforeSkipClaim = inventoryStore.countItem(SHOP_CURRENCY_ITEM_ID);
  const skipClaim = dailyLoginStore.claim();
  assert('skip grants only next day', skipClaim.ok === true && skipClaim.day === 3);
  assert(
    'no backfill extra copper days',
    inventoryStore.countItem(SHOP_CURRENCY_ITEM_ID) === copperBeforeSkipClaim + 120,
  );

  // 49 day 7 → day 1
  resetAll();
  dailyLoginStore.devSetDay(7);
  dailyLoginStore.devForceAvailable();
  const day7 = dailyLoginStore.claim();
  assert('day 7 claim', day7.ok === true && day7.day === 7);
  assert('wrap to day 1', dailyLoginStore.getSnapshot().currentDay === 1);
  dailyLoginStore.devSimulateNextDay();
  assert('next cycle is day 1', dailyLoginStore.isAvailable() && dailyLoginStore.getSnapshot().currentDay === 1);

  // 42/44 old save migrate
  dailyLoginStore.reset();
  dailyLoginStore.hydrate(null);
  const migrated = dailyLoginStore.getPersistedProgress();
  assert(
    'old save defaults',
    migrated.currentDay === 1 && migrated.lastClaimCycleId === null && migrated.totalClaims === 0,
  );

  // addDays helper used by DEV simulate
  assert('addDaysToCycleId', addDaysToCycleId('2026-08-20', 1) === '2026-08-21');

  clearDevClockOverride();
  console.log('\nAll daily-login tests passed.');
}

main();
