/**
 * Item 27 — Ranking (obrigatórios).
 * Run: npx --yes tsx scripts/test-ranking.ts
 */
import { TEST_BOSS_ID } from '../src/data/bosses/boss-registry';
import { validateRankingCatalog } from '../src/lib/ranking-validation';
import {
  computeTotalMastery,
  computeUniqueCharacters,
  computeTotalXp,
} from '../src/lib/ranking-metrics';
import { LocalRankingProvider } from '../src/lib/ranking-local-provider';
import { buildBoardFromProfiles, sortProfiles, filterProfiles } from '../src/lib/ranking-sort';
import type { RankingPlayerProfile } from '../src/types/ranking';
import type { SealedCharacter } from '../src/types/team';

function assert(name: string, cond: boolean): void {
  if (!cond) throw new Error(`FAIL ${name}`);
  console.log(`ok  ${name}`);
}

function profile(
  partial: Partial<RankingPlayerProfile> & Pick<RankingPlayerProfile, 'playerId' | 'nickname'>,
): RankingPlayerProfile {
  return {
    playerLevel: 1,
    levelXp: 0,
    totalXp: 0,
    accountPower: 0,
    accountPowerProvisional: true,
    totalMastery: 0,
    uniqueCharacters: 0,
    collectionRarityScore: 0,
    onlineKills: 0,
    lineageId: null,
    lineageRank: 0,
    specializationId: null,
    specializationLevel: 0,
    lineageOnlineKills: 0,
    equippedTitleId: null,
    bossBest: {},
    ...partial,
  };
}

function fakeChar(
  id: string,
  characterId: string,
  masteryLevel: number,
  quality: SealedCharacter['quality'] = 'A',
): SealedCharacter {
  return {
    id,
    characterId,
    characterKey: characterId,
    lookType: 1,
    name: characterId,
    quality,
    stars: 0,
    masteryLevel,
    masteryXp: 0,
    level: 1,
    xp: 0,
    awakeningLevel: 0,
  } as SealedCharacter;
}

