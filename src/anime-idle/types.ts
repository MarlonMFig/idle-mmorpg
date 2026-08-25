import type { Decimal } from './decimal';
import type { Rarity } from './balance';

export type { Rarity };

export type TeamSlot = 0 | 1 | 2;

export type Character = {
  id: string;
  name: string;
  level: number;
  xpCurrent: Decimal;
  rarity: Rarity;
  teamSlot: TeamSlot | null;
};

export type Zone = {
  id: string;
  name: string;
  enemyName: string;
  /** Nível do inimigo = nível do slot 0 + este offset (mínimo 1). */
  levelOffset: number;
  enemyHp: Decimal;
};

export type GameState = {
  characters: Character[];
  currentZoneId: string;
  combatProgress: number;
  fragments: number;
  xpTotalHistoric: Decimal;
  lastTickAt: number;
  lastReturnAt: number;
};

export type CharacterLevelDelta = {
  id: string;
  name: string;
  fromLevel: number;
  toLevel: number;
  levelsGained: number;
};

export type ReturnSummary = {
  absentSeconds: number;
  xpTotal: Decimal;
  enemiesKilled: number;
  characters: CharacterLevelDelta[];
};
