/**
 * Quality stat ranges + persistent multiplier. Run:
 * npx --yes tsx scripts/test-character-quality-stats.ts
 */
import { BASE_ATTRIBUTES, LEVEL_ATTRIBUTE_GROWTH } from '../src/constants/attributes';
import { COMBAT_ENERGY } from '../src/constants/combat-energy';
import {
  QUALITY_STAT_RANGES,
  clampQualityStatMultiplier,
  formatQualityStatMultiplier,
  isQualityStatMultiplierInRange,
  qualityStatMidpoint,
  resolveQualityStatMultiplier,
  scaleQualityPrimaryStat,
} from '../src/constants/character-quality-stats';
import { estimateInstanceCombatPower } from '../src/lib/character-instance-stats';
import { enemyMaxHpForDefinition, scaleEnemyLevelDamage } from '../src/lib/enemy-quality-stats';
import { MAP_KEYS } from '../src/maps/map-registry';
import { CHARACTER_QUALITIES, type CharacterQuality } from '../src/types/character-meta';
import type { CharacterPotential } from '../src/types/character-meta';
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
import { backfillPotential, qualityStatMultiplierFromPotential, rollCaptureBundle } from '../src/lib/raridade-potencial.js';

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
  const bundle = rollCaptureBundle({ rng: mulberry32(quality.charCodeAt(0) * 99991) });
  const forced = { ...bundle, quality };
  const m = qualityStatMultiplierFromPotential(quality, forced.potential);
  assert(`${quality} derived in range`, isQualityStatMultiplierInRange(quality, m));
}

const samples: Record<CharacterQuality, CharacterPotential> = Object.fromEntries(
  CHARACTER_QUALITIES.map((quality) => [quality, { hp: 10, forca: 10, defesa: 10 }]),
) as Record<CharacterQuality, CharacterPotential>;
for (const quality of CHARACTER_QUALITIES) {
  const seed = samples[quality];
  const stored = qualityStatMultiplierFromPotential(quality, seed);
  const potential = backfillPotential(quality, stored, () => 0.5);
  const next = qualityStatMultiplierFromPotential(quality, potential);
  const err = Math.abs(next - stored) / stored;
  assert(`backfill ${quality} within 1%`, err <= 0.01);
  const migrated = normalizeSealedCharacter({
    id: `legacy-${quality}`,
    name: 'Itachi',
    lookType: 9002,
    sourceId: ITACHI,
    starterId: null,
    quality,
    qualityStatMultiplier: stored,
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
  assert(`migrate ${quality} has potential`, Boolean(migrated?.potential));
  assert(
    `migrate ${quality} multiplier in range`,
    isQualityStatMultiplierInRange(quality, migrated?.qualityStatMultiplier ?? 0),
  );
}

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
    scaleQualityPrimaryStat(
      BASE_ATTRIBUTES.hp * starAttributeMultiplier(2) + LEVEL_ATTRIBUTE_GROWTH.hp * 49,
      0.3,
    ),
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
  enemyMaxHpForDefinition(huntEnemy('SS', 1.93, 500)).eq(500),
);
assert(
  'enemy dmg ignores quality on hunt foe',
  scaleEnemyLevelDamage(70, huntEnemy('SS', 2.05)).eq(
    scaleEnemyLevelDamage(70, huntEnemy('SS', 1.55)),
  ),
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
assert('legacy legendary has potential', Boolean(legacy?.potential));
assert(
  'legacy legendary multiplier in S range',
  isQualityStatMultiplierInRange('S', legacy?.qualityStatMultiplier ?? 0),
);
const legacyReload = normalizeSealedCharacter(legacy);
assert('legacy reload keeps potential', Boolean(legacyReload?.potential));
assert(
  'legacy reload multiplier stable',
  legacyReload?.qualityStatMultiplier ===
    resolveQualityStatMultiplier(legacyReload?.quality, legacyReload?.qualityStatMultiplier, legacyReload?.potential),
);

const preserved = normalizeSealedCharacter({
  id: 'ss-saved',
  name: 'Itachi',
  lookType: 9002,
  sourceId: ITACHI,
  starterId: null,
  quality: 'SS',
  qualityStatMultiplier: 1.93,
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
assert('quality remains mythic', preserved?.quality === 'SS');
assert('saved SS has potential', Boolean(preserved?.potential));
assert(
  'saved 1.93 backfill in SS range',
  isQualityStatMultiplierInRange('SS', preserved?.qualityStatMultiplier ?? 0),
);

const overlap = clampQualityStatMultiplier('A', 1.08);
assert('epic 1.08 stays epic range', overlap === 1.08);

const highDef = computePlayerAttributes({
  level: 1,
  stars: 0,
  quality: 'A',
  potential: { hp: 10, forca: 2, defesa: 20 },
});
const lowDef = computePlayerAttributes({
  level: 1,
  stars: 0,
  quality: 'A',
  potential: { hp: 10, forca: 20, defesa: 2 },
});
assert('defesa roll altera DEF', highDef.totals.defense > lowDef.totals.defense);
assert('forca roll altera ATK', lowDef.totals.strength > highDef.totals.strength);

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
assert('capture has potential', Boolean(captured.capturedCharacter?.potential));
assert(
  'capture multiplier derived from potential',
  Math.abs(
    (captured.capturedCharacter?.qualityStatMultiplier ?? 0) -
      qualityStatMultiplierFromPotential('SS', captured.capturedCharacter!.potential),
  ) < 1e-5,
);
const reloaded = normalizeSealedCharacter(captured.capturedCharacter);
assert('reload keeps mythic', reloaded?.quality === 'SS');
setCaptureForceMode('off');
setForceSpawnQuality('random');
DEV_FLAGS.enabled = false;

console.log('PASS test-character-quality-stats');