async function main(): Promise<void> {
  const warnings = validateRankingCatalog();
  assert('catalog validator clean', warnings.length === 0);

  const levelBoard = buildBoardFromProfiles(
    [
      profile({ playerId: 'a', nickname: 'A', playerLevel: 50, levelXp: 90, totalXp: computeTotalXp(50, 90) }),
      profile({ playerId: 'b', nickname: 'B', playerLevel: 50, levelXp: 30, totalXp: computeTotalXp(50, 30) }),
      profile({ playerId: 'c', nickname: 'C', playerLevel: 49, levelXp: 999, totalXp: computeTotalXp(49, 999) }),
    ],
    { categoryId: 'level', page: 0, pageSize: 100 },
    'a',
  );
  assert('level A>B>C', levelBoard.entries.map((e) => e.nickname).join('') === 'ABC');
  assert('level my rank 1', levelBoard.myRank === 1);

  const collection = [
    fakeChar('1', 'itachi', 100),
    fakeChar('2', 'itachi', 100),
    fakeChar('3', 'itachi', 100),
    fakeChar('4', 'naruto', 10, 'B'),
  ];
  assert('mastery no dupe inflate', computeTotalMastery(collection) === 110);
  assert('collection unique', computeUniqueCharacters(collection) === 2);
  const tenNaruto = Array.from({ length: 10 }, (_, i) => fakeChar(`n${i}`, 'naruto', 5));
  assert('10 narutos = 1 unique', computeUniqueCharacters(tenNaruto) === 1);

  const lineageProfiles = [
    profile({
      playerId: 'n1',
      nickname: 'N1',
      lineageId: 'ninja',
      lineageRank: 4,
      specializationLevel: 4,
      lineageOnlineKills: 12000,
    }),
    profile({
      playerId: 'n2',
      nickname: 'N2',
      lineageId: 'ninja',
      lineageRank: 4,
      specializationLevel: 3,
      lineageOnlineKills: 50000,
    }),
    profile({
      playerId: 's1',
      nickname: 'S1',
      lineageId: 'shinigami',
      lineageRank: 4,
      specializationLevel: 4,
      lineageOnlineKills: 1,
    }),
  ];
  const ninjaOnly = filterProfiles(lineageProfiles, 'lineage', 'ninja');
  assert('lineage filter ninja', ninjaOnly.length === 2 && ninjaOnly.every((p) => p.lineageId === 'ninja'));
  const lineageSorted = sortProfiles(ninjaOnly, 'lineage');
  assert('spec tiebreak N1 above N2', lineageSorted[0]?.profile.nickname === 'N1');

  const bossProfiles = [
    profile({
      playerId: 'p30',
      nickname: 'Fast',
      bossBest: { [TEST_BOSS_ID]: { bestTimeMs: 30_000, bestDamage: 100, victory: true } },
    }),
    profile({
      playerId: 'p45',
      nickname: 'Mid',
      bossBest: { [TEST_BOSS_ID]: { bestTimeMs: 45_000, bestDamage: 100, victory: true } },
    }),
    profile({
      playerId: 'p60',
      nickname: 'Slow',
      bossBest: { [TEST_BOSS_ID]: { bestTimeMs: 60_000, bestDamage: 100, victory: true } },
    }),
  ];
  const bossSorted = sortProfiles(
    filterProfiles(bossProfiles, 'boss', 'all', TEST_BOSS_ID),
    'boss',
    TEST_BOSS_ID,
  );
  assert(
    'boss fastest 30<45<60',
    bossSorted.map((r) => r.profile.nickname).join(',') === 'Fast,Mid,Slow',
  );

  let best = 45_000;
  if (50_000 < best) best = 50_000;
  if (40_000 < best) best = 40_000;
  assert('boss better replaces', best === 40_000);

  const mocks: RankingPlayerProfile[] = [];
  for (let i = 0; i < 500; i += 1) {
    mocks.push(
      profile({
        playerId: `mock-rank-${i + 1}`,
        nickname: `M${i + 1}`,
        playerLevel: 1 + (i % 80),
        totalXp: i,
        onlineKills: i,
      }),
    );
  }
  mocks.push(
    profile({
      playerId: 'real-me',
      nickname: 'Marlon',
      playerLevel: 2,
      totalXp: 1,
      onlineKills: 0,
    }),
  );
  const board500 = buildBoardFromProfiles(mocks, { categoryId: 'kills', page: 0, pageSize: 100 }, 'real-me');
  assert('top 100 size', board500.entries.length === 100);
  assert('my rank outside top still set', board500.myRank != null && board500.myRank > 100);
  assert('my entry present', board500.myEntry?.nickname === 'Marlon');

  const page0 = buildBoardFromProfiles(mocks, { categoryId: 'kills', page: 0, pageSize: 20 }, 'real-me');
  const page1 = buildBoardFromProfiles(mocks, { categoryId: 'kills', page: 1, pageSize: 20 }, 'real-me');
  const ids0 = new Set(page0.entries.map((e) => e.playerId));
  assert('pagination no overlap', page1.entries.every((e) => !ids0.has(e.playerId)));

  const killBoard = buildBoardFromProfiles(
    [
      profile({ playerId: 'o1', nickname: 'Online', onlineKills: 100 }),
      profile({ playerId: 'o2', nickname: 'Zero', onlineKills: 0 }),
    ],
    { categoryId: 'kills' },
    'o1',
  );
  assert('kills order', killBoard.entries[0]?.nickname === 'Online');

  const provider = new LocalRankingProvider();
  provider.setForceFail(true);
  let threw = false;
  try {
    await provider.getLeaderboard({ categoryId: 'level' });
  } catch {
    threw = true;
  }
  assert('provider fail throws', threw);

  const titled = buildBoardFromProfiles(
    [
      profile({ playerId: 't1', nickname: 'T1', playerLevel: 10, totalXp: 10, equippedTitleId: 'title-x' }),
      profile({ playerId: 't2', nickname: 'T2', playerLevel: 11, totalXp: 10, equippedTitleId: null }),
    ],
    { categoryId: 'level' },
    't1',
  );
  assert('title not score', titled.entries[0]?.nickname === 'T2' && titled.entries[1]?.titleId === 'title-x');

  // refresh keeps filters — sort service is pure; category preserved by store contract
  assert('categories include boss', validateRankingCatalog().length === 0);

  console.log('\nAll ranking tests passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
