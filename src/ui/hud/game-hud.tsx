'use client';

import { useEffect } from 'react';
import { useStore } from '@/hooks/use-store';
import { inventoryStore } from '@/stores/inventory-store';
import { locationStore } from '@/stores/location-store';
import { questStore } from '@/stores/quest-store';
import { shopStore } from '@/stores/shop-store';
import { villageStore } from '@/stores/village-store';
import type { HudPlayerInfo } from '@/types/hud';
import { ChatPlaceholder } from '@/ui/hud/chat-placeholder';
import { HubTopMenu } from '@/ui/hud/hub-top-menu';
import { InventoryPanel } from '@/ui/inventory';
import { TeamCombatStrip, TeamPanel, toggleTeamManager } from '@/ui/team';
import { QuestLog } from '@/ui/quests';
import { SkillHotbar } from '@/ui/skills';
import { ShopPanel, ShopLauncher } from '@/ui/shop';
import { VillagePanel } from '@/ui/villages';
import { ClanPanel } from '@/ui/clans';
import { GuildPanel } from '@/ui/guild';
import { HuntAnalyzerPanel } from '@/ui/hunt-analyzer';
import { HelperPanel } from '@/ui/helper';

export interface GameHudProps {
  player: HudPlayerInfo;
}

/**
 * HUD: menu superior + janela de equipe ativa no hub e na caça.
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
        toggleTeamManager();
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

      <div className="game-hud__team game-hud__team--strip">
        <TeamCombatStrip nickname={player.nickname} />
      </div>

      {mode === 'combat' ? (
        <div className="game-hud__combat-panels">
          <VillagePanel />
          <QuestLog />
        </div>
      ) : (
        <div className="game-hud__top-right">
          <ShopLauncher />
          <VillagePanel />
          <QuestLog />
        </div>
      )}

      <TeamPanel variant="modal" />
      <ClanPanel />
      <GuildPanel />
      <ShopPanel />
      <HuntAnalyzerPanel />
      <HelperPanel />

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
