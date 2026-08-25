/**
 * Pipeline Hunt → loot Naruto: perfil, RNG, grant, analyzer.
 * Não muda chances. Não cria loot geral.
 */
import { SHOP_CURRENCY_ITEM_ID } from '../src/constants/sealing';
import { resolveAnimeId } from '../src/data/anime';
import {
  resolveNarutoLootCharacterId,
  rollNarutoCharacterLoot,
} from '../src/data/anime-loot';
import {
  GAARA_LOOK_TYPES,
  getCuratedPackByLookType,
  KAKASHI_CURATED_LOOK_TYPE,
  NARUTO_CLASSIC_LOOK_TYPE,
  NARUTO_KYUBI_CURATED_LOOK_TYPE,
  NARUTO_SENNIN_LOOK_TYPE,
  UCHIHA_ITACHI_LOOK_TYPE,
} from '../src/data/character-packs';
import { getItem } from '../src/data/items';
import {
  getNarutoCharacterTier,
  getNarutoFragmentChance,
  getNarutoLootRollChances,
  NARUTO_CHARACTER_LOOT,
  rollNarutoIndependentMaterials,
} from '../src/data/naruto-loot-tiers';
import { rewardService } from '../src/lib/reward-service';
import { huntAnalyzerStore } from '../src/stores/hunt-analyzer-store';
import { inventoryStore } from '../src/stores/inventory-store';
import { resolveLoot } from '../src/systems/loot-engine';

function assert(name: string, cond: boolean): void {
  if (!cond) throw new Error(`FAIL ${name}`);
  console.log(`ok  ${name}`);
}

