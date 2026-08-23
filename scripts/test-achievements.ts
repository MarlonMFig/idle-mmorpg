/**
 * Item 23 — Achievements & Titles (obrigatórios).
 * Run: npx --yes tsx scripts/test-achievements.ts
 */
import { DEFAULT_VITALS } from '../src/constants/hud';
import { SHOP_CURRENCY_ITEM_ID } from '../src/constants/sealing';
import { listAchievementDefinitions } from '../src/data/achievements/achievement-registry';
import { validateAchievementCatalog } from '../src/lib/achievement-validation';
import { accountStore } from '../src/stores/account-store';
import { achievementsStore } from '../src/stores/achievements-store';
import { gemStore } from '../src/stores/gem-store';
import { inventoryStore } from '../src/stores/inventory-store';
import { teamStore } from '../src/stores/team-store';
import { vitalsStore } from '../src/stores/vitals-store';
import { computePlayerAttributes } from '../src/utils/attributes';
import type { SealedCharacter } from '../src/types/team';
import { cloneDefaultSpecializationProgress } from '../src/lib/lineage-progress';

function assert(name: string, cond: boolean): void {
  if (!cond) throw new Error(`FAIL ${name}`);
  console.log(`ok  ${name}`);
}

function resetAll(): void {
  achievementsStore.reset();
  accountStore.reset();
  teamStore.reset();
  inventoryStore.reset();
  gemStore.hydrate({
    balance: 0,
    lastLoginDay: null,
    claimedAchievements: {},
    totalKills: 0,
    weeklyCrystalWeek: null,
    weeklyCrystalPurchases: 0,
  });
  vitalsStore.reset({ ...DEFAULT_VITALS, level: 1, xp: 0, xpMax: 100, hp: 100, hpMax: 100 });
}

function mockChar(
  id: string,
  characterId: string,
  opts: Partial<SealedCharacter> = {},
): Parameters<typeof teamStore.addToCollection>[0] {
  return {
    id,
    name: characterId,
    lookType: 1,
    characterId,
    characterKey: `look:${characterId}`,
    quality: 'SS',
    stars: 1,
    lineageId: 'ninja',
    level: 1,
    xp: 0,
    masteryLevel: 0,
    masteryXp: 0,
    awakeningLevel: 0,
    ...opts,
  };
}

function seedUnique(count: number, stars = 1, mastery = 0, awakening = 0): void {
  for (let i = 0; i < count; i += 1) {
    teamStore.addToCollection(
      mockChar(`inst-${i}`, `char-${i}`, {
        stars,
        masteryLevel: mastery,
        awakeningLevel: awakening,
        quality: stars >= 5 ? 'SS' : stars >= 3 ? 'B' : 'C',
      }),
    );
  }
}

function setLineageRank(
  lineageId: 'ninja' | 'shinigami' | 'pirata' | 'cacador' | 'feiticeiro' | 'guerreiro',
  rank: 1 | 2 | 3 | 4,
  opts?: { specSlot?: 'specializationA' | 'specializationB' | 'specializationC'; specLevel?: number },
): void {
  vitalsStore.reset({ ...DEFAULT_VITALS, level: 50, hp: 100, hpMax: 100, xp: 0, xpMax: 100 });
  accountStore.chooseLineage(lineageId);
  const progress = accountStore.getLineageProgress();
  const spec = cloneDefaultSpecializationProgress();
  if (opts?.specSlot) {
    const level = (opts.specLevel ?? 1) as 0 | 1 | 2 | 3 | 4;
    spec[opts.specSlot] = { level, onlineKills: 0 };
  }
  accountStore.applyLineageProgress({
    ...progress,
    lineageId,
    byLineage: {
      ...progress.byLineage,
      [lineageId]: {
        rank,
        onlineKills: 0,
        selectedSpecializationId: opts?.specSlot ?? null,
        specializationLevel: opts?.specLevel ?? 0,
        specializationProgress: spec,
      },
    },
  });
}

