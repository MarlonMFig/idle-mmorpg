import { accountStore } from '../src/stores/account-store';
import { vitalsStore } from '../src/stores/vitals-store';
import { teamStore } from '../src/stores/team-store';
import { DEFAULT_VITALS } from '../src/constants/hud';
import { LINEAGE_SYSTEM_UNLOCK_LEVEL } from '../src/constants/lineage';
import { computeLineageCollectionStats } from '../src/lib/lineage-rank-stats';
import { evaluateLineageRankRequirements } from '../src/lib/lineage-rank-evaluation';
import {
  getLineageIdProgress,
  normalizePlayerLineageProgress,
} from '../src/lib/lineage-progress';
import {
  canPromoteLineageRank,
  grantLineageOnlineKill,
  promoteLineageRank,
} from '../src/lib/promote-lineage-rank';
import { onLineageRankPromoted } from '../src/lib/lineage-events';
import type { LineageId } from '../src/types/character-meta';
import type { SealedCharacter } from '../src/types/team';

function assert(name: string, cond: boolean): void {
  if (!cond) throw new Error(`FAIL ${name}`);
  console.log(`ok  ${name}`);
}

function resetAccount(lineageId: LineageId = 'ninja'): void {
  accountStore.reset();
  teamStore.reset();
  vitalsStore.reset({
    ...DEFAULT_VITALS,
    level: LINEAGE_SYSTEM_UNLOCK_LEVEL,
    hp: 100,
    hpMax: 100,
    xp: 0,
    xpMax: 100,
  });
  accountStore.chooseLineage(lineageId);
}

function mockNinjaChar(
  id: string,
  characterId: string,
  opts: Partial<SealedCharacter> = {},
): SealedCharacter {
  return {
    id,
    characterId,
    characterKey: `look:${characterId}`,
    name: characterId,
    lookType: 1,
    sourceId: null,
    starterId: null,
    previewUrl: '',
    quality: 'B',
    stars: 2,
    lineageId: 'ninja',
    level: 1,
    xp: 0,
    masteryLevel: 0,
    masteryXp: 0,
    awakeningLevel: 0,
    isFavorite: false,
    isLocked: false,
    ...opts,
  };
}

function seedCollection(entries: SealedCharacter[]): void {
  for (const entry of entries) {
    teamStore.addToCollection({
      id: entry.id,
      name: entry.name,
      lookType: entry.lookType,
      characterId: entry.characterId,
      characterKey: entry.characterKey,
      lineageId: entry.lineageId,
      quality: entry.quality,
      stars: entry.stars,
      masteryLevel: entry.masteryLevel,
    });
  }
}

function setupRank2Ready(): SealedCharacter[] {
  vitalsStore.reset({ ...DEFAULT_VITALS, level: 20, hp: 100, hpMax: 100, xp: 0, xpMax: 100 });
  const progress = accountStore.getLineageProgress();
  accountStore.applyLineageProgress({
    ...progress,
    byLineage: {
      ...progress.byLineage,
      ninja: {
        rank: 1,
        onlineKills: 500,
        selectedSpecializationId: null,
        specializationLevel: 0,
      },
    },
  });
  return [
    mockNinjaChar('a', 'char-a', { masteryLevel: 10 }),
    mockNinjaChar('b', 'char-b'),
    mockNinjaChar('c', 'char-c'),
  ];
}

// --- choose starts Rank I ---
resetAccount('ninja');
assert(
  'choose lineage rank I',
  getLineageIdProgress(accountStore.getLineageProgress(), 'ninja').rank === 1,
);

// --- Rank II eligible ---
resetAccount('ninja');
const collectionReady = setupRank2Ready();
seedCollection(collectionReady);
const evalReady = evaluateLineageRankRequirements({
  lineageId: 'ninja',
  progress: accountStore.getLineageProgress(),
  collection: collectionReady,
  playerLevel: 20,
});
assert('rank II eligible', evalReady.eligible === true);
assert('canPromote ready', canPromoteLineageRank('ninja').eligible === true);

// --- 499 kills ---
resetAccount('ninja');
seedCollection(collectionReady);
vitalsStore.reset({ ...DEFAULT_VITALS, level: 20, hp: 100, hpMax: 100, xp: 0, xpMax: 100 });
const progress499 = accountStore.getLineageProgress();
accountStore.applyLineageProgress({
  ...progress499,
  byLineage: {
    ...progress499.byLineage,
    ninja: {
      rank: 1,
      onlineKills: 499,
      selectedSpecializationId: null,
      specializationLevel: 0,
    },
  },
});
const eval499 = evaluateLineageRankRequirements({
  lineageId: 'ninja',
  progress: accountStore.getLineageProgress(),
  collection: collectionReady,
  playerLevel: 20,
});
assert('499 kills not eligible', eval499.eligible === false);

