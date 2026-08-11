'use client';

import { useEffect } from 'react';
import { useStore } from '@/hooks/use-store';
import { inventoryStore } from '@/stores/inventory-store';
import { locationStore } from '@/stores/location-store';
import { questStore } from '@/stores/quest-store';
import { shopStore } from '@/stores/shop-store';
import { teamStore } from '@/stores/team-store';
import { villageStore } from '@/stores/village-store';
import type { HudPlayerInfo } from '@/types/hud';
import { ChatPlaceholder } from '@/ui/hud/chat-placeholder';
import { HubTopMenu } from '@/ui/hud/hub-top-menu';
import { InventoryPanel } from '@/ui/inventory';
import { TeamCombatStrip, TeamPanel } from '@/ui/team';
import { QuestLog } from '@/ui/quests';
import { SkillHotbar } from '@/ui/skills';
import { ShopPanel } from '@/ui/shop';
import { VillagePanel } from '@/ui/villages';
import { ClanPanel } from '@/ui/clans';
import { HuntAnalyzerPanel } from '@/ui/hunt-analyzer';

export interface GameHudProps {
  player: HudPlayerInfo;
}

/**
 * HUD: menu superior no hub e na caça; strip de equipe na caça.
 */
export function GameHud({ player }: GameHudProps) {
  const mode = useStore(locationStore, (s) => s.mode);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

      if (event.code === 'KeyI') {
        event.preventDefault();
        inventoryStore.toggleOpen();
        return;
      }

      if (event.code === 'KeyE') {
        event.preventDefault();
        teamStore.toggleOpen();
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
        return;
      }

      if (event.code === 'KeyP') {
        event.preventDefault();
        shopStore.toggleOpen();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className={`game-hud game-hud--${mode}`} aria-label="Interface do jogo">
      <HubTopMenu />

      {mode === 'combat' ? (
        <>
          <div className="game-hud__team game-hud__team--strip">
            <TeamCombatStrip nickname={player.nickname} />
          </div>
          <div className="game-hud__combat-panels">
            <VillagePanel />
            <QuestLog />
          </div>
          <TeamPanel variant="modal" />
        </>
      ) : (
        <>
          <div className="game-hud__top-right">
            <ShopPanel />
            <VillagePanel />
            <QuestLog />
          </div>
          <TeamPanel variant="modal" />
        </>
      )}

      <ClanPanel />
      <HuntAnalyzerPanel />

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
