import { d } from './decimal';
import { createInitialState } from './progression';
import type { Character, GameState, TeamSlot } from './types';

export const SAVE_KEY = 'anime-idle-world-v2';

type SavedCharacter = Omit<Character, 'xpCurrent'> & { xpCurrent: string };
type SavedState = Omit<GameState, 'characters' | 'xpTotalHistoric'> & {
  characters: SavedCharacter[];
  xpTotalHistoric: string;
};

function asSlot(value: unknown): TeamSlot | null {
  return value === 0 || value === 1 || value === 2 ? value : null;
}

export function serializeState(state: GameState): string {
  const payload: SavedState = {
    ...state,
    xpTotalHistoric: state.xpTotalHistoric.toString(),
    characters: state.characters.map((character) => ({
      ...character,
      xpCurrent: character.xpCurrent.toString(),
    })),
  };
  return JSON.stringify(payload);
}

export function deserializeState(raw: string): GameState {
  const parsed = JSON.parse(raw) as SavedState;
  return {
    fragments: Number(parsed.fragments) || 0,
    lastTickAt: Number(parsed.lastTickAt) || Date.now(),
    lastReturnAt: Number(parsed.lastReturnAt) || Date.now(),
    currentZoneId: typeof parsed.currentZoneId === 'string' ? parsed.currentZoneId : 'calibracao',
    combatProgress: Number(parsed.combatProgress) || 0,
    xpTotalHistoric: d(parsed.xpTotalHistoric ?? 0),
    characters: (parsed.characters ?? []).map((character) => ({
      ...character,
      level: Math.max(1, Number(character.level) || 1),
      xpCurrent: d(character.xpCurrent ?? 0),
      teamSlot: asSlot(character.teamSlot),
    })),
  };
}

export function loadState(): GameState {
  if (typeof window === 'undefined') return createInitialState();
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return createInitialState();
    const state = deserializeState(raw);
    if (!state.characters.length) return createInitialState();
    return state;
  } catch {
    return createInitialState();
  }
}

export function saveState(state: GameState): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SAVE_KEY, serializeState(state));
}
