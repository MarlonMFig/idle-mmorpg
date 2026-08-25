import { d } from './decimal';
import { possibleFragments } from './formulas';
import { cloneGameState } from './progression';
import type { GameState } from './types';

export function shownFragments(state: GameState): number {
  return Math.max(0, possibleFragments(state.xpTotalHistoric) - state.fragments);
}

export function canPrestige(state: GameState): boolean {
  return shownFragments(state) > 0;
}

export function predictedPrestigeGain(state: GameState): number {
  return shownFragments(state);
}

export function executePrestige(state: GameState, now = Date.now()): GameState {
  if (!canPrestige(state)) return cloneGameState(state);
  const next = cloneGameState(state);
  next.fragments += shownFragments(next);
  next.characters = next.characters.map((character) => ({
    ...character,
    level: 1,
    xpCurrent: d(0),
  }));
  next.combatProgress = 0;
  next.lastTickAt = now;
  next.lastReturnAt = now;
  return next;
}
