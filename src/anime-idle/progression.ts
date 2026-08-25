import { BALANCE, XP_PER_HP } from './balance';
import { resolveKills, timeToKill } from './combat';
import { Decimal, cloneDecimal, d } from './decimal';
import {
  difficultyMultiplier,
  dps,
  enemyLevelFor,
  xpShare,
  xpToNextLevel,
  zoneById,
} from './formulas';
import type { Character, CharacterLevelDelta, GameState, ReturnSummary, TeamSlot } from './types';

function cloneCharacter(character: Character): Character {
  return { ...character, xpCurrent: cloneDecimal(character.xpCurrent) };
}

export function cloneGameState(state: GameState): GameState {
  return {
    characters: state.characters.map(cloneCharacter),
    currentZoneId: state.currentZoneId,
    combatProgress: state.combatProgress,
    fragments: state.fragments,
    xpTotalHistoric: cloneDecimal(state.xpTotalHistoric),
    lastTickAt: state.lastTickAt,
    lastReturnAt: state.lastReturnAt,
  };
}

export function createInitialState(now = Date.now()): GameState {
  return {
    fragments: 0,
    xpTotalHistoric: d(0),
    lastTickAt: now,
    lastReturnAt: now,
    currentZoneId: 'calibracao',
    combatProgress: 0,
    characters: [
      { id: 'hero-c', name: 'Rookie C', level: 1, xpCurrent: d(0), rarity: 'C', teamSlot: 0 },
      { id: 'hero-sr', name: 'Elite SR', level: 1, xpCurrent: d(0), rarity: 'SR', teamSlot: 1 },
      { id: 'hero-ssr', name: 'Legend SSR', level: 1, xpCurrent: d(0), rarity: 'SSR', teamSlot: 2 },
    ],
  };
}

export function applyXpToCharacter(
  character: Character,
  gained: Decimal,
): { character: Character; levelsGained: number } {
  let xpCurrent = character.xpCurrent.plus(gained);
  let level = character.level;
  let levelsGained = 0;
  let iters = 0;
  while (iters < BALANCE.MAX_LEVEL_ITERS && xpCurrent.gte(xpToNextLevel(level).mul(1 - 1e-12))) {
    xpCurrent = xpCurrent.minus(xpToNextLevel(level));
    if (xpCurrent.lt(0)) xpCurrent = d(0);
    level += 1;
    levelsGained += 1;
    iters += 1;
  }
  return { character: { ...character, level, xpCurrent }, levelsGained };
}

function teamMembers(state: GameState): Character[] {
  return state.characters
    .filter((character) => character.teamSlot !== null)
    .sort((a, b) => (a.teamSlot ?? 9) - (b.teamSlot ?? 9));
}

export function slot0Level(state: GameState): number {
  return teamMembers(state).find((character) => character.teamSlot === 0)?.level ?? 1;
}

/** DPS de combate (raridade entra). */
export function partyCombatDps(state: GameState): Decimal {
  return teamMembers(state).reduce(
    (sum, character) => sum.plus(dps(character.level, state.fragments, character.rarity)),
    d(0),
  );
}

/**
 * DPS usado na curva de XP. Raridade não altera o ritmo de nível —
 * só o dano de combate (ttk / kills).
 */
export function partyXpDps(state: GameState): Decimal {
  return teamMembers(state).reduce(
    (sum, character) => sum.plus(dps(character.level, state.fragments, 'C')),
    d(0),
  );
}

export function xpRateFor(character: Character, state: GameState): Decimal {
  if (character.teamSlot === null) return d(0);
  const zone = zoneById(state.currentZoneId);
  const enemyLevel = enemyLevelFor(zone, slot0Level(state));
  const delta = enemyLevel - character.level;
  return partyXpDps(state)
    .mul(XP_PER_HP)
    .mul(difficultyMultiplier(delta))
    .mul(xpShare(character.teamSlot as TeamSlot));
}

function applyXpRates(state: GameState, seconds: number): Decimal {
  if (seconds <= 0) return d(0);
  let xpTotal = d(0);
  state.characters = state.characters.map((character) => {
    const gained = xpRateFor(character, state).mul(seconds);
    xpTotal = xpTotal.plus(gained);
    return applyXpToCharacter(character, gained).character;
  });
  state.xpTotalHistoric = state.xpTotalHistoric.plus(xpTotal);
  return xpTotal;
}

