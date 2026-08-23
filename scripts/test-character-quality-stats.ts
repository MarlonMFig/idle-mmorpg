/**
 * Quality stat ranges + persistent multiplier. Run:
 * npx --yes tsx scripts/test-character-quality-stats.ts
 */
import { BASE_ATTRIBUTES } from '../src/constants/attributes';
import { COMBAT_ENERGY } from '../src/constants/combat-energy';
import {
  QUALITY_STAT_RANGES,
  clampQualityStatMultiplier,
  formatQualityStatMultiplier,
  isQualityStatMultiplierInRange,
  qualityStatMidpoint,
  rollQualityStatMultiplier,
  scaleQualityPrimaryStat,
  simulateQualityStatRolls,
} from '../src/constants/character-quality-stats';
import { estimateInstanceCombatPower } from '../src/lib/character-instance-stats';
import { enemyMaxHpForDefinition, scaleEnemyLevelDamage } from '../src/lib/enemy-quality-stats';
import { MAP_KEYS } from '../src/maps/map-registry';
import { CHARACTER_QUALITIES, type CharacterQuality } from '../src/types/character-meta';
import type { EnemyDefinition } from '../src/types/enemy';
import { computePlayerAttributes } from '../src/utils/attributes';
import { normalizeSealedCharacter } from '../src/utils/character-identity';
import { DEV_FLAGS } from '../src/config/devConfig';
import { inventoryStore } from '../src/stores/inventory-store';
import { helperStore } from '../src/stores/helper-store';
import { teamStore } from '../src/stores/team-store';
import { SEALING_SCROLL_ITEM_ID } from '../src/constants/sealing';
import { attemptCapture, clearCaptureResolved } from '../src/systems/capture-engine';
import { setCaptureForceMode, setForceSpawnQuality } from '../src/lib/capture-dev';
import { starAttributeMultiplier } from '../src/config/gameConfig';

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

function stats(opts: {
  quality: CharacterQuality;
  qualityStatMultiplier: number;
  level: number;
  stars: number;
  awakeningLevel: number;
}) {
  return computePlayerAttributes({
    characterId: ITACHI,
    ...opts,
  });
}

function huntEnemy(quality: CharacterQuality, multiplier: number, hp = 500): EnemyDefinition {
  return {
    id: `q-${quality}-${multiplier}`,
    name: 'Itachi',
    hp,
    level: 40,
    xp: 0,
    loot: [],
    spawn: { x: 0, y: 0 },
    speed: 80,
    chaseRadius: 100,
    sprite: 'enemy',
    mapKey: MAP_KEYS.leafVillage,
    sealable: {
      characterId: ITACHI,
      sourceId: ITACHI,
      name: 'Itachi',
      lookType: 9002,
      level: 40,
      quality,
      qualityStatMultiplier: multiplier,
    },
  };
}

assert('7 ranges', Object.keys(QUALITY_STAT_RANGES).length === 7);

for (const quality of CHARACTER_QUALITIES) {
  const rng = mulberry32(quality.charCodeAt(0) * 99991);
  let out = 0;
  for (let i = 0; i < 10_000; i += 1) {
    const rolled = rollQualityStatMultiplier(quality, rng);
    if (!isQualityStatMultiplierInRange(quality, rolled)) out += 1;
  }
  assert(`10k ${quality} in range`, out === 0);
  const sim = simulateQualityStatRolls(quality, 10_000, mulberry32(quality.charCodeAt(0) * 17));
  const expected = (QUALITY_STAT_RANGES[quality].min + QUALITY_STAT_RANGES[quality].max) / 2;
  assert(`10k ${quality} avg near math mid`, Math.abs(sim.average - expected) < 0.03);
  console.log(
    `  ${quality} min=${sim.min.toFixed(4)} max=${sim.max.toFixed(4)} avg=${sim.average.toFixed(4)} mathMid=${expected.toFixed(4)} visualMid=${QUALITY_STAT_RANGES[quality].midpoint}`,
  );
}

const mythicRolls = new Set<number>();
const mythicRng = mulberry32(20260823);
for (let i = 0; i < 100; i += 1) {
  mythicRolls.add(rollQualityStatMultiplier('SS', mythicRng));
}
assert('100 mythic rolls vary', mythicRolls.size > 10);

const lv = 100;
const midRows = CHARACTER_QUALITIES.map((quality) => {
  const m = qualityStatMidpoint(quality);
  const t = stats({
    quality,
    qualityStatMultiplier: m,
    level: lv,
    stars: 0,
    awakeningLevel: 0,
  }).totals;
  return {
    quality,
    m,
    hp: t.hp,
    atk: t.strength,
    def: t.defense,
    power: estimateInstanceCombatPower({
      level: lv,
      stars: 0,
      quality,
      qualityStatMultiplier: m,
      characterId: ITACHI,
      awakeningLevel: 0,
    }),
  };
});
console.log('Itachi Lv100 midpoint reference');
console.table(
  midRows.map((row) => ({
    quality: row.quality,
    x: formatQualityStatMultiplier(row.m),
    hp: row.hp,
    atk: row.atk,
    def: row.def,
    power: row.power,
  })),
);

