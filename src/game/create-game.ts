import * as Phaser from 'phaser';
import { createGameConfig } from '@/game/config';
import { setPlayerSession } from '@/game/registry';
import type { PlayerSession } from '@/types/player-session';

/** Instancia o Phaser apenas no browser (sem SSR). */
export function createGame(parent: HTMLElement, session: PlayerSession): Phaser.Game {
  const game = new Phaser.Game(createGameConfig(parent));
  setPlayerSession(game.registry, session);
  return game;
}
