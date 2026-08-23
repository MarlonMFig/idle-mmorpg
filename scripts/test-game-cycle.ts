/**
 * Item 33 — Game Cycle / TimeProvider consistency.
 * Run: npx --yes tsx scripts/test-game-cycle.ts
 */
import './lib/critical-test-bootstrap';
import { OFFLINE_LIMITS, computeEffectiveOfflineDuration, MS_PER_OFFLINE_HOUR } from '../src/constants/offline';
import {
  advanceDevToNextDay,
  advanceDevToNextWeek,
  getDailyCycleId,
  getNextDailyResetMs,
  getNextWeeklyResetMs,
  getWeeklyCycleId,
  resetDevTime,
  testTimeProvider,
} from '../src/lib/mission-cycle';
import { normalizeLegacyGemLoginDay, gemStore } from '../src/stores/gem-store';
import { dailyLoginStore } from '../src/stores/daily-login-store';
import { missionsStore } from '../src/stores/missions-store';
import { shopStore } from '../src/stores/shop-store';
import {
  FIXED_TEST_NOW_MS,
  cleanupCriticalTestState,
  resetCriticalTestState,
} from './lib/critical-test-harness';

function assert(name: string, cond: boolean): void {
  if (!cond) throw new Error(`FAIL ${name}`);
  console.log(`ok  ${name}`);
}

function allDailyIds(): string[] {
  missionsStore.ensureCycles();
  return [
    getDailyCycleId(),
    missionsStore.getSnapshot().daily.cycleId,
    dailyLoginStore.getCycleId(),
  ];
}