function scripted(values: number[]): () => number {
  let i = 0;
  return () => {
    const v = values[i];
    i += 1;
    if (v === undefined) throw new Error('RNG esgotado');
    return v;
  };
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const HUNT_CASES = [
  {
    label: 'Naruto Classic',
    huntId: 'wonsr-hunt-001',
    mapKey: 'huntValeDoFim',
    sourceId: 'wonsr-character-uzumaki-naruto',
    source: 'curated/naruto',
    lookType: NARUTO_CLASSIC_LOOK_TYPE,
    packId: 'naruto-classic',
    tier: 1 as const,
  },
  {
    label: 'Gaara',
    huntId: 'wonsr-hunt-005',
    mapKey: 'huntPaisDoVento',
    sourceId: 'wonsr-character-gaara',
    source: 'curated/gaara',
    lookType: GAARA_LOOK_TYPES[0]!,
    packId: 'gaara',
    tier: 3 as const,
  },
  {
    label: 'Kakashi',
    huntId: 'wonsr-hunt-013',
    mapKey: 'huntCampoTreinamento',
    sourceId: 'wonsr-character-hatake-kakashi',
    source: 'curated/kakashi',
    lookType: KAKASHI_CURATED_LOOK_TYPE,
    packId: 'kakashi',
    tier: 4 as const,
  },
  {
    label: 'Itachi',
    huntId: 'wonsr-hunt-007',
    mapKey: 'huntDistritoUchiha',
    sourceId: 'wonsr-character-uchiha-itachi',
    source: 'curated/uchiha-itachi',
    lookType: UCHIHA_ITACHI_LOOK_TYPE,
    packId: 'uchiha-itachi',
    tier: 5 as const,
  },
  {
    label: 'Naruto Sennin',
    huntId: 'lab-naruto-sennin',
    mapKey: null as string | null,
    sourceId: 'wonsr-character-naruto-sennin',
    source: 'curated/naruto-sennin',
    lookType: NARUTO_SENNIN_LOOK_TYPE,
    packId: 'naruto-sennin',
    tier: 5 as const,
  },
  {
    label: 'Naruto Kyubi',
    huntId: 'wonsr-hunt-022',
    mapKey: 'huntValeDoFim',
    sourceId: 'wonsr-character-naruto-kyubi',
    source: 'curated/naruto-kyubi',
    lookType: NARUTO_KYUBI_CURATED_LOOK_TYPE,
    packId: 'naruto-kyubi',
    tier: 5 as const,
  },
];

const chancesNow = {
  1: getNarutoLootRollChances(1),
  2: getNarutoLootRollChances(2),
  3: getNarutoLootRollChances(3),
  4: getNarutoLootRollChances(4),
  5: getNarutoLootRollChances(5),
};
console.log('chances ativas', JSON.stringify(chancesNow));
console.log(
  'fragment T1-T5',
  [1, 2, 3, 4, 5].map((t) => getNarutoFragmentChance(t as 1 | 2 | 3 | 4 | 5)),
);

assert(
  'lookType 9011 → naruto-classic',
  getCuratedPackByLookType(NARUTO_CLASSIC_LOOK_TYPE)?.id === 'naruto-classic',
);

for (const hunt of HUNT_CASES) {
  const packFromLook = getCuratedPackByLookType(hunt.lookType)?.id;
  assert(`${hunt.label} lookType→pack`, packFromLook === hunt.packId);

  const resolved = resolveNarutoLootCharacterId({
    characterId: hunt.sourceId,
    lookType: hunt.lookType,
  });
  assert(`${hunt.label} sourceId não é perfil`, !NARUTO_CHARACTER_LOOT[hunt.sourceId]);
  assert(`${hunt.label} resolve pack`, resolved === hunt.packId);
  assert(`${hunt.label} tier`, getNarutoCharacterTier(resolved) === hunt.tier);

  const animeId = resolveAnimeId({
    lookType: hunt.lookType,
    source: hunt.source,
    sourceId: hunt.sourceId,
  });
  assert(`${hunt.label} animeId naruto`, animeId === 'naruto');
  console.log(
    `${hunt.label}: huntId=${hunt.huntId} mapKey=${hunt.mapKey} packId=null animeId=${animeId} lootId=${resolved}`,
  );

  const profile = NARUTO_CHARACTER_LOOT[hunt.packId]!;
  assert(`${hunt.label} secondary registry`, Boolean(getItem(profile.secondaryItemId)));
  assert(`${hunt.label} signature registry`, Boolean(getItem(profile.signatureItemId)));

  const failGeneral = 0.999;
  const failFrag = 0.999;
  const onlySec = rollNarutoCharacterLoot(
    { characterId: hunt.sourceId, lookType: hunt.lookType },
    scripted([failGeneral, failFrag, 0, 0.999]),
  );
  assert(
    `${hunt.label} force secondary`,
    onlySec.length === 1 && onlySec[0]?.itemId === profile.secondaryItemId,
  );

  const onlySig = rollNarutoCharacterLoot(
    { characterId: hunt.sourceId, lookType: hunt.lookType },
    scripted([failGeneral, failFrag, 0.999, 0]),
  );
  assert(
    `${hunt.label} force signature`,
    onlySig.length === 1 && onlySig[0]?.itemId === profile.signatureItemId,
  );

  const both = rollNarutoCharacterLoot(
    { characterId: hunt.sourceId, lookType: hunt.lookType },
    scripted([failGeneral, failFrag, 0, 0]),
  );
  assert(
    `${hunt.label} force both`,
    both.some((d) => d.itemId === profile.secondaryItemId) &&
      both.some((d) => d.itemId === profile.signatureItemId),
  );

  const none = rollNarutoCharacterLoot(
    { characterId: hunt.sourceId, lookType: hunt.lookType },
    scripted([failGeneral, failFrag, 0.999, 0.999]),
  );
  assert(`${hunt.label} force none`, none.length === 0);
}

assert(
  'sourceId sozinho não vira perfil (sem fuzzy)',
  resolveNarutoLootCharacterId({
    characterId: 'wonsr-character-uzumaki-naruto',
    lookType: null,
  }) === 'wonsr-character-uzumaki-naruto',
);

assert(
  'uzumaki não classifica como jujutsu (token maki)',
  resolveAnimeId({ sourceId: 'wonsr-character-uzumaki-naruto' }) === 'naruto',
);

{
  const forced = resolveLoot({
    kills: 1,
    enemyLevel: 5,
    naruto: {
      characterId: 'wonsr-character-uzumaki-naruto',
      lookType: NARUTO_CLASSIC_LOOK_TYPE,
    },
    copperMultiplier: 1,
    rng: scripted([0.5, 0.999, 0.999, 0, 0.999]),
  });
  const profile = NARUTO_CHARACTER_LOOT['naruto-classic']!;
  assert('resolveLoot cobre + secondary forçado', forced.copper > 0);
  assert(
    'resolveLoot hunt-id secondary',
    forced.items.some((it) => it.itemId === profile.secondaryItemId),
  );
}

const missing = rollNarutoIndependentMaterials(
  'wonsr-character-uzumaki-naruto',
  1,
  scripted([0, 0]),
);
assert(
  'sourceId sem perfil = zero materiais',
  missing.secondaryItemId == null && missing.signatureItemId == null,
);

inventoryStore.reset();
huntAnalyzerStore.resetSession();
const bandage = 'item-anime-naruto-bandagem';
const beforeBandage = inventoryStore.countItem(bandage);
const grant = rewardService.grant({
  rewards: { copper: 2, items: [{ itemId: bandage, quantity: 1 }] },
  source: 'hunt',
  sourceId: 'pipeline-grant',
  allowPartial: true,
});
assert('grant cobre+material', grant.success && (grant.granted.copper ?? 0) === 2);
assert('inventory material +1', inventoryStore.countItem(bandage) === beforeBandage + 1);

huntAnalyzerStore.recordKill({ xp: 10, copper: 2 });
huntAnalyzerStore.recordLootItems(bandage, 1);
const drops = huntAnalyzerStore.listDrops();
assert(
  'analyzer cobre + material',
  drops.some((d) => d.itemId === SHOP_CURRENCY_ITEM_ID && d.quantity === 2) &&
    drops.some((d) => d.itemId === bandage && d.quantity === 1),
);
assert('lootItems = materiais', huntAnalyzerStore.getSnapshot().lootItems === 1);

const NARUTO_HUNT = HUNT_CASES[0]!;
inventoryStore.reset();
huntAnalyzerStore.resetSession();
const profileClassic = NARUTO_CHARACTER_LOOT['naruto-classic']!;
const beforeSec = inventoryStore.countItem(profileClassic.secondaryItemId);
const beforeSig = inventoryStore.countItem(profileClassic.signatureItemId);
const rolled100: Record<string, number> = {};
let copper100 = 0;
const rng100 = mulberry32(20260823);
for (let i = 0; i < 100; i += 1) {
  const result = resolveLoot({
    kills: 1,
    enemyLevel: 5,
    naruto: { characterId: NARUTO_HUNT.sourceId, lookType: NARUTO_HUNT.lookType },
    copperMultiplier: 1,
    rng: rng100,
  });
  copper100 += result.copper;
  huntAnalyzerStore.recordKill({ xp: 1, copper: result.copper });
  for (const item of result.items) {
    rolled100[item.itemId] = (rolled100[item.itemId] ?? 0) + item.quantity;
    huntAnalyzerStore.recordLootItems(item.itemId, item.quantity);
  }
  const g = rewardService.grant({
    rewards: {
      copper: result.copper || undefined,
      items: result.items.length ? result.items : undefined,
    },
    source: 'hunt',
    sourceId: `sim-100-${i}`,
    allowPartial: true,
  });
  assert(`grant kill ${i}`, g.success);
}
assert('100 kills copper > 0', copper100 > 0);
const afterSec = inventoryStore.countItem(profileClassic.secondaryItemId) - beforeSec;
const afterSig = inventoryStore.countItem(profileClassic.signatureItemId) - beforeSig;
assert(
  '100 kills ROLLED==GRANTED secondary',
  (rolled100[profileClassic.secondaryItemId] ?? 0) === afterSec,
);
assert(
  '100 kills ROLLED==GRANTED signature',
  (rolled100[profileClassic.signatureItemId] ?? 0) === afterSig,
);
const snap = huntAnalyzerStore.getSnapshot();
assert(
  'analyzer == inventory secondary',
  (snap.drops[profileClassic.secondaryItemId] ?? 0) === afterSec,
);
assert(
  'analyzer == inventory signature',
  (snap.drops[profileClassic.signatureItemId] ?? 0) === afterSig,
);
console.log('100 kills Naruto Classic', {
  copper: copper100,
  rolled: rolled100,
  inventorySecondary: afterSec,
  inventorySignature: afterSig,
  lootItems: snap.lootItems,
});

const rng10k = mulberry32(42);
const t1 = getNarutoLootRollChances(1);
let secHits = 0;
let sigHits = 0;
const N = 10_000;
for (let i = 0; i < N; i += 1) {
  const roll = rollNarutoIndependentMaterials('naruto-classic', 1, rng10k, {
    guildLootMult: 1,
    vipEmptyReroll: 0,
  });
  if (roll.secondaryItemId) secHits += 1;
  if (roll.signatureItemId) sigHits += 1;
}
const secRate = secHits / N;
const sigRate = sigHits / N;
assert(`10k secondary ~${t1.secondary} got ${secRate}`, Math.abs(secRate - t1.secondary) < 0.015);
assert(`10k signature ~${t1.signature} got ${sigRate}`, Math.abs(sigRate - t1.signature) < 0.015);
console.log('10k rolls', { secHits, sigHits, secRate, sigRate, expected: t1 });

const rngHunt10k = mulberry32(99);
let huntSec = 0;
for (let i = 0; i < N; i += 1) {
  const rolled = rollNarutoCharacterLoot(
    { characterId: NARUTO_HUNT.sourceId, lookType: NARUTO_HUNT.lookType },
    rngHunt10k,
  );
  if (rolled.some((d) => d.itemId === profileClassic.secondaryItemId)) huntSec += 1;
}
const huntSecRate = huntSec / N;
assert(
  `10k hunt-id pipeline secondary ~${t1.secondary} got ${huntSecRate}`,
  Math.abs(huntSecRate - t1.secondary) < 0.02,
);

console.log('PASS test-hunt-loot-pipeline');
