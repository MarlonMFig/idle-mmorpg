/**
 * Item 35 — Dev isolation / safe defaults.
 * Run: npx --yes tsx scripts/test-dev-isolation.ts
 */
import './lib/critical-test-bootstrap';
import {
  DEV_FLAGS,
  DEV_FLAGS_SAFE,
  getEnemyHpMultiplier,
  getForceHuntLevel,
  getXpMultiplier,
  isDevEnvironment,
  isDevGameplayOverrideActive,
  isDevMode,
  listActiveDevOverrides,
  resetDangerousDevOverrides,
  resetDevLabSessionState,
  setDevLabSessionActive,
  shouldForceAllSkillsLevel1,
  shouldFreezeOfficialProgress,
  shouldIsolateOfficialSave,
  OFFICIAL_SESSION_STORAGE_KEY,
  DEV_SESSION_STORAGE_KEY,
  DEV_SETTINGS_STORAGE_KEY,
} from '../src/config/devConfig';
import { isDevWriteAllowed } from '../src/lib/dev/dev-write-guard';
import { applyForcedHuntLevels, huntEnemyStatsForLevel } from '../src/constants/combat';
import { OFFLINE_LIMITS, computeEffectiveOfflineDuration, MS_PER_OFFLINE_HOUR } from '../src/constants/offline';
import type { HuntCatalog } from '../src/types/hunt';
import type { MapKey } from '../src/maps/map-registry';

function assert(name: string, cond: boolean): void {
  if (!cond) throw new Error(`FAIL ${name}`);
  console.log(`ok  ${name}`);
}

function sampleCatalog(): HuntCatalog {
  return {
    source: 'test',
    generatedAt: 'test',
    progression: {
      targetsPerHunt: 1,
      charactersPerLevelTier: 1,
      firstLevel: 1,
      levelStep: 1,
    },
    counts: {
      hunts: 1,
      targets: 1,
      baseCharacters: 1,
      monsterVariants: 0,
      uniqueLookTypes: 1,
    },
    atlas: {
      key: 'test',
      imageUrl: '',
      atlasUrl: '',
      frameSize: 32,
    },
    hunts: [
      {
        id: 'h1',
        name: 'T',
        mapKey: 'leaf-village' as MapKey,
        requiredLevel: 10,
        description: '',
        targets: [
          {
            id: 'e1',
            sourceId: 'e1',
            name: 'E',
            category: 'test',
            source: 'test',
            lookType: 1,
            hasSprite: true,
            requiredLevel: 10,
            level: 10,
            hp: 100,
            xp: 20,
            speed: 1,
            targetDistance: 40,
            loot: [],
          },
        ],
      },
    ],
  };
}

function main(): void {
  resetDevLabSessionState();
  try {
    assert('safe xp = 1 outside lab', getXpMultiplier() === 1);
    assert('safe enemy hp = 1 outside lab', getEnemyHpMultiplier() === 1);
    assert('safe force hunt null outside lab', getForceHuntLevel() == null);
    assert('safe force skills off outside lab', shouldForceAllSkillsLevel1() === false);
    assert('no gameplay override outside lab', isDevGameplayOverrideActive() === false);
    assert('isolate default true in flags', DEV_FLAGS.isolateOfficialSave === true);
    assert('safe defaults match', DEV_FLAGS_SAFE.xpMultiplier === 1 && DEV_FLAGS_SAFE.enemyHpMultiplier === 1);

    assert('official key', OFFICIAL_SESSION_STORAGE_KEY === 'idle-mmorpg:session-v1');
    assert('dev session key', DEV_SESSION_STORAGE_KEY === 'idle-mmorpg:session-dev-v1');
    assert('dev settings key', DEV_SETTINGS_STORAGE_KEY === 'idle-mmorpg:dev-settings-v1');

    setDevLabSessionActive(true);
    if (isDevEnvironment()) {
      assert('lab override active', isDevGameplayOverrideActive());
      assert('lab isolates official', shouldIsolateOfficialSave());
      assert('lab freezes official', shouldFreezeOfficialProgress());

      DEV_FLAGS.xpMultiplier = 110;
      DEV_FLAGS.enemyHpMultiplier = 2;
      DEV_FLAGS.forceHuntLevel = 1;
      DEV_FLAGS.forceAllSkillsLevel1 = true;
      assert('lab xp ×110', getXpMultiplier() === 110);
      assert('lab enemy hp ×2', getEnemyHpMultiplier() === 2);
      assert('lab force hunt 1', getForceHuntLevel() === 1);
      assert('lab force skills', shouldForceAllSkillsLevel1() === true);
      const listed = listActiveDevOverrides();
      assert('overrides listed', listed.some((r) => r.includes('XP')) && listed.some((r) => r.includes('HP')));

      const catalog = sampleCatalog();
      const forced = applyForcedHuntLevels(catalog);
      const stats = huntEnemyStatsForLevel(1);
      assert('forced hunt level applied in lab', forced.hunts[0]!.targets[0]!.level === 1);
      assert(
        'forced hp uses multiplier',
        forced.hunts[0]!.targets[0]!.hp === Math.round(Number(stats.hp) * 2),
      );

      setDevLabSessionActive(false);
      resetDangerousDevOverrides();
      assert('after close xp 1', getXpMultiplier() === 1);
      assert('after close hp 1', getEnemyHpMultiplier() === 1);
      assert('after close force null', getForceHuntLevel() == null);
      const normal = applyForcedHuntLevels(catalog);
      assert(
        'hunt normal untouched',
        normal.hunts[0]!.targets[0]!.hp === 100 && normal.hunts[0]!.targets[0]!.level === 10,
      );
    } else {
      assert('prod lab cannot override', isDevGameplayOverrideActive() === false);
      assert('prod not dev mode', isDevMode() === false);
    }

    const f2p = computeEffectiveOfflineDuration(10 * MS_PER_OFFLINE_HOUR, false);
    const vip = computeEffectiveOfflineDuration(10 * MS_PER_OFFLINE_HOUR, true);
    assert('offline 4h', f2p.effectiveOfflineDuration === OFFLINE_LIMITS.nonVipHours * MS_PER_OFFLINE_HOUR);
    assert('offline 8h', vip.effectiveOfflineDuration === OFFLINE_LIMITS.vipHours * MS_PER_OFFLINE_HOUR);

    const writeOk = isDevWriteAllowed();
    assert('write guard boolean', typeof writeOk === 'boolean');
    if (!isDevEnvironment()) {
      assert('prod blocks write', writeOk === false);
    }

    setDevLabSessionActive(false);
    DEV_FLAGS.xpMultiplier = 110;
    assert('×110 ignored outside lab', getXpMultiplier() === 1);

    console.log(
      `\nenv: NODE_ENV=${process.env.NODE_ENV} isDevEnvironment=${isDevEnvironment()} write=${writeOk}`,
    );
    console.log('All dev-isolation tests passed.');
  } finally {
    resetDevLabSessionState();
  }
}

main();
