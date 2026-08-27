import {
  QUALITY_SPAWN_WEIGHTS,
  spawnQualityPercents,
} from '../src/constants/capture-rarity';
import { computeCaptureChance } from '../src/constants/capture-system';
import { SEALING_SCROLL_ITEM_ID, SEALING_SCROLL_TIERS } from '../src/constants/sealing';
import { MAP_KEYS } from '../src/maps/map-registry';
import {
  pickHuntTargetIndex,
  pickWeightedIndex,
  rollSpawnQualityFromWeights,
  simulateSpawnQualityCounts,
} from '../src/lib/hunt-spawn';
import { isHuntCatalogSealable, resolveEnemyCaptureQuality } from '../src/lib/resolve-character-quality';
import { CHARACTER_QUALITIES, type CharacterQuality } from '../src/types/character-meta';
import type { EnemyDefinition } from '../src/types/enemy';
import type { HuntTarget } from '../src/types/hunt';
import {
  attemptCapture,
  clearCaptureResolved,
  getCaptureChance,
  getSealingScrollConfig,
} from '../src/systems/capture-engine';
import { inventoryStore } from '../src/stores/inventory-store';
import { helperStore } from '../src/stores/helper-store';
import { teamStore } from '../src/stores/team-store';
import { DEV_FLAGS } from '../src/config/devConfig';
import { setForceSpawnQuality } from '../src/lib/capture-dev';
import { normalizeSealedCharacter } from '../src/utils/character-identity';

const ITACHI = 'uchiha-itachi';

