import React from 'react';
import { GuildInfo } from '../../types';
import { Shield, Trophy, Users, Zap, Coins, CheckCircle, Calendar, Sparkles } from 'lucide-react';
import { sounds } from '../../utils/audio';

interface GuildHeaderProps {
  guildInfo: GuildInfo;
  onCheckIn: () => void;
  isCheckedIn: boolean;
  onOpenManagement?: () => void;
  userRole?: string;
}

export const GuildHeader: React.FC<GuildHeaderProps> = ({
  guildInfo,
  onCheckIn,
  isCheckedIn,
  onOpenManagement,
  userRole = 'LÍDER',
}) => {
  const expPercent = Math.min(100, Math.round((guildInfo.exp / guildInfo.maxExp) * 100));

  return (
    <div className="relative bg-gradient-to-r from-[#17201b] via-[#1c2720] to-[#141b17] border-b border-[#2e3e32] p-4 text-white">
      {/* Top Banner Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Left: Guild Crest & Basic Details */}
        <div className="flex items-center gap-3.5">
          {/* Emblem Icon */}
          <div 
            className="w-14 h-14 md:w-16 md:h-16 rounded-xl border-2 border-[#e5a93c] flex items-center justify-center text-3xl shadow-[0_0_20px_rgba(229,169,60,0.25)] relative overflow-hidden"
            style={{ backgroundColor: guildInfo.emblemBg || '#7f1d1d' }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
            <span className="relative z-10">{guildInfo.emblemIcon}</span>
            <span className="absolute bottom-0 right-0 bg-black/80 text-[10px] font-bold text-amber-300 px-1 rounded-tl border-t border-l border-amber-600">
              Lv.{guildInfo.level}
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl md:text-2xl font-bold game-title-font tracking-wide text-amber-400 drop-shadow">
                {guildInfo.name}
              </h2>
              <span className="bg-[#243128] border border-[#3b4e40] text-amber-200 text-xs font-bold px-2 py-0.5 rounded">
                [{guildInfo.tag}]
              </span>
              {(userRole === 'LÍDER' || userRole === 'VICE-LÍDER') && onOpenManagement && (
                <button
                  onClick={() => {
                    sounds.playClick();
                    onOpenManagement();
                  }}
                  className="text-[11px] bg-[#1a231d] hover:bg-[#28382e] border border-amber-600/60 text-amber-300 px-2 py-0.5 rounded transition"
                >
                  ⚙️ Gestão
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-300 mt-1">
              <span className="flex items-center gap-1">
                <span className="text-gray-400">Líder:</span>
                <strong className="text-white">{guildInfo.leaderName}</strong>
              </span>
              <span className="text-gray-600">•</span>
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-emerald-400" />
                <span>Membros:</span>
                <strong className="text-emerald-300">{guildInfo.memberCount}/{guildInfo.maxMembers}</strong>
              </span>
              <span className="text-gray-600">•</span>
              <span className="flex items-center gap-1">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                <span>Ranking:</span>
                <strong className="text-amber-300">#{guildInfo.serverRank} no Servidor</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Right: Currency Counters & Daily Check-in Button */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Guild Funds & Coins */}
          <div className="flex flex-col gap-1 text-xs">
            <div className="bg-[#121814] border border-[#263529] px-3 py-1 rounded-lg flex items-center gap-2">
              <span className="text-amber-400 font-bold">🏛️ Fundos da Guilda:</span>
              <span className="text-emerald-400 font-bold font-mono">
                {guildInfo.funds.toLocaleString()}
              </span>
            </div>
            <div className="bg-[#121814] border border-[#263529] px-3 py-1 rounded-lg flex items-center gap-2">
              <span className="text-amber-400 font-bold">🪙 Moedas de Guilda:</span>
              <span className="text-amber-300 font-bold font-mono">
                {guildInfo.guildCoins.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Presença / Check-in Button */}
          <button
            onClick={() => {
              if (!isCheckedIn) {
                sounds.playCoin();
                onCheckIn();
              }
            }}
            disabled={isCheckedIn}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md ${
              isCheckedIn
                ? 'bg-[#1e2721] border border-gray-700 text-gray-400 cursor-default'
                : 'game-btn-gold animate-pulse hover:scale-105'
            }`}
          >
            {isCheckedIn ? (
              <>
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span>Presença Confirmada!</span>
              </>
            ) : (
              <>
                <Calendar className="w-4 h-4 text-amber-200" />
                <div className="text-left">
                  <div className="leading-none">Marcar Presença</div>
                  <div className="text-[9px] font-normal text-amber-100 opacity-90">
                    +100 Moedas • +500 EXP
                  </div>
                </div>
              </>
            )}
          </button>
        </div>

      </div>

      {/* Guild Level & EXP Progress Bar */}
      <div className="mt-3 bg-[#111713] border border-[#243327] rounded-lg p-2 flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-bold text-amber-400 uppercase tracking-wider text-[11px]">
            Progresso de Nível {guildInfo.level}:
          </span>
          <span className="text-gray-300 font-mono text-[11px]">
            {guildInfo.exp.toLocaleString()} / {guildInfo.maxExp.toLocaleString()} EXP ({expPercent}%)
          </span>
        </div>

        <div className="flex-1 md:max-w-md bg-gray-900 h-2.5 rounded-full overflow-hidden border border-gray-800 p-0.5">
          <div 
            className="bg-gradient-to-r from-amber-600 via-amber-400 to-yellow-300 h-full rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"
            style={{ width: `${expPercent}%` }}
          />
        </div>

        <div className="text-[11px] text-gray-400 flex items-center gap-1">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span>Poder Total:</span>
          <strong className="text-amber-300 font-mono">{(guildInfo.totalPower / 1000000).toFixed(2)}M</strong>
        </div>
      </div>
    </div>
  );
};
