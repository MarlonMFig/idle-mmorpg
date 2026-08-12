import React, { useState } from 'react';
import { GuildMission, MissionCategory } from '../../types';
import { CheckCircle2, Circle, Gift, Coins, Sparkles, Shield, Clock, Play, Award, Zap, ChevronRight } from 'lucide-react';
import { sounds } from '../../utils/audio';

interface MissionsTabProps {
  missions: GuildMission[];
  onClaimReward: (missionId: string) => void;
  onClaimAllRewards: () => void;
  onSimulateProgress: (missionId: string) => void;
}

export const MissionsTab: React.FC<MissionsTabProps> = ({
  missions,
  onClaimReward,
  onClaimAllRewards,
  onSimulateProgress,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('TODAS');

  const filteredMissions = missions.filter((m) => {
    if (selectedCategory === 'TODAS') return true;
    return m.category === selectedCategory;
  });

  const totalMissionsCount = missions.length;
  const completedMissionsCount = missions.filter((m) => m.isCompleted).length;
  const readyToClaimCount = missions.filter((m) => m.isCompleted && !m.isClaimed).length;
  const claimedCount = missions.filter((m) => m.isClaimed).length;

  const totalRewardsCoinsAvailable = missions
    .filter((m) => m.isCompleted && !m.isClaimed)
    .reduce((acc, curr) => acc + curr.rewardCoins, 0);

  const overallProgressPct = Math.round((completedMissionsCount / totalMissionsCount) * 100) || 0;

  const handleClaim = (missionId: string) => {
    sounds.playCoin();
    onClaimReward(missionId);
  };

  const handleClaimAll = () => {
    sounds.playCoin();
    onClaimAllRewards();
  };

  const handleSimulate = (missionId: string) => {
    sounds.playClick();
    onSimulateProgress(missionId);
  };

  return (
    <div className="p-4 space-y-4 text-xs">
      {/* HEADER BANNER - DAILY PROGRESS CHEST */}
      <div className="bg-gradient-to-r from-[#17231a] via-[#1f2e23] to-[#17231a] border border-[#2e4233] p-4 rounded-xl shadow-lg flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Left Side: Summary and Chest Progress */}
        <div className="flex items-center gap-3.5 flex-1 w-full">
          <div className="w-14 h-14 rounded-2xl bg-amber-950/80 border-2 border-amber-500/80 flex items-center justify-center text-3xl shrink-0 shadow-[0_0_20px_rgba(245,158,11,0.3)]">
            📜
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-amber-400 game-title-font uppercase tracking-wider">
                Missões Diárias de Ninja
              </h2>
              <span className="bg-amber-950/90 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded border border-amber-800 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Reseta em: 14h 25m
              </span>
            </div>
            <p className="text-[11px] text-gray-300 mt-0.5">
              Conclua tarefas diárias para fortalecer seu clã e ganhar <strong className="text-amber-400">Moedas da Guilda</strong>!
            </p>

            {/* Overall Bar */}
            <div className="mt-2.5 space-y-1">
              <div className="flex justify-between text-[11px] font-bold">
                <span className="text-gray-300">Conclusão Diária:</span>
                <span className="text-amber-400 font-mono">
                  {completedMissionsCount} / {totalMissionsCount} Tarefas ({overallProgressPct}%)
                </span>
              </div>
              <div className="w-full bg-[#0c120e] h-3 rounded-full border border-[#2b3a2e] overflow-hidden p-0.5">
                <div
                  className="bg-gradient-to-r from-amber-600 via-amber-500 to-emerald-400 h-full rounded-full transition-all duration-500 shadow-sm"
                  style={{ width: `${overallProgressPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Quick Claim All Button */}
        {readyToClaimCount > 0 ? (
          <button
            onClick={handleClaimAll}
            className="w-full md:w-auto game-btn-gold px-5 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg shrink-0 animate-bounce"
          >
            <Sparkles className="w-4 h-4 text-amber-200" />
            <span>Resgatar Todas ({readyToClaimCount})</span>
            <span className="bg-black/40 px-2 py-0.5 rounded text-[10px] font-mono text-amber-300">
              +{totalRewardsCoinsAvailable} 🪙
            </span>
          </button>
        ) : (
          <div className="w-full md:w-auto bg-[#101712] border border-[#253629] p-2.5 rounded-xl text-center shrink-0 min-w-[170px]">
            <span className="text-[10px] text-gray-400 block font-semibold">BAÚ DE RECOMPENSAS</span>
            <div className="flex items-center justify-center gap-1 text-emerald-400 font-bold mt-0.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{claimedCount === totalMissionsCount ? 'Tudo Concluído!' : `${readyToClaimCount} Pendente`}</span>
            </div>
          </div>
        )}
      </div>

      {/* CATEGORY FILTER TABS */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 border-b border-[#233126]">
        <div className="flex items-center gap-1.5">
          {['TODAS', 'DIÁRIA', 'COMBATE', 'GUILDA', 'TREINO'].map((cat) => (
            <button
              key={cat}
              onClick={() => {
                sounds.playTabSwitch();
                setSelectedCategory(cat);
              }}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition flex items-center gap-1 whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-amber-950/80 border border-amber-600 text-amber-300 shadow'
                  : 'bg-[#141d17] border border-[#253528] text-gray-400 hover:text-white hover:bg-[#1c2920]'
              }`}
            >
              <span>{cat === 'TODAS' ? 'Todas as Missões' : cat}</span>
            </button>
          ))}
        </div>

        <span className="text-[10px] text-gray-400 hidden sm:block">
          Mostrando <strong>{filteredMissions.length}</strong> de {missions.length} missões
        </span>
      </div>

      {/* MISSIONS LIST */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filteredMissions.map((mission) => {
          const isDone = mission.isCompleted;
          const isClaimed = mission.isClaimed;
          const progressPct = Math.min(
            100,
            Math.round((mission.currentProgress / mission.targetProgress) * 100)
          );

          return (
            <div
              key={mission.id}
              className={`border p-3.5 rounded-xl transition flex flex-col justify-between gap-3 relative overflow-hidden ${
                isClaimed
                  ? 'bg-[#101612]/60 border-[#1f2c22] opacity-70'
                  : isDone
                  ? 'bg-gradient-to-r from-[#1c281e] to-[#152319] border-amber-500/80 shadow-[0_0_15px_rgba(245,158,11,0.15)]'
                  : 'bg-[#141c17] border border-[#28382d] hover:border-gray-600'
              }`}
            >
              {/* Category Tag */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-lg border border-amber-500/40 bg-black/50 flex items-center justify-center text-xl shrink-0">
                    {mission.icon}
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-xs flex items-center gap-1.5">
                      <span>{mission.title}</span>
                      {isClaimed && (
                        <span className="text-[9px] bg-gray-800 text-gray-400 px-1.5 py-0.2 rounded font-normal">
                          Concluído
                        </span>
                      )}
                    </h3>
                    <p className="text-[10px] text-gray-400 line-clamp-1">{mission.description}</p>
                  </div>
                </div>

                <span className="text-[9px] font-bold text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800/80 uppercase shrink-0">
                  {mission.category}
                </span>
              </div>

              {/* Progress Bar & Counter */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-gray-300 font-mono">
                  <span>Progresso da Tarefa:</span>
                  <span className={isDone ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                    {mission.currentProgress} / {mission.targetProgress}
                  </span>
                </div>
                <div className="w-full bg-[#0d130f] h-2 rounded-full border border-[#253629] overflow-hidden p-0.5">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      isDone ? 'bg-emerald-400' : 'bg-amber-500'
                    }`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>

              {/* Rewards & Action Button */}
              <div className="flex items-center justify-between pt-1 border-t border-[#233227] gap-2">
                {/* Rewards Badge */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-amber-950/60 border border-amber-800/80 px-2 py-0.5 rounded text-[10px] font-bold text-amber-300">
                    <span>💰</span>
                    <span>+{mission.rewardCoins} Moedas</span>
                  </div>
                  <div className="flex items-center gap-1 bg-emerald-950/60 border border-emerald-800/80 px-2 py-0.5 rounded text-[10px] font-bold text-emerald-300">
                    <span>⭐</span>
                    <span>+{mission.rewardExp} EXP</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5">
                  {!isDone && (
                    <button
                      onClick={() => handleSimulate(mission.id)}
                      className="px-2.5 py-1 bg-[#1e2a21] hover:bg-[#28382d] border border-[#34483b] rounded text-[10px] font-bold text-gray-200 transition flex items-center gap-1"
                      title="Avançar progresso da missão"
                    >
                      <Play className="w-3 h-3 text-amber-400" />
                      <span>Progredir</span>
                    </button>
                  )}

                  {isDone && !isClaimed && (
                    <button
                      onClick={() => handleClaim(mission.id)}
                      className="game-btn-gold px-3.5 py-1.5 rounded-lg font-bold text-[11px] flex items-center gap-1 shadow animate-pulse"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Resgatar</span>
                    </button>
                  )}

                  {isClaimed && (
                    <div className="px-3 py-1 bg-emerald-950/40 border border-emerald-800/50 rounded-lg text-emerald-400 text-[10px] font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Resgatado</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* FOOTER INFO */}
      <div className="bg-[#121914] border border-[#233126] p-3 rounded-xl flex items-center justify-between text-gray-400 text-[11px]">
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-amber-400" />
          <span>
            As missões diárias da guilda são renovadas a cada 24 horas à meia-noite (Horário do Servidor).
          </span>
        </div>
        <span className="font-mono text-amber-300 hidden md:inline">
          Moedas da Guilda Atuais: <strong className="text-amber-400">{totalMissionsCount} Tarefas</strong>
        </span>
      </div>
    </div>
  );
};