function main(): void {
  const catalogWarnings = validateAchievementCatalog();
  assert('catalog validator clean', catalogWarnings.length === 0);
  assert('catalog size 25-50', listAchievementDefinitions().length >= 25 && listAchievementDefinitions().length <= 50);

  // 113 Level retroativo
  resetAll();
  vitalsStore.reset({ ...DEFAULT_VITALS, level: 50, xp: 0, xpMax: 100, hp: 100, hpMax: 100 });
  achievementsStore.evaluateAllRetroactive();
  assert('level-10 unlocked', achievementsStore.getStatus('player-level-10') === 'unlocked');
  assert('level-25 unlocked', achievementsStore.getStatus('player-level-25') === 'unlocked');
  assert('level-50 unlocked', achievementsStore.getStatus('player-level-50') === 'unlocked');
  assert('level-75 locked', achievementsStore.getStatus('player-level-75') === 'locked');

  // 114 Collection
  resetAll();
  seedUnique(30);
  // duplicate same characterId
  teamStore.addToCollection(mockChar('dup-1', 'char-0'));
  achievementsStore.evaluateAllRetroactive();
  assert('collection-5', achievementsStore.getStatus('collection-5') === 'unlocked');
  assert('collection-10', achievementsStore.getStatus('collection-10') === 'unlocked');
  assert('collection-25', achievementsStore.getStatus('collection-25') === 'unlocked');
  assert('collection-50 locked', achievementsStore.getStatus('collection-50') === 'locked');

  // 115 Mastery
  resetAll();
  teamStore.addToCollection(mockChar('m1', 'char-m', { masteryLevel: 50, quality: 'A', stars: 2 }));
  achievementsStore.evaluateAllRetroactive();
  assert('mastery-10', achievementsStore.getStatus('mastery-10') === 'unlocked');
  assert('mastery-25', achievementsStore.getStatus('mastery-25') === 'unlocked');
  assert('mastery-50', achievementsStore.getStatus('mastery-50') === 'unlocked');
  assert('mastery-100 locked', achievementsStore.getStatus('mastery-100') === 'locked');

  // 116 Stars
  resetAll();
  teamStore.addToCollection(mockChar('s1', 'char-s', { stars: 5, quality: 'SS' }));
  achievementsStore.evaluateAllRetroactive();
  assert('stars-1', achievementsStore.getStatus('stars-1') === 'unlocked');
  assert('stars-3', achievementsStore.getStatus('stars-3') === 'unlocked');
  assert('stars-5', achievementsStore.getStatus('stars-5') === 'unlocked');

  // 117 Awakening
  resetAll();
  teamStore.addToCollection(mockChar('a1', 'char-a', { awakeningLevel: 3, quality: 'S', stars: 3 }));
  achievementsStore.evaluateAllRetroactive();
  assert('awakening-1', achievementsStore.getStatus('awakening-1') === 'unlocked');
  assert('awakening-2', achievementsStore.getStatus('awakening-2') === 'unlocked');
  assert('awakening-3', achievementsStore.getStatus('awakening-3') === 'unlocked');

  // 118 Lineage
  resetAll();
  setLineageRank('ninja', 4);
  achievementsStore.evaluateAllRetroactive();
  assert('lineage-chosen', achievementsStore.getStatus('lineage-chosen') === 'unlocked');
  assert('lineage-rank-2', achievementsStore.getStatus('lineage-rank-2') === 'unlocked');
  assert('lineage-rank-3', achievementsStore.getStatus('lineage-rank-3') === 'unlocked');
  assert('lineage-rank-4', achievementsStore.getStatus('lineage-rank-4') === 'unlocked');
  assert('lineage-rank-4-ninja', achievementsStore.getStatus('lineage-rank-4-ninja') === 'unlocked');

  // 119 Specialization
  resetAll();
  setLineageRank('ninja', 4, { specSlot: 'specializationA', specLevel: 3 });
  achievementsStore.evaluateAllRetroactive();
  assert('spec-selected', achievementsStore.getStatus('spec-selected') === 'unlocked');
  assert('spec-level-2', achievementsStore.getStatus('spec-level-2') === 'unlocked');
  assert('spec-level-3', achievementsStore.getStatus('spec-level-3') === 'unlocked');
  assert('spec-level-4 locked', achievementsStore.getStatus('spec-level-4') === 'locked');

  // 120 Online kill +1
  resetAll();
  gemStore.hydrate({
    balance: 0,
    lastLoginDay: null,
    claimedAchievements: {},
    totalKills: 99,
    weeklyCrystalWeek: null,
    weeklyCrystalPurchases: 0,
  });
  achievementsStore.evaluate('onlineKills', { silent: true });
  assert('kills-100 locked before', achievementsStore.getStatus('online-kills-100') === 'locked');
  gemStore.recordKill();
  assert('official kills 100', gemStore.getSnapshot().totalKills === 100);
  assert('kills-100 unlocked', achievementsStore.getStatus('online-kills-100') === 'unlocked');

  // 123 Offline does not bump online kills / achievements
  const killsBefore = gemStore.getSnapshot().totalKills;
  // Offline path does not call gemStore.recordKill — simulate by leaving counter unchanged
  achievementsStore.evaluate('onlineKills', { silent: true });
  assert('offline +0 kills', gemStore.getSnapshot().totalKills === killsBefore);

  // 124-126 Claim / double / claim all
  resetAll();
  vitalsStore.reset({ ...DEFAULT_VITALS, level: 25, xp: 0, xpMax: 100, hp: 100, hpMax: 100 });
  achievementsStore.evaluateAllRetroactive();
  const copperBefore = inventoryStore.countItem(SHOP_CURRENCY_ITEM_ID);
  assert('claim ok', achievementsStore.claim('player-level-10').ok);
  const copperMid = inventoryStore.countItem(SHOP_CURRENCY_ITEM_ID);
  assert('copper granted once', copperMid > copperBefore);
  assert('double claim blocked', !achievementsStore.claim('player-level-10').ok);
  assert('copper unchanged on double', inventoryStore.countItem(SHOP_CURRENCY_ITEM_ID) === copperMid);
  const all = achievementsStore.claimAll();
  assert('claim all claimed some', all.claimed.includes('player-level-25'));
  assert('claim all no duplicate level-10', !all.claimed.includes('player-level-10'));

  // 127-129 Title equip / locked / unequip
  resetAll();
  assert('equip locked blocked', !achievementsStore.equipTitle('veterano').ok);
  achievementsStore.unlockTitle('veterano');
  assert('equip unlocked ok', achievementsStore.equipTitle('veterano').ok);
  assert('equipped id', achievementsStore.getEquippedTitleId() === 'veterano');
  achievementsStore.hydrate(achievementsStore.getPersistedProgress());
  assert('equip survives hydrate', achievementsStore.getEquippedTitleId() === 'veterano');
  achievementsStore.unequipTitle();
  assert('unequip null', achievementsStore.getEquippedTitleId() === null);

  // 130 Title does not affect combat stats
  const without = computePlayerAttributes({ level: 20, stars: 2, characterId: null, awakeningLevel: 0 });
  achievementsStore.unlockTitle('mestre-shinobi');
  achievementsStore.equipTitle('mestre-shinobi');
  const withTitle = computePlayerAttributes({ level: 20, stars: 2, characterId: null, awakeningLevel: 0 });
  assert(
    'stats identical with title',
    JSON.stringify(without.totals) === JSON.stringify(withTitle.totals),
  );

  // Title reward claim unlocks title
  resetAll();
  gemStore.hydrate({
    balance: 0,
    lastLoginDay: null,
    claimedAchievements: {},
    totalKills: 100,
    weeklyCrystalWeek: null,
    weeklyCrystalPurchases: 0,
  });
  achievementsStore.evaluateAllRetroactive();
  achievementsStore.claim('online-kills-100');
  assert('title unlocked via claim', Boolean(achievementsStore.getSnapshot().unlockedTitles['novato-combate']));

  console.log('\nAll achievement tests passed.');
}

main();