function assert(name: string, cond: boolean): void {
  if (!cond) throw new Error(`FAIL ${name}`);
  console.log(`ok  ${name}`);
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function itachiEnemy(quality: CharacterQuality): EnemyDefinition {
  return {
    id: `test-itachi-${quality}`,
    name: 'Itachi',
    hp: 1,
    level: 1,
    xp: 0,
    loot: [],
    spawn: { x: 0, y: 0 },
    speed: 0,
    chaseRadius: 0,
    sprite: 'enemy',
    mapKey: MAP_KEYS.leafVillage,
    sealable: {
      characterId: ITACHI,
      sourceId: ITACHI,
      name: 'Itachi',
      lookType: 9002,
      level: 1,
      quality,
    },
  };
}

assert('qualidades oficiais 7', CHARACTER_QUALITIES.join(',') === 'D,C,B,A,S,SS,SSS');

for (const quality of CHARACTER_QUALITIES) {
  assert(`spawn quality ${quality}`, resolveEnemyCaptureQuality(itachiEnemy(quality)) === quality);
}

assert(
  'mesmo personagem, qualidade do spawn',
  resolveEnemyCaptureQuality(itachiEnemy('D')) === 'D' &&
    resolveEnemyCaptureQuality(itachiEnemy('SSS')) === 'SSS',
);

const commonScroll = getSealingScrollConfig(SEALING_SCROLL_TIERS[0].itemId)!;
for (const quality of CHARACTER_QUALITIES) {
  const chance = getCaptureChance(itachiEnemy(quality), commonScroll);
  assert(`selável ${quality}`, chance.finalChance === 0.12);
  assert(`tier chefe ${quality}`, chance.captureTier === 'chefe');
}

assert(
  'tabela de selar por tier do inimigo',
  computeCaptureChance('chefe', commonScroll.itemId) < computeCaptureChance('comum', commonScroll.itemId),
);

let prevScroll = -1;
for (const tier of SEALING_SCROLL_TIERS) {
  const chance = getCaptureChance(itachiEnemy('S'), tier);
  assert(`scroll ${tier.rank} >= anterior`, chance.finalChance + 1e-9 >= prevScroll);
  prevScroll = chance.finalChance;
}

assert('boss tab fora', isHuntCatalogSealable({ tab: 'bosses' }) === false);
assert('hunt normal selável', isHuntCatalogSealable({ tab: 'naruto' }) === true);

const weights = CHARACTER_QUALITIES.map((q) => QUALITY_SPAWN_WEIGHTS[q]);
for (let i = 1; i < weights.length; i += 1) {
  assert(`peso decrescente ${CHARACTER_QUALITIES[i]}`, weights[i]! <= weights[i - 1]!);
}

const percents = spawnQualityPercents();
assert('percent D dominante', percents.D > 50);
assert('percent SSS raro', percents.SSS < 1);

const dist = simulateSpawnQualityCounts(100_000, mulberry32(42));
for (const quality of CHARACTER_QUALITIES) {
  const expected = (percents[quality] / 100) * 100_000;
  const err = Math.abs(dist[quality] - expected) / 100_000;
  assert(`distribuição ${quality}`, err < 0.015);
}
assert('ordem observada D>C>B>A>S>SS>SSS', dist.D > dist.C && dist.C > dist.B && dist.B > dist.A && dist.A > dist.S && dist.S > dist.SS && dist.SS > dist.SSS);

const pool: HuntTarget[] = ['uchiha-itachi', 'kisame', 'deidara'].map((id, i) => ({
  id,
  sourceId: id,
  name: id,
  category: 'personagem',
  source: 'test',
  lookType: 9000 + i,
  hasSprite: false,
  requiredLevel: 1,
  level: 1,
  hp: 1,
  xp: 1,
  speed: 1,
  targetDistance: 1,
  loot: [],
}));
assert('personagem round-robin 0', pickHuntTargetIndex(pool, 0) === 0);
assert('personagem round-robin 1', pickHuntTargetIndex(pool, 1) === 1);
assert('personagem round-robin 3', pickHuntTargetIndex(pool, 3) === 0);

DEV_FLAGS.enabled = true;
setForceSpawnQuality('random');

for (const quality of CHARACTER_QUALITIES) {
  clearCaptureResolved();
  inventoryStore.reset();
  teamStore.reset('naruto-classic');
  helperStore.setAutoSeal(true);
  helperStore.setScrollItemId(SEALING_SCROLL_ITEM_ID);
  inventoryStore.addItem(SEALING_SCROLL_ITEM_ID, 3);
  setForceSpawnQuality(quality);
  const target = itachiEnemy('D');
  const ok = attemptCapture({
    target,
    source: 'manual',
    attemptKey: `preserve-${quality}`,
    rng: () => 0,
  });
  assert(`${quality} capture`, ok.success && ok.capturedCharacter?.quality === quality);
  assert(`${quality} mesmo definition`, ok.capturedCharacter?.characterId === ITACHI);
  const raw = JSON.parse(JSON.stringify(ok.capturedCharacter));
  const reloaded = normalizeSealedCharacter(raw);
  assert(`${quality} reload`, reloaded?.quality === quality);
}

clearCaptureResolved();
inventoryStore.reset();
teamStore.reset('naruto-classic');
helperStore.setAutoSeal(true);
helperStore.setScrollItemId(SEALING_SCROLL_ITEM_ID);
inventoryStore.addItem(SEALING_SCROLL_ITEM_ID, 120);
setForceSpawnQuality('SSS');
const supreme = itachiEnemy('D');
for (let i = 0; i < 100; i += 1) {
  const result = attemptCapture({
    target: supreme,
    source: 'manual',
    attemptKey: `noreroll-${i}`,
    rng: () => 0,
  });
  assert(`no-reroll ${i}`, result.success && result.capturedCharacter?.quality === 'SSS');
}
setForceSpawnQuality('random');
DEV_FLAGS.enabled = false;

const seeded = mulberry32(7);
assert('rng determinístico', rollSpawnQualityFromWeights(seeded) === rollSpawnQualityFromWeights(mulberry32(7)));
void pickWeightedIndex;

console.log('matrix scroll x spawn quality');
for (const quality of CHARACTER_QUALITIES) {
  const row = SEALING_SCROLL_TIERS.map((tier) =>
    (getCaptureChance(itachiEnemy(quality), tier).finalChance * 100).toFixed(2),
  );
  console.log(`${quality}\t${row.join('\t')}`);
}

console.log('PASS sealing-quality');
