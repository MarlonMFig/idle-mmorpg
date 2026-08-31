'use client';

import { useEffect } from 'react';
import { isDevMode } from '@/config/devConfig';
import { useStore } from '@/hooks/use-store';
import { locationStore } from '@/stores/location-store';
import { isTypingInField } from '@/utils/dom-focus';
import type { HudPlayerInfo } from '@/types/hud';
import { characterLabStore } from '@/stores/character-lab-store';
import { ForgePanel } from '@/ui/forge';
import { ChatPlaceholder } from '@/ui/hud/chat-placeholder';
import { HubTopMenu } from '@/ui/hud/hub-top-menu';
import { InventoryPanel } from '@/ui/inventory';
import { TeamCombatStrip, TeamPanel, toggleTeamManager } from '@/ui/team';
import { SkillHotbar } from '@/ui/skills';
import { ShopPanel } from '@/ui/shop';
import { LineagePanel } from '@/ui/lineages';
import { GuildPanel } from '@/ui/guild';
import { HuntAnalyzerPanel } from '@/ui/hunt-analyzer';
import { HelperPanel } from '@/ui/helper';
import { MedicPanel } from '@/ui/medic';
import { CapturaPanel } from '@/ui/captura';
import { VipPanel } from '@/ui/vip';
import { PremiumShopPanel } from '@/ui/premium';
import { DevModeBadge } from '@/ui/hud/dev-mode-badge';
import { CharacterTestLabPanel } from '@/ui/dev';
import { AchievementsPanel, AchievementToastHost } from '@/ui/achievements';
import { MissionsPanel } from '@/ui/missions';
import { DailyLoginPanel } from '@/ui/daily-login';
import { BossesPanel, BossCombatHud, BossResultOverlay } from '@/ui/bosses';
import { RankingPanel } from '@/ui/ranking';
import { bindRankingListeners } from '@/lib/ranking-listeners';
import { OfflineDevSimulator, OfflineReturnModal } from '@/ui/offline';
import { bindAchievementListeners } from '@/lib/achievement-listeners';
import { bindMissionListeners } from '@/lib/mission-listeners';
import { achievementsStore } from '@/stores/achievements-store';
import { dailyLoginStore } from '@/stores/daily-login-store';
import { LogoutButton } from '@/components/auth/logout-button';

export interface GameHudProps {
  player: HudPlayerInfo;
}

/**
 * HUD: menu superior + janela de equipe ativa no hub e na caça.
 */
export function GameHud({ player }: GameHudProps) {
  const mode = useStore(locationStore, (s) => s.mode);

  useEffect(() => {
    const unbindAchievements = bindAchievementListeners();
    const unbindMissions = bindMissionListeners();
    const unbindRanking = bindRankingListeners();
    achievementsStore.evaluateAllRetroactive();
    return () => {
      unbindAchievements();
      unbindMissions();
      unbindRanking();
    };
  }, []);

  useEffect(() => {
    if (mode !== 'hub') return;
    if (dailyLoginStore.getSnapshot().promptedThisSession) return;
    if (!dailyLoginStore.isAvailable()) {
      dailyLoginStore.markPromptedThisSession();
      return;
    }
    dailyLoginStore.setOpen(true);
    dailyLoginStore.markPromptedThisSession();
  }, [mode]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingInField(event.target)) return;

      if (event.code === 'KeyE') {
        event.preventDefault();
        toggleTeamManager();
        return;
      }

      if (event.code === 'F8' && isDevMode()) {
        event.preventDefault();
        characterLabStore.toggle();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className={`game-hud game-hud--${mode}`} aria-label="Interface do jogo">
      <HubTopMenu />
      <LogoutButton />

      <div className="game-hud__team game-hud__team--strip">
        <TeamCombatStrip nickname={player.nickname} />
      </div>

      <TeamPanel variant="modal" />
      <LineagePanel />
      <GuildPanel />
      <AchievementsPanel />
      <MissionsPanel />
      <DailyLoginPanel />
      <BossesPanel />
      <BossCombatHud />
      <BossResultOverlay />
      <RankingPanel />
      <AchievementToastHost />
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
      <DevModeBadge />
      <OfflineDevSimulator />
      <OfflineReturnModal />
      <CharacterTestLabPanel />
    </div>
  );
}
