import React, { useState } from 'react';
import { GuildHeader } from './GuildHeader';
import { MembersTab } from './MembersTab';
import { RankingTab } from './RankingTab';
import { MissionsTab } from './MissionsTab';
import { BossTab } from './BossTab';
import { PerksTab } from './PerksTab';
import { ShopTab } from './ShopTab';
import { ManagementTab } from './ManagementTab';
import { GuildInfo, GuildMember, GuildRankEntry, GuildMission, GuildBoss, GuildSkill, GuildShopItem, JoinRequest, GuildRole } from '../../types';
import { Shield, Users, Trophy, Scroll, Swords, Zap, ShoppingBag, Settings, X, Maximize2, Minimize2, Volume2, VolumeX, RefreshCw } from 'lucide-react';
import { sounds } from '../../utils/audio';

export type GuildTabType = 'MEMBERS' | 'RANKING' | 'MISSIONS' | 'BOSS' | 'PERKS' | 'SHOP' | 'MANAGEMENT';

interface GuildWindowProps {
  isOpen: boolean;
  onClose: () => void;
  guildInfo: GuildInfo;
  members: GuildMember[];
  serverGuilds: GuildRankEntry[];
  missions: GuildMission[];
  boss: GuildBoss;
  skills: GuildSkill[];
  shopItems: GuildShopItem[];
  joinRequests: JoinRequest[];
  currentUserName: string;
  currentUserRole: GuildRole;
  userGuildCoins: number;
  isCheckedIn: boolean;

  // Handlers
  onCheckIn: () => void;
  onPromoteMember: (memberId: string) => void;
  onDemoteMember: (memberId: string) => void;
  onKickMember: (memberId: string) => void;
  onDonateToGuild: (amount: number) => void;
  onInviteMember: (name: string) => void;
  onClaimMissionReward: (missionId: string) => void;
  onClaimAllMissionRewards: () => void;
  onSimulateMissionProgress: (missionId: string) => void;
  onAttackBoss: (damage: number) => void;
  onUpgradeSkill: (skillId: string) => void;
  onBuyShopItem: (itemId: string, price: number) => void;
  onUpdateNotice: (notice: string) => void;
  onUpdateEmblem: (icon: string, bg: string) => void;
  onApproveRequest: (requestId: string) => void;
  onRejectRequest: (requestId: string) => void;
  onLeaveGuild: () => void;
  onResetData: () => void;
}