const a = stats({
  quality: 'SS',
  qualityStatMultiplier: 1.55,
  level: lv,
  stars: 0,
  awakeningLevel: 0,
});
const b = stats({
  quality: 'SS',
  qualityStatMultiplier: 2.05,
  level: lv,
  stars: 0,
  awakeningLevel: 0,
});
assert('same instance read stable', a.totals.hp === stats({
  quality: 'SS',
  qualityStatMultiplier: 1.55,
  level: lv,
  stars: 0,
  awakeningLevel: 0,
}).totals.hp);
assert('mythic 2.05 HP > 1.55', b.totals.hp > a.totals.hp);
assert('mythic 2.05 ATK > 1.55', b.totals.strength > a.totals.strength);
assert(
  'mythic 2.05 power > 1.55',
  estimateInstanceCombatPower({
    level: lv,
    stars: 0,
    quality: 'SS',
    qualityStatMultiplier: 2.05,
    characterId: ITACHI,
    awakeningLevel: 0,
  }) >
    estimateInstanceCombatPower({
      level: lv,
      stars: 0,
      quality: 'SS',
      qualityStatMultiplier: 1.55,
      characterId: ITACHI,
      awakeningLevel: 0,
    }),
);

assert(
  'speed not scaled',
  stats({
    quality: 'D',
    qualityStatMultiplier: 0.2,
    level: 1,
    stars: 0,
    awakeningLevel: 0,
  }).totals.speed ===
    stats({
      quality: 'SSS',
      qualityStatMultiplier: 2.8,
      level: 1,
      stars: 0,
      awakeningLevel: 0,
    }).totals.speed,
);

const star0 = stats({
  quality: 'D',
  qualityStatMultiplier: 0.3,
  level: 50,
  stars: 0,
  awakeningLevel: 0,
}).totals.hp;
const star1 = stats({
  quality: 'D',
  qualityStatMultiplier: 0.3,
  level: 50,
  stars: 2,
  awakeningLevel: 0,
}).totals.hp;
assert('stars still apply', star1 > star0);
assert(
  'stars then quality floor',
  star1 ===
    scaleQualityPrimaryStat(BASE_ATTRIBUTES.hp * starAttributeMultiplier(2) + 10 * 49, 0.3),
);

const aw0 = stats({
  quality: 'D',
  qualityStatMultiplier: 0.3,
  level: 50,
  stars: 0,
  awakeningLevel: 0,
}).totals.strength;
const aw1 = stats({
  quality: 'D',
  qualityStatMultiplier: 0.3,
  level: 50,
  stars: 0,
  awakeningLevel: 1,
}).totals.strength;
assert('awakening still applies', aw1 > aw0);

assert(
  'enemy HP ignores quality on hunt foe',
  enemyMaxHpForDefinition(huntEnemy('SS', 1.93, 500)) === 500,
);
assert(
  'enemy dmg ignores quality on hunt foe',
  scaleEnemyLevelDamage(70, huntEnemy('SS', 2.05)) ===
    scaleEnemyLevelDamage(70, huntEnemy('SS', 1.55)),
);

assert('energy untouched', COMBAT_ENERGY.maxEnergy === 100 && COMBAT_ENERGY.energyGainPerBasicHit === 10);

const legacy = normalizeSealedCharacter({
  id: 'legacy-s',
  name: 'Itachi',
  lookType: 9002,
  sourceId: ITACHI,
  starterId: null,
  quality: 'S',
  stars: 0,
  level: 1,
  xp: 0,
  masteryLevel: 0,
  masteryXp: 0,
  awakeningLevel: 0,
  isFavorite: false,
  isLocked: false,
  characterId: ITACHI,
  characterKey: 'look:9002',
  previewUrl: '',
});
assert('legacy legendary midpoint 1.30', legacy?.qualityStatMultiplier === 1.3);
const legacyReload = normalizeSealedCharacter(legacy);
assert('legacy reload stays 1.30', legacyReload?.qualityStatMultiplier === 1.3);

const preserved = normalizeSealedCharacter({
  ...legacy,
  quality: 'SS',
  qualityStatMultiplier: 1.93,
});
assert('saved 1.93 survives normalize', preserved?.qualityStatMultiplier === 1.93);
assert('quality remains mythic', preserved?.quality === 'SS');

const overlap = clampQualityStatMultiplier('A', 1.08);
assert('epic 1.08 stays epic range', overlap === 1.08);

DEV_FLAGS.enabled = true;
setCaptureForceMode('success');
setForceSpawnQuality('SS');
clearCaptureResolved();
inventoryStore.reset();
teamStore.reset('naruto-classic');
helperStore.setAutoSeal(true);
helperStore.setScrollItemId(SEALING_SCROLL_ITEM_ID);
inventoryStore.addItem(SEALING_SCROLL_ITEM_ID, 5);
const captured = attemptCapture({
  target: huntEnemy('D', 0.3, 1),
  source: 'manual',
  rng: () => 0.7166667,
});
assert('capture success', captured.success === true && captured.capturedCharacter != null);
assert('capture quality rolled as forced SS', captured.capturedCharacter?.quality === 'SS');
assert(
  'capture multiplier near 1.93',
  Math.abs((captured.capturedCharacter?.qualityStatMultiplier ?? 0) - 1.93) < 0.02,
);
const reloaded = normalizeSealedCharacter(captured.capturedCharacter);
assert('reload keeps mythic', reloaded?.quality === 'SS');
setCaptureForceMode('off');
setForceSpawnQuality('random');
DEV_FLAGS.enabled = false;

console.log('PASS test-character-quality-stats');
