'use client';

import { useState } from 'react';
import { PhaserGame } from '@/components/phaser-game';
import { NewGameScreen } from '@/ui/new-game';
import { GameHud } from '@/ui/hud';
import { DialogueWindow } from '@/ui/dialogue';
import { villageStore } from '@/stores/village-store';
import type { PlayerCreation } from '@/types/player-creation';

export function NewGameGate() {
  const [playerCreation, setPlayerCreation] = useState<PlayerCreation | null>(null);

  function handleCreatePlayer(player: PlayerCreation): void {
    villageStore.reset();
    villageStore.joinVillage(player.villageId, player.nickname);
    setPlayerCreation(player);
  }

  if (playerCreation) {
    return (
      <div className="game-shell">
        <PhaserGame player={playerCreation} />
        <GameHud
          player={{
            nickname: playerCreation.nickname,
            villageId: playerCreation.villageId,
          }}
        />
        <DialogueWindow />
      </div>
    );
  }

  return (
    <div className="new-game-shell">
      <NewGameScreen onCreatePlayer={handleCreatePlayer} />
    </div>
  );
}