export const GuildWindow: React.FC<GuildWindowProps> = ({
  isOpen,
  onClose,
  guildInfo,
  members,
  serverGuilds,
  missions,
  boss,
  skills,
  shopItems,
  joinRequests,
  currentUserName,
  currentUserRole,
  userGuildCoins,
  isCheckedIn,
  onCheckIn,
  onPromoteMember,
  onDemoteMember,
  onKickMember,
  onDonateToGuild,
  onInviteMember,
  onClaimMissionReward,
  onClaimAllMissionRewards,
  onSimulateMissionProgress,
  onAttackBoss,
  onUpgradeSkill,
  onBuyShopItem,
  onUpdateNotice,
  onUpdateEmblem,
  onApproveRequest,
  onRejectRequest,
  onLeaveGuild,
  onResetData,
}) => {
  const [activeTab, setActiveTab] = useState<GuildTabType>('MEMBERS');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  if (!isOpen) return null;

  const handleToggleSound = () => {
    const newState = sounds.toggleSound();
    setSoundEnabled(newState);
  };

  const unclaimedMissionsCount = missions.filter((m) => m.isCompleted && !m.isClaimed).length;

  return (
    <div className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      {/* Main Guild Window Container */}
      <div
        className={`bg-[#0f1511] border-2 border-[#e5a93c] rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.9)] text-white overflow-hidden flex flex-col transition-all duration-200 ${
          isFullScreen
            ? 'w-full h-full max-w-none rounded-none'
            : 'w-full max-w-5xl max-h-[92vh]'
        }`}
      >
        {/* WINDOW TITLEBAR */}
        <div className="bg-gradient-to-r from-[#121914] via-[#1a241d] to-[#121914] border-b border-[#2b3a2e] px-4 py-2.5 flex items-center justify-between">
          
          <div className="flex items-center gap-2">
            <span className="text-xl">🚩</span>
            <h1 className="text-sm md:text-base font-bold game-title-font text-amber-400 tracking-wider">
              Anime World Idle — Janela da Guilda
            </h1>
            <span className="bg-amber-950/80 border border-amber-700 text-amber-200 text-[10px] font-bold px-2 py-0.5 rounded">
              v1.2.0
            </span>
          </div>

          {/* Window Control Buttons */}
          <div className="flex items-center gap-1.5">
            {/* Sound Mute Toggle */}
            <button
              onClick={handleToggleSound}
              className="p-1.5 bg-[#18231c] hover:bg-gray-800 rounded-lg text-gray-300 hover:text-white transition"
              title={soundEnabled ? 'Mutar Efeitos Sonoros' : 'Ativar Efeitos Sonoros'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-gray-500" />}
            </button>

            {/* Reset Demo Data Button */}
            <button
              onClick={() => {
                sounds.playClick();
                if (confirm('Deseja restaurar todos os dados de demonstração da guilda?')) {
                  onResetData();
                }
              }}
              className="p-1.5 bg-[#18231c] hover:bg-gray-800 rounded-lg text-gray-300 hover:text-white transition"
              title="Restaurar Dados de Exemplo"
            >
              <RefreshCw className="w-4 h-4 text-amber-400" />
            </button>

            {/* Maximize / Fullscreen Toggle */}
            <button
              onClick={() => {
                sounds.playClick();
                setIsFullScreen(!isFullScreen);
              }}
              className="p-1.5 bg-[#18231c] hover:bg-gray-800 rounded-lg text-gray-300 hover:text-white transition"
              title={isFullScreen ? 'Restaurar Janela' : 'Maximizar'}
            >
              {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Close Button */}
            <button
              onClick={() => {
                sounds.playClick();
                onClose();
              }}
              className="p-1.5 bg-red-950/80 hover:bg-red-800 border border-red-800 rounded-lg text-red-200 transition ml-1"
              title="Fechar Janela (Voltar ao Jogo)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

        </div>

        {/* GUILD HEADER (CREST, LEVEL, CHECK-IN, CURRENCY) */}
        <GuildHeader
          guildInfo={guildInfo}
          onCheckIn={onCheckIn}
          isCheckedIn={isCheckedIn}
          onOpenManagement={() => setActiveTab('MANAGEMENT')}
          userRole={currentUserRole}
        />

        {/* GUILD MAIN TABS NAVIGATION */}
        <div className="bg-[#121914] border-b border-[#28382d] px-2 flex items-center gap-1 overflow-x-auto select-none">
          {/* 1. Membros */}
          <button
            onClick={() => {
              sounds.playTabSwitch();
              setActiveTab('MEMBERS');
            }}
            className={`px-4 py-2.5 text-xs font-bold transition flex items-center gap-1.5 border-b-2 whitespace-nowrap ${
              activeTab === 'MEMBERS'
                ? 'border-amber-400 text-amber-400 bg-amber-950/30'
                : 'border-transparent text-gray-400 hover:text-white hover:bg-[#19231c]'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Membros ({members.length})</span>
          </button>

          {/* 2. Ranking */}
          <button
            onClick={() => {
              sounds.playTabSwitch();
              setActiveTab('RANKING');
            }}
            className={`px-4 py-2.5 text-xs font-bold transition flex items-center gap-1.5 border-b-2 whitespace-nowrap ${
              activeTab === 'RANKING'
                ? 'border-amber-400 text-amber-400 bg-amber-950/30'
                : 'border-transparent text-gray-400 hover:text-white hover:bg-[#19231c]'
            }`}
          >
            <Trophy className="w-4 h-4" />
            <span>Ranking</span>
          </button>

          {/* 3. Missões Diárias (Replaces Guild Chat) */}
          <button
            onClick={() => {
              sounds.playTabSwitch();
              setActiveTab('MISSIONS');
            }}
            className={`px-4 py-2.5 text-xs font-bold transition flex items-center gap-1.5 border-b-2 whitespace-nowrap relative ${
              activeTab === 'MISSIONS'
                ? 'border-amber-400 text-amber-400 bg-amber-950/30'
                : 'border-transparent text-gray-400 hover:text-white hover:bg-[#19231c]'
            }`}
          >
            <Scroll className="w-4 h-4 text-amber-300" />
            <span>Missões Diárias</span>
            {unclaimedMissionsCount > 0 && (
              <span className="bg-amber-500 text-black text-[9px] font-bold px-1.5 rounded-full animate-bounce">
                {unclaimedMissionsCount}
              </span>
            )}
          </button>

          {/* 4. Boss */}
          <button
            onClick={() => {
              sounds.playTabSwitch();
              setActiveTab('BOSS');
            }}
            className={`px-4 py-2.5 text-xs font-bold transition flex items-center gap-1.5 border-b-2 whitespace-nowrap ${
              activeTab === 'BOSS'
                ? 'border-amber-400 text-amber-400 bg-amber-950/30'
                : 'border-transparent text-gray-400 hover:text-white hover:bg-[#19231c]'
            }`}
          >
            <Swords className="w-4 h-4 text-red-400" />
            <span>Boss da Guilda</span>
          </button>

          {/* 5. Habilidades */}
          <button
            onClick={() => {
              sounds.playTabSwitch();
              setActiveTab('PERKS');
            }}
            className={`px-4 py-2.5 text-xs font-bold transition flex items-center gap-1.5 border-b-2 whitespace-nowrap ${
              activeTab === 'PERKS'
                ? 'border-amber-400 text-amber-400 bg-amber-950/30'
                : 'border-transparent text-gray-400 hover:text-white hover:bg-[#19231c]'
            }`}
          >
            <Zap className="w-4 h-4 text-amber-300" />
            <span>Habilidades Passivas</span>
          </button>

          {/* 6. Loja */}
          <button
            onClick={() => {
              sounds.playTabSwitch();
              setActiveTab('SHOP');
            }}
            className={`px-4 py-2.5 text-xs font-bold transition flex items-center gap-1.5 border-b-2 whitespace-nowrap ${
              activeTab === 'SHOP'
                ? 'border-amber-400 text-amber-400 bg-amber-950/30'
                : 'border-transparent text-gray-400 hover:text-white hover:bg-[#19231c]'
            }`}
          >
            <ShoppingBag className="w-4 h-4 text-emerald-400" />
            <span>Loja da Guilda</span>
          </button>

          {/* 7. Gestão */}
          {(currentUserRole === 'LÍDER' || currentUserRole === 'VICE-LÍDER') && (
            <button
              onClick={() => {
                sounds.playTabSwitch();
                setActiveTab('MANAGEMENT');
              }}
              className={`px-4 py-2.5 text-xs font-bold transition flex items-center gap-1.5 border-b-2 whitespace-nowrap ml-auto ${
                activeTab === 'MANAGEMENT'
                  ? 'border-amber-400 text-amber-400 bg-amber-950/30'
                  : 'border-transparent text-gray-400 hover:text-white hover:bg-[#19231c]'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Gestão</span>
              {joinRequests.length > 0 && (
                <span className="bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full animate-pulse">
                  {joinRequests.length}
                </span>
              )}
            </button>
          )}
        </div>

        {/* GUILD NOTICE MURAL (ALWAYS VISIBLE SUB-BANNER) */}
        <div className="bg-[#141b16] border-b border-[#233126] px-4 py-2 text-xs text-amber-200/90 flex items-center gap-2">
          <span className="font-bold text-amber-400 uppercase tracking-wider shrink-0 text-[11px] bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800">
            📢 Mural Oficial:
          </span>
          <span className="truncate flex-1 text-[11px] italic">{guildInfo.notice}</span>
        </div>

        {/* TAB CONTENTS CONTAINER */}
        <div className="flex-1 overflow-y-auto bg-[#0d130f]">
          {activeTab === 'MEMBERS' && (
            <MembersTab
              members={members}
              userRole={currentUserRole}
              currentUserName={currentUserName}
              onPromote={onPromoteMember}
              onDemote={onDemoteMember}
              onKick={onKickMember}
              onDonate={onDonateToGuild}
              onInviteMember={onInviteMember}
              onWhisper={() => setActiveTab('MEMBERS')}
            />
          )}

          {activeTab === 'RANKING' && (
            <RankingTab serverGuilds={serverGuilds} members={members} />
          )}

          {activeTab === 'MISSIONS' && (
            <MissionsTab
              missions={missions}
              onClaimReward={onClaimMissionReward}
              onClaimAllRewards={onClaimAllMissionRewards}
              onSimulateProgress={onSimulateMissionProgress}
            />
          )}

          {activeTab === 'BOSS' && (
            <BossTab
              boss={boss}
              currentUserName={currentUserName}
              onAttackBoss={onAttackBoss}
            />
          )}

          {activeTab === 'PERKS' && (
            <PerksTab
              skills={skills}
              guildFunds={guildInfo.funds}
              guildCoins={userGuildCoins}
              userRole={currentUserRole}
              onUpgradeSkill={onUpgradeSkill}
            />
          )}

          {activeTab === 'SHOP' && (
            <ShopTab
              items={shopItems}
              userGuildCoins={userGuildCoins}
              guildLevel={guildInfo.level}
              onBuyItem={onBuyShopItem}
            />
          )}

          {activeTab === 'MANAGEMENT' && (
            <ManagementTab
              guildInfo={guildInfo}
              joinRequests={joinRequests}
              onUpdateNotice={onUpdateNotice}
              onUpdateEmblem={onUpdateEmblem}
              onApproveRequest={onApproveRequest}
              onRejectRequest={onRejectRequest}
              onLeaveGuild={onLeaveGuild}
            />
          )}
        </div>

      </div>
    </div>
  );
};
