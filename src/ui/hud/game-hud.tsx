'use client';

import { useEffect } from 'react';
import { useStore } from '@/hooks/use-store';
import { locationStore } from '@/stores/location-store';
import type { HudPlayerInfo } from '@/types/hud';
import { ForgePanel } from '@/ui/forge';
import { ChatPlaceholder } from '@/ui/hud/chat-placeholder';
import { HubTopMenu } from '@/ui/hud/hub-top-menu';
import { InventoryPanel } from '@/ui/inventory';
import { TeamCombatStrip, TeamPanel, toggleTeamManager } from '@/ui/team';
import { SkillHotbar } from '@/ui/skills';
import { ShopPanel } from '@/ui/shop';
import { ClanPanel } from '@/ui/clans';
import { GuildPanel } from '@/ui/guild';
import { HuntAnalyzerPanel } from '@/ui/hunt-analyzer';
import { HelperPanel } from '@/ui/helper';
import { MedicPanel } from '@/ui/medic';
import { CapturaPanel } from '@/ui/captura';
import { VipPanel } from '@/ui/vip';
import { PremiumShopPanel } from '@/ui/premium';

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

      if (event.code === 'KeyE') {
        event.preventDefault();
        toggleTeamManager();
        return;
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

      <TeamPanel variant="modal" />
      <ClanPanel />
      <GuildPanel />
      <ShopPanel />
      <ForgePanel />
      <InventoryPanel />
      <HuntAnalyzerPanel />
      <HelperPanel />
      <MedicPanel />
      <CapturaPanel />
      <VipPanel />
      <PremiumShopPanel />

      <div className="game-hud__bottom-center">
        <SkillHotbar />
      </div>

      <div className="game-hud__bottom-left">
        <ChatPlaceholder />
      </div>
    </div>
  );
}
