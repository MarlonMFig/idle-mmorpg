/**
 * Hunt kill XP: Δ do personagem, não da conta.
 * Run: npx --yes tsx scripts/test-hunt-kill-character-delta.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { BALANCE } from '../src/anime-idle/balance';
import { difficultyMultiplier } from '../src/anime-idle/formulas';
import {
  DEV_FLAGS,
  getForceHuntLevel,
  resetDevLabSessionState,
  setDevLabSessionActive,
} from '../src/config/devConfig';
import { applyForcedHuntLevels } from '../src/constants/combat';
import { DEFAULT_VITALS } from '../src/constants/hud';
import { grantHuntKillXp } from '../src/lib/grant-player-xp';
import { computeHuntKillXp } from '../src/lib/hunt-kill-xp';
import { addExperience } from '../src/lib/player-progression';
import { teamStore } from '../src/stores/team-store';
import { vitalsStore } from '../src/stores/vitals-store';
import { d } from '../src/lib/decimal';
import type { HuntCatalog } from '../src/types/hunt';

const FIRST_HUNT_HP = 63;
const FIRST_HUNT_ENEMY_LEVEL = 1;

function assert(name: string, cond: boolean, detail?: string): void {
  if (!cond) throw new Error(`FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  console.log(`ok  ${name}`);
}

function mockChar(id: string, level: number): Parameters<typeof teamStore.addToCollection>[0] {
  return {
    id,
    name: id,
    lookType: 1,
    characterId: id,
    characterKey: `look:${id}`,
    quality: 'C',
    stars: 1,
    lineageId: 'ninja',
    level,
    xp: 0,
  };
}

function seedTeam(levels: number[], accountLevel: number): string[] {
  teamStore.reset('naruto-classic');
  const starterId = teamStore.getSnapshot().collection[0]!.id;
  teamStore.setCharacterProgress(starterId, { level: levels[0]!, xp: 0 });
  const teamIds = [starterId];
  for (let i = 1; i < levels.length; i += 1) {
    const id = `hunt-delta-${i}`;
    teamStore.addToCollection(mockChar(id, levels[i]!));
    teamStore.addToTeam(id);
    teamIds.push(id);
  }
  teamStore.applyFormation(teamIds, starterId);
  vitalsStore.reset({
    ...DEFAULT_VITALS,
    level: accountLevel,
    xp: d(0),
    xpMax: d(1_000_000_000),
  });
  return teamIds;
}

function expectedHunterXp(memberLevel: number, enemyHp = FIRST_HUNT_HP) {
  return computeHuntKillXp({
    playerLevel: memberLevel,
    enemyLevel: FIRST_HUNT_ENEMY_LEVEL,
    enemyHp,
    xpMultiplier: 1,
    expBoostMultiplier: 1,
  }).finalXp;
}

{
  const expected = expectedHunterXp(4);
  assert('char 4 vs enemy 1 acima do piso Δ', expected.gt(4), `got ${expected}`);
}

{
  const amounts = [4, 96, 500].map((accountLevel) => {
    seedTeam([4], accountLevel);
    const xpBefore = vitalsStore.getSnapshot().xp;
    const granted = grantHuntKillXp(FIRST_HUNT_HP, FIRST_HUNT_ENEMY_LEVEL);
    const accountGain = vitalsStore.getSnapshot().xp.minus(xpBefore);
    const char = teamStore.getActive()!;
    return { accountLevel, granted, accountGain, charXp: char.xp };
  });
  const first = amounts[0]!;
  const expected = expectedHunterXp(4);
  assert(
    'kill grant segue Δ do caçador (não 4)',
    first.granted.eq(expected),
    `got ${first.granted}`,
  );
  assert('conta recebe o mesmo valor', first.accountGain.eq(expected));
  assert('personagem recebe o mesmo valor', first.charXp.eq(expected));
  assert(
    'conta 4 / 96 / 500 idênticos',
    amounts.every(
      (row) =>
        row.granted.eq(first.granted) &&
        row.accountGain.eq(first.accountGain) &&
        row.charXp.eq(first.charXp),
    ),
    amounts.map((row) => String(row.granted)).join(','),
  );
}

{
  const ids = seedTeam([4, 60, 90], 96);
  const hunterXp = expectedHunterXp(4);
  const hunterBefore = teamStore.getCharacterInstance(ids[0]!)!;
  const predictedHunter = addExperience(hunterBefore.level, hunterBefore.xp, hunterXp);
  const benchXpBefore = ids.slice(1).map((id) => teamStore.getCharacterInstance(id)!.xp);
  grantHuntKillXp(FIRST_HUNT_HP, FIRST_HUNT_ENEMY_LEVEL);
  const hunterAfter = teamStore.getCharacterInstance(ids[0]!)!;
  const benchAfter = ids.slice(1).map((id) => teamStore.getCharacterInstance(id)!);
  assert(
    'caçador Nv.4 recebe o XP cheio (sem share)',
    hunterXp.eq(expectedHunterXp(4)),
    `got ${hunterXp}`,
  );
  assert(
    'caçador aplica o XP',
    hunterAfter.level === predictedHunter.level && hunterAfter.xp.eq(predictedHunter.xp),
    `${hunterAfter.level}/${hunterAfter.xp} vs ${predictedHunter.level}/${predictedHunter.xp}`,
  );
  assert(
    'reserva não ganha XP da hunt',
    benchAfter.every(
      (member, i) => member.xp.eq(benchXpBefore[i]!) && member.level === 60 + i * 30,
    ),
    benchAfter.map((m) => `${m.level}/${m.xp}`).join(', '),
  );
}

{
  const ids = seedTeam([4, 60, 90], 96);
  teamStore.setActive(ids[1]!);
  const hunterXp = expectedHunterXp(60);
  const before = ids.map((id) => {
    const member = teamStore.getCharacterInstance(id)!;
    return { level: member.level, xp: member.xp };
  });
  const predicted = addExperience(before[1]!.level, before[1]!.xp, hunterXp);
  grantHuntKillXp(FIRST_HUNT_HP, FIRST_HUNT_ENEMY_LEVEL);
  const after = ids.map((id) => teamStore.getCharacterInstance(id)!);
  assert(
    'ativo no slot 1: só ele ganha XP (Δ do Nv.60)',
    after[1]!.level === predicted.level && after[1]!.xp.eq(predicted.xp),
    `${after[1]!.level}/${after[1]!.xp} vs ${predicted.level}/${predicted.xp}`,
  );
  assert(
    'os outros da formação não ganham XP',
    after[0]!.xp.eq(before[0]!.xp) &&
      after[0]!.level === before[0]!.level &&
      after[2]!.xp.eq(before[2]!.xp) &&
      after[2]!.level === before[2]!.level,
    after.map((m) => `${m.level}/${m.xp}`).join(', '),
  );
}

{
  const row = computeHuntKillXp({
    playerLevel: 90,
    enemyLevel: 1,
    enemyHp: FIRST_HUNT_HP,
  });
  assert('char 90 vs 1 usa DELTA_FLOOR', row.levelGapMultiplier === BALANCE.DELTA_FLOOR);
  assert('char 90 vs 1 XP no piso', row.finalXp.eq(expectedHunterXp(90)));
}

{
  const file = path.join(process.cwd(), 'public/data/wonsr/hunts.json');
  const catalog = JSON.parse(fs.readFileSync(file, 'utf8')) as HuntCatalog;
  const high = catalog.hunts.find((hunt) => (hunt.targets[0]?.level ?? 0) >= 20);
  assert('catálogo tem hunt inimigo ≥20', Boolean(high));
  setDevLabSessionActive(true);
  DEV_FLAGS.forceHuntLevel = 1;
  const forced = applyForcedHuntLevels(catalog);
  const forcedHigh = forced.hunts.find((hunt) => hunt.id === high!.id)!;
  const charLevel = 4;
  const enemyLevel = forcedHigh.targets[0]!.level;
  const delta = enemyLevel - charLevel;
  const forceOn = getForceHuntLevel() === 1;
  assert(
    'forceHunt continua: requiredLevel overlay = 1, level do inimigo intacto',
    forceOn && forcedHigh.requiredLevel === 1 && enemyLevel === high!.targets[0]!.level,
    `force=${String(getForceHuntLevel())} req=${forcedHigh.requiredLevel} enemy=${enemyLevel}`,
  );
  assert(
    'furo de gating DEV: Δ>0 alcançável com forceHunt',
    delta > 0 && difficultyMultiplier(delta) > 1,
    `Δ=${delta}`,
  );
  resetDevLabSessionState();
}

console.log('PASS test-hunt-kill-character-delta');
