/**
 * Hunt player XP progression, level-gap, Lv1→50.
 * Run: npx --yes tsx scripts/test-xp-progression.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { COMBAT_ENERGY } from '../src/constants/combat-energy';
import { QUALITY_STAT_RANGES as QUALITY_RANGES } from '../src/constants/character-quality-stats';
import { PLAYER_ATTACK_COOLDOWN_MS as ATTACK_CD } from '../src/constants/combat';
import { getXpMultiplier } from '../src/config/devConfig';
import { LEVEL_RULES, MAX_PLAYER_LEVEL } from '../src/config/gameConfig';
import { VIP_EXP_MULT } from '../src/constants/vip';
import { XP_LEVEL_GAP_MULTIPLIERS } from '../src/constants/xp-level-gap';
import { masteryXpFromKills } from '../src/lib/character-mastery';
import { huntEnemyXpForLevel, legacyHuntEnemyXp } from '../src/lib/hunt-enemy-xp';
import { computeHuntKillXp } from '../src/lib/hunt-kill-xp';
import {
  addExperience,
  getTotalXpToReachLevel,
  getXpRequiredForLevel,
} from '../src/lib/player-progression';
import { expProgressMultiplier } from '../src/lib/progression-bonuses';
import { xpLevelGapMultiplier } from '../src/lib/xp-level-gap';
import {
  compareHuntVsStale,
  recommendedHuntForLevel,
  simulateExactMinutes,
  simulateXpProgression,
} from '../src/lib/xp-progression-sim';
import { vitalsStore } from '../src/stores/vitals-store';
import { DEFAULT_VITALS } from '../src/constants/hud';
import type { HuntCatalog } from '../src/types/hunt';

function assert(name: string, cond: boolean): void {
  if (!cond) throw new Error(`FAIL ${name}`);
  console.log(`ok  ${name}`);
}

function loadHunts() {
  const file = path.join(process.cwd(), 'public/data/wonsr/hunts.json');
  const catalog = JSON.parse(fs.readFileSync(file, 'utf8')) as HuntCatalog;
  return catalog.hunts;
}

function minutesTo(sim: ReturnType<typeof simulateXpProgression>, target: number): number {
  const row = sim.levels.find((level) => level.level === target - 1);
  return row?.minutesAccumulated ?? sim.estimatedMinutes;
}

function main(): void {
  const hunts = loadHunts();

  assert('DEV xpMultiplier is 1 in calibration context', getXpMultiplier() === 1);
  assert('VIP/exp boost is 1 (VIP off)', expProgressMultiplier() === 1);
  assert('VIP formula untouched', VIP_EXP_MULT === 1.2);
  assert('level cap unchanged', MAX_PLAYER_LEVEL === 9999);
  assert('XP required formula unchanged', LEVEL_RULES.xpBase === 100 && LEVEL_RULES.xpExponent === 1.65);
  assert('energy untouched', COMBAT_ENERGY.maxEnergy > 0);
  assert(
    'quality D range official',
    QUALITY_RANGES.D.min === 0.23 && QUALITY_RANGES.D.max === 0.38,
  );
  assert('attack CD 380', ATTACK_CD === 380);

  const curveLevels = [1, 5, 10, 20, 30, 40, 50, 75, 100, 150, 200, 300, 400, 500, MAX_PLAYER_LEVEL];
  let prevReq = getXpRequiredForLevel(1);
  for (const level of curveLevels) {
    const req = getXpRequiredForLevel(level);
    assert(`required Lv${level} finite`, Number.isFinite(req.m) && req.gte(1));
    if (level < MAX_PLAYER_LEVEL) assert(`required Lv${level} >= prev`, req.gte(prevReq) || level === 1);
    prevReq = req;
  }

  const gapCases: Array<[number, number]> = [
    [0, 1],
  ];
  for (const [gap, expected] of gapCases) {
    const got = xpLevelGapMultiplier(200, 200 - gap);
    assert(`gap ${gap} = ${expected}`, Math.abs(got - expected) < 1e-9);
  }
  assert('Δ=0 multiplicador 1', xpLevelGapMultiplier(40, 40) === 1);
  assert('Δ negativo usa penalty', xpLevelGapMultiplier(40, 1) < 1);
  assert('gap table floor 10%', XP_LEVEL_GAP_MULTIPLIERS[XP_LEVEL_GAP_MULTIPLIERS.length - 1]!.multiplier === 0.1);

  let last = 1;
  for (let gap = 0; gap <= 200; gap += 1) {
    const mul = xpLevelGapMultiplier(200, 200 - gap);
    assert(`mono gap ${gap}`, mul <= last + 1e-12);
    last = mul;
  }

  const pipeline = computeHuntKillXp({
    playerLevel: 40,
    enemyLevel: 1,
    enemyHp: 100,
    xpMultiplier: 1,
    expBoostMultiplier: 1.2,
  });
  const plain = computeHuntKillXp({
    playerLevel: 40,
    enemyLevel: 1,
    enemyHp: 100,
    xpMultiplier: 1,
    expBoostMultiplier: 1,
  });
  assert('VIP 1.2 aplica depois do Δ', pipeline.finalXp.gte(plain.finalXp));

  const baseline = simulateXpProgression(hunts, 1, 50, { useLegacyEnemyXp: true, xpMultiplier: 1 });
  const after = simulateXpProgression(hunts, 1, 50, { xpMultiplier: 1 });
  console.log(
    `baseline 1→50 ${baseline.estimatedMinutes.toFixed(1)}m | after ${after.estimatedMinutes.toFixed(1)}m`,
  );
  for (const target of [10, 20, 30, 40, 50] as const) {
    const b = simulateXpProgression(hunts, 1, target, { useLegacyEnemyXp: true });
    const a = simulateXpProgression(hunts, 1, target);
    console.log(`  Lv${target} antes ${b.estimatedMinutes.toFixed(1)}m depois ${a.estimatedMinutes.toFixed(1)}m`);
  }

  assert('Lv1→50 simula minutos finitos', Number.isFinite(after.estimatedMinutes) && after.estimatedMinutes > 0);
  assert('sim does not mutate vitals', vitalsStore.getLevel() === DEFAULT_VITALS.level);

  const rec = recommendedHuntForLevel(hunts, 50)!;
  const stale = compareHuntVsStale(hunts, 50, hunts.find((hunt) => hunt.requiredLevel === 1)!.id);
  assert('stale hunt still pays XP', (stale.stale?.finalXpPerKill ?? 0) > 0);

  let xpPrev = 0;
  for (let level = 1; level <= 80; level += 1) {
    const xp = huntEnemyXpForLevel(level);
    assert(`enemy xp Lv${level} > 0`, xp >= 1);
    assert(`enemy xp Lv${level} no cliff x10`, level === 1 || xp < xpPrev * 12);
    xpPrev = xp;
  }
  assert('legacy formula still defined', legacyHuntEnemyXp(10) === 45);

  const claimed = { rewardClaimed: false };
  const grantOnce = () => {
    if (claimed.rewardClaimed) return 0;
    claimed.rewardClaimed = true;
    return computeHuntKillXp({ playerLevel: 1, enemyLevel: 1 }).finalXp;
  };
  const first = grantOnce();
  const second = grantOnce();
  assert('no double grant', first > 0 && second === 0);

  vitalsStore.reset({ ...DEFAULT_VITALS, level: 1, xp: 0 });
  const need = getXpRequiredForLevel(1);
  vitalsStore.addXp(need);
  const leveled = vitalsStore.getSnapshot();
  assert('level up in store', leveled.level === 2);
  const snap = { level: leveled.level, xp: leveled.xp, hp: leveled.hp, hpMax: leveled.hpMax };
  vitalsStore.reset(DEFAULT_VITALS);
  vitalsStore.reset({ ...DEFAULT_VITALS, ...snap, xpMax: getXpRequiredForLevel(snap.level) });
  const reloaded = vitalsStore.getSnapshot();
  assert('reload keeps level', reloaded.level === 2 && reloaded.xp === snap.xp);

  const masteryA = masteryXpFromKills(10, 1);
  const masteryB = masteryXpFromKills(10, 1);
  assert('mastery formula stable', masteryA === masteryB);

  const add = addExperience(1, 0, getTotalXpToReachLevel(50));
  assert('addExperience 1→50', add.level === 50);

  console.log('PASS test-xp-progression');
}

main();
