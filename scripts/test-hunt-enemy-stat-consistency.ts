/**
 * Hunt enemy combat stats are deterministic (no quality at spawn).
 * Run: npx --yes tsx scripts/test-hunt-enemy-stat-consistency.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { huntEnemyStatsForLevel } from '../src/constants/combat';
import { scaleQualityPrimaryStat } from '../src/constants/character-quality-stats';
import { enemyMaxHpForDefinition, scaleEnemyLevelDamage } from '../src/lib/enemy-quality-stats';
import {
  describeHuntEnemyCombatSnapshot,
  snapshotHuntEnemyCombat,
} from '../src/lib/hunt-enemy-combat-stats';
import { rollCaptureQualityBundle } from '../src/lib/hunt-spawn';
import { MAP_KEYS } from '../src/maps/map-registry';
import { attemptCapture, clearCaptureResolved, getCaptureChance } from '../src/systems/capture-engine';
import { setCaptureForceMode, setForceSpawnQuality } from '../src/lib/capture-dev';
import { SEALING_SCROLL_ITEM_ID, SEALING_SCROLL_TIERS } from '../src/constants/sealing';
import { inventoryStore } from '../src/stores/inventory-store';
import { helperStore } from '../src/stores/helper-store';
import { teamStore } from '../src/stores/team-store';
import { DEV_FLAGS } from '../src/config/devConfig';
import type { EnemyDefinition } from '../src/types/enemy';
import type { HuntCatalog } from '../src/types/hunt';
import { normalizeSealedCharacter } from '../src/utils/character-identity';

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

const catalog = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'public/data/wonsr/hunts.json'), 'utf8'),
) as HuntCatalog;

const hunt =
  catalog.hunts.find((entry) => entry.tab !== 'bosses' && !entry.id.startsWith('hunt-teste') && entry.targets[0]) ??
  catalog.hunts[0]!;
const target = hunt.targets[0]!;

const beforeHp = new Set<number>();
for (const fakeMul of [0.3, 0.6, 0.9, 1.3, 1.8, 2.5]) {
  beforeHp.add(scaleQualityPrimaryStat(target.hp, fakeMul));
}

const rows = Array.from({ length: 100 }, () => snapshotHuntEnemyCombat(hunt, target));
const hpSet = new Set(rows.map((row) => row.maxHp));
const atkSet = new Set(rows.map((row) => row.atk));
const defSet = new Set(rows.map((row) => row.def));

assert('100 spawns same hunt/target', rows.length === 100);
assert('single maxHp', hpSet.size === 1);
assert('single atk', atkSet.size === 1);
assert('single def', defSet.size === 1);
assert('no quality on snapshot', rows.every((row) => row.quality === null));
assert('hp matches catalog curve', rows[0]!.maxHp === huntEnemyStatsForLevel(target.level).hp || rows[0]!.maxHp === target.hp);
assert(
  'quality would have varied HP before',
  beforeHp.size > 1,
);
console.log(describeHuntEnemyCombatSnapshot(rows[0]!));
console.log(`hp variants before (quality sim)=${beforeHp.size} after=${hpSet.size}`);

const enemy: EnemyDefinition = {
  id: 'stat-itachi',
  name: 'Itachi',
  hp: target.hp,
  level: target.level,
  xp: 0,
  loot: [],
  spawn: { x: 0, y: 0 },
  speed: 0,
  chaseRadius: 0,
  sprite: 'enemy',
  mapKey: MAP_KEYS.leafVillage,
  sealable: {
    characterId: target.sourceId,
    sourceId: target.sourceId,
    name: target.name,
    lookType: target.lookType,
    level: target.level,
  },
};

assert('enemy hp ignores leftover quality field', enemyMaxHpForDefinition({
  ...enemy,
  sealable: { ...enemy.sealable!, quality: 'SSS', qualityStatMultiplier: 2.8 },
}) === enemyMaxHpForDefinition(enemy));
assert(
  'enemy atk ignores leftover quality field',
  scaleEnemyLevelDamage(70, {
    ...enemy,
    sealable: { ...enemy.sealable!, quality: 'SSS', qualityStatMultiplier: 2.8 },
  }) === scaleEnemyLevelDamage(70, enemy),
);

const scroll = SEALING_SCROLL_TIERS[0]!;
assert(
  'capture chance ignores fake enemy quality',
  getCaptureChance({ ...enemy, sealable: { ...enemy.sealable!, quality: 'SSS' } }, scroll).finalChance ===
    getCaptureChance(enemy, scroll).finalChance,
);

DEV_FLAGS.enabled = true;
setCaptureForceMode('failure');
clearCaptureResolved();
inventoryStore.reset();
teamStore.reset('naruto-classic');
helperStore.setAutoSeal(true);
helperStore.setScrollItemId(SEALING_SCROLL_ITEM_ID);
inventoryStore.addItem(SEALING_SCROLL_ITEM_ID, 5);
const sizeBefore = teamStore.getSnapshot().collection.length;
const fail = attemptCapture({
  target: enemy,
  source: 'manual',
  attemptKey: 'fail-quality',
  rng: () => 0,
});
assert('failure does not capture', fail.success === false && fail.capturedCharacter === null);
assert('failure does not grow collection', teamStore.getSnapshot().collection.length === sizeBefore);

let qualityRolls = 0;
const countingRng = (() => {
  const inner = mulberry32(99);
  return () => {
    qualityRolls += 1;
    return inner();
  };
})();

setCaptureForceMode('success');
clearCaptureResolved();
inventoryStore.addItem(SEALING_SCROLL_ITEM_ID, 5);
const beforeRoll = qualityRolls;
const ok = attemptCapture({
  target: enemy,
  source: 'manual',
  attemptKey: 'ok-quality',
  rng: countingRng,
});
assert('success captures', ok.success === true && ok.capturedCharacter != null);
assert('quality rng used after success', qualityRolls > beforeRoll);
assert('captured has quality', Boolean(ok.capturedCharacter?.quality));
assert(
  'captured has multiplier',
  typeof ok.capturedCharacter?.qualityStatMultiplier === 'number' &&
    ok.capturedCharacter.qualityStatMultiplier > 0,
);
const reloaded = normalizeSealedCharacter(JSON.parse(JSON.stringify(ok.capturedCharacter)));
assert('reload keeps quality', reloaded?.quality === ok.capturedCharacter?.quality);
assert(
  'reload keeps multiplier',
  reloaded?.qualityStatMultiplier === ok.capturedCharacter?.qualityStatMultiplier,
);

setForceSpawnQuality('SS');
clearCaptureResolved();
const mythic = attemptCapture({
  target: enemy,
  source: 'manual',
  attemptKey: 'force-ss',
  rng: () => 0.7166667,
});
assert('force SS on captured instance', mythic.capturedCharacter?.quality === 'SS');
assert(
  'multiplier near 1.93',
  Math.abs((mythic.capturedCharacter?.qualityStatMultiplier ?? 0) - 1.93) < 0.02,
);
assert(
  'enemy combat hp unchanged by that multiplier',
  enemyMaxHpForDefinition(enemy) === target.hp ||
    enemyMaxHpForDefinition(enemy) === Math.floor(target.hp),
);

const a = rollCaptureQualityBundle(mulberry32(3));
const b = rollCaptureQualityBundle(mulberry32(3));
assert('capture quality bundle deterministic', a.quality === b.quality && a.qualityStatMultiplier === b.qualityStatMultiplier);

setForceSpawnQuality('random');
setCaptureForceMode('off');
DEV_FLAGS.enabled = false;

console.log('PASS test-hunt-enemy-stat-consistency');
