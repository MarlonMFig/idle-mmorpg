'use client';

import { useEffect } from 'react';
import { getVillageName } from '@/data/villages';
import { useVitalsStore } from '@/hooks/use-vitals-store';
import { inventoryStore } from '@/stores/inventory-store';
import { questStore } from '@/stores/quest-store';
import { villageStore } from '@/stores/village-store';
import type { HudPlayerInfo } from '@/types/hud';
import { AttributesPanel } from '@/ui/attributes';
import { ChatPlaceholder } from '@/ui/hud/chat-placeholder';
import { MinimapPlaceholder } from '@/ui/hud/minimap-placeholder';
import { MultiplayerStatus } from '@/ui/hud/multiplayer-status';
import { ResourceBar } from '@/ui/hud/resource-bar';
import { InventoryPanel } from '@/ui/inventory';
import { QuestLog } from '@/ui/quests';
import { SkillHotbar } from '@/ui/skills';
import { VillagePanel } from '@/ui/villages';

export interface GameHudProps {
  player: HudPlayerInfo;
}

/**
 * HUD clássica de MMORPG em React — vitals via vitalsStore.
 * Personagem e jutsus são idle (sem controle de movimento/cast).
 */
export function GameHud({ player }: GameHudProps) {
  const vitals = useVitalsStore();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

      if (event.code === 'KeyI') {
        event.preventDefault();
        inventoryStore.toggleOpen();
        return;
      }

      if (event.code === 'KeyJ') {
        event.preventDefault();
        questStore.toggleOpen();
        return;
      }

      if (event.code === 'KeyV') {
        event.preventDefault();
        villageStore.toggleOpen();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="game-hud" aria-label="Interface do jogo">
      <div className="game-hud__vitals">
        <div className="game-hud__identity">
          <p className="game-hud__name">{player.nickname}</p>
          <p className="game-hud__meta">
            Nv. {vitals.level} · {getVillageName(player.villageId)}
          </p>
          <MultiplayerStatus />
        </div>
        <ResourceBar label="HP" value={vitals.hp} max={vitals.hpMax} variant="hp" />
        <ResourceBar label="XP" value={vitals.xp} max={vitals.xpMax} variant="xp" />
        <AttributesPanel />
      </div>

      <div className="game-hud__top-right">
        <MinimapPlaceholder />
        <VillagePanel />
        <QuestLog />
      </div>

      <div className="game-hud__bottom-center">
        <SkillHotbar />
      </div>

      <div className="game-hud__bottom-right">
        <InventoryPanel />
      </div>

      <div className="game-hud__bottom-left">
        <ChatPlaceholder />
      </div>
    </div>
  );
}