// --- Offline does not increment without grant ---
resetAccount('ninja');
const beforeKills = getLineageIdProgress(accountStore.getLineageProgress(), 'ninja').onlineKills;
assert('offline simulation unchanged', beforeKills === 0);
grantLineageOnlineKill(5000, { force: true });
const afterForce = getLineageIdProgress(accountStore.getLineageProgress(), 'ninja').onlineKills;
assert('online grant works with force', afterForce === 5000);

// --- One kill = +1 (multi-hit / DoT semantics at reward layer) ---
resetAccount('ninja');
grantLineageOnlineKill(1, { force: true });
assert(
  'single kill +1',
  getLineageIdProgress(accountStore.getLineageProgress(), 'ninja').onlineKills === 1,
);
grantLineageOnlineKill(1, { force: true });
assert(
  'second kill +1',
  getLineageIdProgress(accountStore.getLineageProgress(), 'ninja').onlineKills === 2,
);

// --- Duplicates unique count ---
const dupCollection = [
  mockNinjaChar('itachi-a', 'uchiha-itachi'),
  mockNinjaChar('itachi-b', 'uchiha-itachi'),
  mockNinjaChar('itachi-c', 'uchiha-itachi'),
  mockNinjaChar('other', 'char-other'),
];
const dupStats = computeLineageCollectionStats(dupCollection, 'ninja');
assert('duplicates count as 1 unique', dupStats.uniqueCharacters === 2);

// --- Mastery best instance ---
const masteryCollection = [
  mockNinjaChar('itachi-a', 'uchiha-itachi', { masteryLevel: 50 }),
  mockNinjaChar('itachi-b', 'uchiha-itachi', { masteryLevel: 30 }),
];
const masteryStats = computeLineageCollectionStats(masteryCollection, 'ninja');
assert('mastery uses best instance', masteryStats.masteryAtLeast(50) === 1);
assert('mastery 30 not double count', masteryStats.masteryAtLeast(30) === 1);

// --- Stars requirement ---
const starCollection = [
  mockNinjaChar('s1', 'star-a', { stars: 3, quality: 'A' }),
  mockNinjaChar('s2', 'star-b', { stars: 1, quality: 'D' }),
];
const starStats = computeLineageCollectionStats(starCollection, 'ninja');
assert('stars 2+ count', starStats.starsAtLeast(2) === 1);
assert('stars 3+ count', starStats.starsAtLeast(3) === 1);

// --- Lineage independence (DEV switch) ---
resetAccount('ninja');
accountStore.devAddOnlineKills(1000);
accountStore.devSetActiveLineage('shinigami');
accountStore.devAddOnlineKills(200);
const ninjaKills = getLineageIdProgress(accountStore.getLineageProgress(), 'ninja').onlineKills;
const shiniKills = getLineageIdProgress(accountStore.getLineageProgress(), 'shinigami').onlineKills;
assert('ninja kills preserved', ninjaKills === 1000);
assert('shinigami kills separate', shiniKills === 200);
accountStore.devSetActiveLineage('ninja');
assert('switch back ninja', accountStore.getPlayerLineageId() === 'ninja');

// --- Promote + reload ---
resetAccount('ninja');
seedCollection(setupRank2Ready());
let promoted = false;
const off = onLineageRankPromoted((event) => {
  promoted = event.oldRank === 1 && event.newRank === 2 && event.lineageId === 'ninja';
});
const result = promoteLineageRank('ninja');
off();
assert('promote ok', result.ok === true);
assert('promotion event', promoted);
assert(
  'rank after promote',
  getLineageIdProgress(accountStore.getLineageProgress(), 'ninja').rank === 2,
);
const saved = accountStore.getLineageProgress();
accountStore.reset();
accountStore.hydrate({ lineageProgress: saved });
assert(
  'reload keeps rank',
  getLineageIdProgress(accountStore.getLineageProgress(), 'ninja').rank === 2,
);

// --- Rank IV max ---
resetAccount('ninja');
accountStore.devSetRank(4);
const maxEval = canPromoteLineageRank('ninja');
assert('rank IV maxed', maxEval.maxed === true);
assert('rank IV not eligible', maxEval.eligible === false);
const maxPromote = promoteLineageRank('ninja');
assert('rank IV promote fails', maxPromote.ok === false);

// --- save migration ---
const migrated = normalizePlayerLineageProgress({ lineageId: 'pirata', rank: 2 });
assert(
  'migration preserves rank',
  getLineageIdProgress(migrated, 'pirata').rank === 2,
);
assert(
  'migration onlineKills zero',
  getLineageIdProgress(migrated, 'pirata').onlineKills === 0,
);
const migratedItem20 = normalizePlayerLineageProgress({ lineageId: 'ninja', rank: 0 });
assert(
  'item20 rank0 -> rank1',
  getLineageIdProgress(migratedItem20, 'ninja').rank === 1,
);

console.log('lineage rank promotion tests passed');
