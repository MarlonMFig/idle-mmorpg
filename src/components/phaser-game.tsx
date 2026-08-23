'use client';

import { useEffect, useRef } from 'react';
import type { Game } from 'phaser';
import type { PlayerCreation } from '@/types/player-creation';

export interface PhaserGameProps {
  player: PlayerCreation;
}

const PHASER_GAME_KEY = '__idleMmorpgPhaserGame';
const PHASER_SESSION_KEY = '__idleMmorpgPhaserSession';
const PHASER_CREATING_KEY = '__idleMmorpgPhaserCreating';

type PhaserGlobal = {
  [PHASER_GAME_KEY]?: Game;
  [PHASER_SESSION_KEY]?: string;
  [PHASER_CREATING_KEY]?: Promise<Game | null>;
};

function sessionKey(player: PlayerCreation): string {
  return `${player.nickname}|${player.villageId}|${player.starterCharacterId}`;
}

function isGameAlive(game: Game | undefined): game is Game {
  return Boolean(game && game.isRunning && game.canvas);
}

function attachCanvas(game: Game, host: HTMLDivElement): void {
  const canvas = game.canvas;
  if (canvas && canvas.parentElement !== host) host.appendChild(canvas);
}

/**
 * Host React do canvas Phaser. Import dinâmico evita SSR.
 * Em DEV o Game fica no globalThis para o Fast Refresh não destruir a sessão.
 */
export function PhaserGame({ player }: PhaserGameProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const g = globalThis as PhaserGlobal;
    const key = sessionKey(player);

    const existing = g[PHASER_GAME_KEY];
    if (isGameAlive(existing) && g[PHASER_SESSION_KEY] === key) {
      attachCanvas(existing, host);
      return;
    }

    if (existing && g[PHASER_SESSION_KEY] !== key) {
      existing.destroy(true);
      g[PHASER_GAME_KEY] = undefined;
    }

    if (!g[PHASER_CREATING_KEY]) {
      g[PHASER_SESSION_KEY] = key;
      g[PHASER_CREATING_KEY] = import('@/game/create-game')
        .then(({ createGame }) => {
          const live = g[PHASER_GAME_KEY];
          if (isGameAlive(live) && g[PHASER_SESSION_KEY] === key) return live;
          const parent = hostRef.current;
          if (!parent) return null;
          parent.querySelectorAll('canvas').forEach((node) => node.remove());
          const game = createGame(parent, {
            playerId: `player-${player.nickname.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
            nickname: player.nickname,
            villageId: player.villageId,
            starterCharacterId: player.starterCharacterId,
          });
          g[PHASER_GAME_KEY] = game;
          return game;
        })
        .finally(() => {
          g[PHASER_CREATING_KEY] = undefined;
        });
    }

    void g[PHASER_CREATING_KEY]?.then((game) => {
      if (game && hostRef.current) attachCanvas(game, hostRef.current);
    });
  }, [player.nickname, player.villageId, player.starterCharacterId]);

  return <div ref={hostRef} className="phaser-host" aria-label="Área do jogo" />;
}
