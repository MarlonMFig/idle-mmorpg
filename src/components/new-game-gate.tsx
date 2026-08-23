'use client';

import { useEffect, useState } from 'react';
import { PhaserGame } from '@/components/phaser-game';
import { NewGameScreen } from '@/ui/new-game';
import { GameHud } from '@/ui/hud';
import { DialogueWindow } from '@/ui/dialogue';
import { accountStore } from '@/stores/account-store';
import { achievementsStore } from '@/stores/achievements-store';
import { missionsStore } from '@/stores/missions-store';
import { dailyLoginStore } from '@/stores/daily-login-store';
import { bossStore } from '@/stores/boss-store';
import { guildStore } from '@/stores/guild-store';
import { villageStore } from '@/stores/village-store';
import { locationStore } from '@/stores/location-store';
import { huntStore } from '@/stores/hunt-store';
import { inventoryStore } from '@/stores/inventory-store';
import { shopStore } from '@/stores/shop-store';
import { skillsStore } from '@/stores/skills-store';
import { teamStore } from '@/stores/team-store';
import { teamPresetStore } from '@/stores/team-preset-store';
import { systemLogStore } from '@/lib/system-log';
import {
  applyPersistedSession,
  loadPersistedSession,
  trackSession,
  wipeAllLocalPlayerAccounts,
} from '@/lib/session-persist';
import type { PlayerCreation } from '@/types/player-creation';
import { HuntSelector } from '@/ui/hunts';

export function NewGameGate() {
  const [playerCreation, setPlayerCreation] = useState<PlayerCreation | null>(null);
  const [bootstrapped, setBootstrapped] = useState(false);

  // Restore last session from localStorage (`idle-mmorpg:session-v1`) on first paint.
  useEffect(() => {
    wipeAllLocalPlayerAccounts();
    const saved = loadPersistedSession();
    if (saved) {
      try {
        setPlayerCreation(applyPersistedSession(saved));
      } catch {
        // Corrupt / incomplete hydrate — fall through to new-game screen.
      }
    }
    setBootstrapped(true);
  }, []);

  function handleCreatePlayer(player: PlayerCreation): void {
    locationStore.reset();
    huntStore.reset();
    villageStore.reset();
    accountStore.reset();
    achievementsStore.reset();
    missionsStore.reset();
    dailyLoginStore.reset();
    bossStore.reset();
    void guildStore.devResetGuildData();
    guildStore.reset();
    inventoryStore.reset();
    skillsStore.reset(player.starterCharacterId);
    teamStore.reset(player.starterCharacterId);
    teamPresetStore.reset(teamStore.getSnapshot().teamIds);
    shopStore.reset();
    systemLogStore.reset();
    villageStore.joinVillage(player.villageId, player.nickname);
    trackSession(player);
    setPlayerCreation(player);
  }

  if (!bootstrapped) {
    return <div className="new-game-shell" aria-busy="true" />;
  }

  if (playerCreation) {
    return (
      <div className="game-shell">
        <PhaserGame player={playerCreation} />
        <GameHud
          player={{
            nickname: playerCreation.nickname,
            villageId: playerCreation.villageId,
            starterCharacterId: playerCreation.starterCharacterId,
          }}
        />
        <DialogueWindow />
        <HuntSelector />
      </div>
    );
  }

  return (
    <div className="new-game-shell">
      <NewGameScreen onCreatePlayer={handleCreatePlayer} />
    </div>
  );
}
