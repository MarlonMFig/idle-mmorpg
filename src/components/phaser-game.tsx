'use client';

import { useEffect, useRef } from 'react';
import type { Game } from 'phaser';
import type { PlayerCreation } from '@/types/player-creation';

export interface PhaserGameProps {
  player: PlayerCreation;
}

/**
 * Host React do canvas Phaser. Import dinâmico evita SSR.
 * Injeta sessão do jogador no registry para o sync multiplayer.
 */
export function PhaserGame({ player }: PhaserGameProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Game | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || gameRef.current) return;

    let cancelled = false;

    void import('@/game/create-game').then(({ createGame }) => {
      if (cancelled || !hostRef.current || gameRef.current) return;
      gameRef.current = createGame(hostRef.current, {
        playerId: `player-${player.nickname.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
        nickname: player.nickname,
        villageId: player.villageId,
        starterCharacterId: player.starterCharacterId,
      });
    });

    return () => {
      cancelled = true;
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, [player]);

  return <div ref={hostRef} className="phaser-host" aria-label="Área do jogo" />;
}
