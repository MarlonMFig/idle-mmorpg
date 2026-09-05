'use client';

import { useEffect, useRef } from 'react';
import type { Game } from 'phaser';
import { resolveCanvasSize } from '@/game/canvas-size';
import { bootLoadingStore } from '@/stores/boot-loading-store';
import type { PlayerCreation } from '@/types/player-creation';

export interface PhaserGameProps {
  player: PlayerCreation;
}

const PHASER_GAME_KEY = '__idleMmorpgPhaserGame';
const PHASER_SESSION_KEY = '__idleMmorpgPhaserSession';

type PhaserGlobal = {
  [PHASER_GAME_KEY]?: Game;
  [PHASER_SESSION_KEY]?: string;
};

function sessionKey(player: PlayerCreation): string {
  return `${player.nickname}|${player.villageId}|${player.starterCharacterId}`;
}

function isGameAlive(game: Game | undefined): game is Game {
  return Boolean(game && game.isRunning && game.canvas);
}

/** Aguarda o host ter layout antes de criar/redimensionar o canvas WebGL. */
function waitForHostLayout(host: HTMLElement): Promise<void> {
  const ready = () => host.clientWidth >= 2 && host.clientHeight >= 2;
  if (ready()) return Promise.resolve();

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      ro.disconnect();
      resolve();
    };

    const ro = new ResizeObserver(() => {
      if (ready()) finish();
    });
    ro.observe(host);
    requestAnimationFrame(() => {
      if (ready()) finish();
    });
    window.setTimeout(finish, 500);
  });
}

function syncCanvasSize(game: Game, host: HTMLElement): void {
  const { width, height } = resolveCanvasSize(host);
  if (game.scale.width === width && game.scale.height === height) return;
  game.scale.resize(width, height);
}

function attachCanvas(game: Game, host: HTMLDivElement): void {
  const canvas = game.canvas;
  if (canvas && canvas.parentElement !== host) host.appendChild(canvas);
  syncCanvasSize(game, host);
}

/**
 * Host React do canvas Phaser. Import dinâmico evita SSR.
 * Em DEV o Game fica no globalThis para o Fast Refresh não destruir a sessão.
 */
export function PhaserGame({ player }: PhaserGameProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mountGenRef = useRef(0);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const mountGen = ++mountGenRef.current;
    let cancelled = false;
    const g = globalThis as PhaserGlobal;
    const key = sessionKey(player);

    async function bootstrap(): Promise<void> {
      const existing = g[PHASER_GAME_KEY];
      if (isGameAlive(existing) && g[PHASER_SESSION_KEY] === key) {
        await waitForHostLayout(host);
        if (cancelled || mountGen !== mountGenRef.current || !hostRef.current) return;
        attachCanvas(existing, hostRef.current);
        // Fast Refresh / remount: se o mundo já existe, não prender o overlay.
        if (existing.registry.get('worldReady') || bootLoadingStore.getSnapshot().ready) {
          bootLoadingStore.setReady(true);
        }
        return;
      }

      if (existing) {
        existing.destroy(true);
        g[PHASER_GAME_KEY] = undefined;
      }

      bootLoadingStore.reset();

      await waitForHostLayout(host);
      if (cancelled || mountGen !== mountGenRef.current || !hostRef.current) return;

      hostRef.current.querySelectorAll('canvas').forEach((node) => node.remove());

      const { createGame } = await import('@/game/create-game');
      if (cancelled || mountGen !== mountGenRef.current || !hostRef.current) return;

      g[PHASER_SESSION_KEY] = key;
      const game = createGame(hostRef.current, {
        playerId: `player-${player.nickname.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
        nickname: player.nickname,
        villageId: player.villageId,
        starterCharacterId: player.starterCharacterId,
      });
      g[PHASER_GAME_KEY] = game;

      if (cancelled || mountGen !== mountGenRef.current || !hostRef.current) return;
      attachCanvas(game, hostRef.current);
    }

    void bootstrap().catch((error) => {
      console.error('[PhaserGame] falha ao iniciar', error);
    });

    return () => {
      cancelled = true;
    };
  }, [player.nickname, player.villageId, player.starterCharacterId]);

  return <div ref={hostRef} className="phaser-host" aria-label="Área do jogo" />;
}