function secondsUntilTeamLevelUp(state: GameState): number {
  let soonest = Number.POSITIVE_INFINITY;
  for (const character of teamMembers(state)) {
    const rate = xpRateFor(character, state);
    if (rate.lte(0)) continue;
    const need = xpToNextLevel(character.level).minus(character.xpCurrent);
    if (need.lte(0)) return 0;
    const time = need.div(rate).toNumber();
    if (Number.isFinite(time) && time < soonest) soonest = time;
  }
  return soonest;
}

export function secondsToNextLevel(state: GameState, character: Character): number {
  const rate = xpRateFor(character, state);
  if (rate.lte(0)) return Number.POSITIVE_INFINITY;
  const need = xpToNextLevel(character.level).minus(character.xpCurrent);
  if (need.lte(0)) return 0;
  const time = need.div(rate).toNumber();
  return Number.isFinite(time) ? Math.max(0, time) : Number.POSITIVE_INFINITY;
}

export function combatTimeToKill(state: GameState): Decimal {
  const zone = zoneById(state.currentZoneId);
  return timeToKill(zone.enemyHp, partyCombatDps(state));
}

export function killsPerMinute(state: GameState): number {
  const ttk = combatTimeToKill(state).toNumber();
  if (!Number.isFinite(ttk) || ttk <= 0) return 0;
  return 60 / ttk;
}

/**
 * Catch-up por segmento de nível. XP = dt * dpsXp * XP_POR_HP * Δ * share
 * (HP se cancela). Kills em forma fechada só para o resumo.
 */
export function simulateElapsed(state: GameState, dtSeconds: number): { state: GameState; summary: ReturnSummary } {
  const dt = Math.min(BALANCE.MAX_DT_SECONDS, Math.max(0, dtSeconds));
  const next = cloneGameState(state);
  const fromLevels = new Map(next.characters.map((character) => [character.id, character.level]));
  let remaining = dt;
  let enemiesKilled = 0;
  let xpTotal = d(0);
  let iters = 0;

  while (remaining > 1e-12 && iters < BALANCE.MAX_LEVEL_ITERS) {
    iters += 1;
    const ttk = combatTimeToKill(next);
    const ttkNum = ttk.toNumber();
    const untilLevel = secondsUntilTeamLevelUp(next);
    const slice = Math.min(
      remaining,
      Number.isFinite(untilLevel) ? Math.max(untilLevel, 0) + 1e-9 : remaining,
    );
    if (slice <= 0) break;

    const resolved = Number.isFinite(ttkNum) && ttkNum > 0
      ? resolveKills(slice, ttk, next.combatProgress)
      : { kills: 0, leftoverProgress: next.combatProgress };
    const gained = applyXpRates(next, slice);
    next.combatProgress = resolved.leftoverProgress;
    remaining -= slice;
    enemiesKilled += resolved.kills;
    xpTotal = xpTotal.plus(gained);
  }

  const deltas: CharacterLevelDelta[] = next.characters
    .map((character) => {
      const fromLevel = fromLevels.get(character.id) ?? character.level;
      return {
        id: character.id,
        name: character.name,
        fromLevel,
        toLevel: character.level,
        levelsGained: character.level - fromLevel,
      };
    })
    .filter((row) => row.levelsGained > 0);

  return {
    state: next,
    summary: {
      absentSeconds: dt,
      xpTotal,
      enemiesKilled,
      characters: deltas,
    },
  };
}

export function tickState(state: GameState, now = Date.now()): { state: GameState; summary: ReturnSummary } {
  const rawDt = (now - state.lastTickAt) / 1000;
  const dt = Math.min(BALANCE.MAX_DT_SECONDS, Math.max(0, rawDt));
  const { state: next, summary } = simulateElapsed(state, dt);
  next.lastTickAt = now;
  if (dt > 2) next.lastReturnAt = now;
  return { state: next, summary };
}

export function setCurrentZone(state: GameState, zoneId: string): GameState {
  const next = cloneGameState(state);
  next.currentZoneId = zoneById(zoneId).id;
  next.combatProgress = 0;
  return next;
}