function main(): void {
  resetCriticalTestState({ fixedClock: true });
  try {
    // —— 23:59 SP → same day across systems ——
    testTimeProvider.setNow(FIXED_TEST_NOW_MS);
    const dayA = getDailyCycleId();
    const reset = getNextDailyResetMs();
    testTimeProvider.setNow(reset - 60_000); // 1 min before SP midnight
    const beforeIds = allDailyIds();
    assert('pre-midnight all same', beforeIds.every((id) => id === beforeIds[0]));
    assert('pre-midnight is day A', beforeIds[0] === dayA);

    dailyLoginStore.devForceAvailable();
    assert('daily login available at 23:59', dailyLoginStore.isAvailable());
    const claimA = dailyLoginStore.claim();
    assert('claim at 23:59', claimA.ok === true);
    assert('same cycle cannot claim twice', dailyLoginStore.claim().ok === false);

    // —— 00:00 SP → new cycle together ——
    testTimeProvider.setNow(reset);
    missionsStore.ensureCycles();
    const afterIds = allDailyIds();
    assert('post-midnight all same', afterIds.every((id) => id === afterIds[0]));
    assert('post-midnight new day', afterIds[0] !== dayA);
    assert('daily login available after flip', dailyLoginStore.isAvailable());

    // —— UTC already next day, SP still previous ——
    testTimeProvider.setNow(reset - 2 * 3600_000);
    const spStill = getDailyCycleId();
    const utcIsoDay = new Date(reset - 2 * 3600_000).toISOString().slice(0, 10);
    assert('SP day before reset', spStill === dayA);
    if (utcIsoDay !== dayA) {
      assert('game ignores early UTC day', getDailyCycleId() === dayA && getDailyCycleId() !== utcIsoDay);
    } else {
      console.log('ok  (UTC not ahead in this window — SP lag check soft-pass)');
    }

    // —— Browser TZ independence ——
    testTimeProvider.setNow(reset - 60_000);
    const idSp = getDailyCycleId();
    const prevTz = process.env.TZ;
    process.env.TZ = 'America/Los_Angeles';
    const idLa = getDailyCycleId();
    process.env.TZ = 'UTC';
    const idUtc = getDailyCycleId();
    process.env.TZ = 'Europe/Berlin';
    const idEu = getDailyCycleId();
    process.env.TZ = prevTz;
    assert('same cycle under LA/UTC/Berlin env', idSp === idLa && idLa === idUtc && idUtc === idEu);

    // —— Weekly: Sunday 23:59 same week; Monday 00:00 new week ——
    testTimeProvider.setNow(Date.UTC(2026, 7, 19, 15, 0, 0)); // Wed
    const weekA = getWeeklyCycleId();
    const weekReset = getNextWeeklyResetMs();
    testTimeProvider.setNow(weekReset - 60_000);
    assert('sunday-ish still same week', getWeeklyCycleId() === weekA);
    testTimeProvider.setNow(weekReset);
    assert('monday reset new week', getWeeklyCycleId() !== weekA);

    // —— Missions only regenerate on cycle change ——
    testTimeProvider.setNow(FIXED_TEST_NOW_MS);
    missionsStore.reset();
    missionsStore.ensureCycles();
    const pool1 = missionsStore.getSnapshot().daily.selectedIds.join(',');
    const cycle1 = missionsStore.getSnapshot().daily.cycleId;
    for (let i = 0; i < 10; i += 1) {
      missionsStore.ensureCycles();
    }
    assert(
      '10 reloads same daily pool',
      missionsStore.getSnapshot().daily.cycleId === cycle1 &&
        missionsStore.getSnapshot().daily.selectedIds.join(',') === pool1,
    );

    const purchases = shopStore.getSnapshot().purchases;
    assert('shop store reachable', typeof purchases === 'object');

    const f2p = computeEffectiveOfflineDuration(10 * MS_PER_OFFLINE_HOUR, false);
    const vip = computeEffectiveOfflineDuration(10 * MS_PER_OFFLINE_HOUR, true);
    assert('offline non-VIP cap 4h', f2p.effectiveOfflineDuration === OFFLINE_LIMITS.nonVipHours * MS_PER_OFFLINE_HOUR);
    assert('offline VIP cap 8h', vip.effectiveOfflineDuration === OFFLINE_LIMITS.vipHours * MS_PER_OFFLINE_HOUR);

    assert('legacy ymd passthrough', normalizeLegacyGemLoginDay('2026-08-20') === '2026-08-20');
    assert(
      'legacy unparseable → current cycle (no free claim)',
      normalizeLegacyGemLoginDay('??not-a-date??') === getDailyCycleId(),
    );

    // —— Shared clock: advanceDevToNextDay moves the same TimeProvider getDailyCycleId reads ——
    testTimeProvider.setNow(FIXED_TEST_NOW_MS);
    const d0 = getDailyCycleId();
    const afterAdvance = advanceDevToNextDay();
    assert('devSimulateNextDay advances shared clock', afterAdvance !== d0 && getDailyCycleId() !== d0);
    assert('missions see same after shared next day', dailyLoginStore.getCycleId() === getDailyCycleId());

    // —— Exactly one SP civil day ——
    testTimeProvider.setNow(FIXED_TEST_NOW_MS);
    const beforeDay = getDailyCycleId();
    const nextDay = testTimeProvider.advanceDays(1);
    assert('advanceDays(1) is next SP day', nextDay !== beforeDay);

    // —— Store facade still advances shared clock when DEV ——
    testTimeProvider.setNow(FIXED_TEST_NOW_MS);
    const beforeStore = getDailyCycleId();
    dailyLoginStore.devSimulateNextDay();
    assert('store.devSimulateNextDay same clock', getDailyCycleId() !== beforeStore);

    // —— Weekly advance ——
    testTimeProvider.setNow(Date.UTC(2026, 7, 19, 15, 0, 0));
    const w0 = getWeeklyCycleId();
    assert('advanceWeeks changes weekly id', advanceDevToNextWeek() !== w0);

    // —— resetDevTime clears override ——
    testTimeProvider.setNow(FIXED_TEST_NOW_MS);
    assert('override active before reset', testTimeProvider.now() === FIXED_TEST_NOW_MS);
    resetDevTime();
    assert('resetDevTime clears override', Math.abs(testTimeProvider.now() - Date.now()) < 5_000);

    console.log('\nAll game-cycle tests passed.');
  } finally {
    cleanupCriticalTestState();
  }
}

main();
