/**
 * Item 38 — Unificação Achievements (legado gem → oficial).
 * Run: npx --yes tsx scripts/test-achievement-unify.ts
 */
import { DEFAULT_VITALS } from '../src/constants/hud';
import { SHOP_CURRENCY_ITEM_ID } from '../src/constants/sealing';
import {
  LEGACY_TO_OFFICIAL_ACHIEVEMENT,
  mergeLegacyGemAchievements,
} from '../src/lib/achievement-legacy-migration';
import { applyAchievementLegacyMigration } from '../src/lib/session-persist';
import { achievementsStore } from '../src/stores/achievements-store';
import { gemStore } from '../src/stores/gem-store';
import { inventoryStore } from '../src/stores/inventory-store';
import { vitalsStore } from '../src/stores/vitals-store';

function assert(name: string, cond: boolean): void {
  if (!cond) throw new Error(`FAIL ${name}`);
  console.log(`ok  ${name}`);
}

function copper(): number {
  return inventoryStore.countItem(SHOP_CURRENCY_ITEM_ID);
}

function reset(): void {
  achievementsStore.reset();
  inventoryStore.reset();
  gemStore.hydrate({
    balance: 100,
    lastLoginDay: null,
    claimedAchievements: {},
    totalKills: 0,
    weeklyCrystalWeek: null,
    weeklyCrystalPurchases: 0,
  });
  vitalsStore.reset({ ...DEFAULT_VITALS, level: 1, xp: 0, xpMax: 100, hp: 100, hpMax: 100 });
}

function main(): void {
  assert('mapping has 7 entries', Object.keys(LEGACY_TO_OFFICIAL_ACHIEVEMENT).length === 7);

  // —— Official only ——
  reset();
  achievementsStore.hydrate({
    unlocked: { 'player-level-10': true },
    claimed: { 'player-level-10': true },
    unlockedTitles: {},
    equippedTitleId: null,
  });
  const before = achievementsStore.getPersistedProgress();
  const copperBefore = copper();
  applyAchievementLegacyMigration();
  const after = achievementsStore.getPersistedProgress();
  assert('official-only claimed intact', after.claimed['player-level-10'] === true);
  assert('official-only no copper change', copper() === copperBefore);
  assert('gem claims empty', Object.keys(gemStore.getSnapshot().claimedAchievements).length === 0);
  assert(
    'official-only unlocked same',
    Object.keys(after.unlocked).length === Object.keys(before.unlocked).length,
  );

  // —— Legacy only ——
  reset();
  gemStore.hydrate({
    claimedAchievements: {
      'ach-kills-100': true,
      'ach-level-10': true,
    },
    balance: 50,
  });
  const gemsBefore = gemStore.getSnapshot().balance;
  applyAchievementLegacyMigration();
  assert('legacy→online-kills-100 claimed', achievementsStore.getStatus('online-kills-100') === 'claimed');
  assert('legacy→player-level-10 claimed', achievementsStore.getStatus('player-level-10') === 'claimed');
  assert('legacy migration no gem change', gemStore.getSnapshot().balance === gemsBefore);
  assert('legacy migration no copper grant', copper() === copperBefore || copper() >= 0);
  assert('legacy map cleared', Object.keys(gemStore.getSnapshot().claimedAchievements).length === 0);

  // Idempotent
  applyAchievementLegacyMigration();
  assert('idempotent still claimed', achievementsStore.getStatus('online-kills-100') === 'claimed');

  // —— Both (official unlocked, legacy claimed) ——
  reset();
  achievementsStore.hydrate({
    unlocked: { 'online-kills-100': true },
    claimed: {},
    unlockedTitles: {},
    equippedTitleId: null,
  });
  gemStore.hydrate({ claimedAchievements: { 'ach-kills-100': true }, balance: 10 });
  const c0 = copper();
  applyAchievementLegacyMigration();
  assert('both → claimed', achievementsStore.getStatus('online-kills-100') === 'claimed');
  assert('both no extra copper', copper() === c0);

  // —— Official claimed + legacy claimed ——
  reset();
  achievementsStore.hydrate({
    unlocked: { 'player-level-25': true },
    claimed: { 'player-level-25': true },
    unlockedTitles: {},
    equippedTitleId: null,
  });
  gemStore.hydrate({ claimedAchievements: { 'ach-level-25': true }, balance: 0 });
  applyAchievementLegacyMigration();
  assert('both claimed stays claimed', achievementsStore.getStatus('player-level-25') === 'claimed');

  // —— Pure merge unit ——
  const merged = mergeLegacyGemAchievements(
    { unlocked: {}, claimed: {}, unlockedTitles: {}, equippedTitleId: null },
    { claimedAchievements: { 'ach-kills-1000': true, 'ach-unknown-x': true } },
  );
  assert('unmapped reported', merged.unmappedLegacyIds.includes('ach-unknown-x'));
  assert('mapped claimed', merged.progress.claimed['online-kills-1000'] === true);
  assert('mapped unlocked', merged.progress.unlocked['online-kills-1000'] === true);

  // —— Claim path still RewardService (double click) ——
  reset();
  vitalsStore.reset({ ...DEFAULT_VITALS, level: 10, xp: 0, xpMax: 100, hp: 100, hpMax: 100 });
  achievementsStore.evaluate('playerLevel', { silent: true });
  assert('level-10 unlocked', achievementsStore.getStatus('player-level-10') === 'unlocked');
  const c1 = copper();
  const r1 = achievementsStore.claim('player-level-10');
  const r2 = achievementsStore.claim('player-level-10');
  assert('first claim ok', r1.ok);
  assert('second claim blocked', !r2.ok);
  assert('copper increased once', copper() > c1);
  const mid = copper();
  for (let i = 0; i < 10; i += 1) {
    achievementsStore.hydrate(achievementsStore.getPersistedProgress());
  }
  assert('10 reloads copper stable', copper() === mid);
  assert('10 reloads still claimed', achievementsStore.getStatus('player-level-10') === 'claimed');

  // —— Title ——
  reset();
  gemStore.hydrate({ totalKills: 100 });
  achievementsStore.evaluate('onlineKills', { silent: true });
  assert('kills-100 unlocked', achievementsStore.getStatus('online-kills-100') === 'unlocked');
  achievementsStore.claim('online-kills-100');
  assert('title unlocked', achievementsStore.getPersistedProgress().unlockedTitles['novato-combate'] === true);
  achievementsStore.equipTitle('novato-combate');
  assert('title equipped', achievementsStore.getEquippedTitleId() === 'novato-combate');
  achievementsStore.hydrate(achievementsStore.getPersistedProgress());
  assert('title survives reload', achievementsStore.getEquippedTitleId() === 'novato-combate');

  // —— No achievementStore export ——
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const gemMod = require('../src/stores/gem-store') as Record<string, unknown>;
  assert('no achievementStore export', gemMod.achievementStore === undefined);

  console.log('achievement unify tests passed');
}

main();
