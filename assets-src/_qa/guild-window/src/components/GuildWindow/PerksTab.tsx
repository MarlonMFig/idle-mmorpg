import React from 'react';
import { GuildSkill } from '../../types';
import { Zap, ArrowUpCircle, ShieldCheck, CheckCircle2, Lock } from 'lucide-react';
import { sounds } from '../../utils/audio';

interface PerksTabProps {
  skills: GuildSkill[];
  guildFunds: number;
  guildCoins: number;
  userRole: string;
  onUpgradeSkill: (skillId: string) => void;
}

export const PerksTab: React.FC<PerksTabProps> = ({
  skills,
  guildFunds,
  guildCoins,
  userRole,
  onUpgradeSkill,
}) => {
  const isLeaderOrOfficer = userRole === 'LÍDER' || userRole === 'VICE-LÍDER';

  return (
    <div className="p-4 space-y-4">
      {/* Overview Banner */}
      <div className="bg-[#131b16] border border-[#27362a] p-3.5 rounded-xl text-xs text-gray-300 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-amber-400 text-sm flex items-center gap-1.5">
            <Zap className="w-4 h-4" />
            Habilidades Passivas da Guilda
          </h3>
          <p className="text-gray-400 text-[11px] mt-0.5">
            As habilidades da guilda concedem bônus de atributos permanentes para todos os membros ativos durante o jogo.
          </p>
        </div>

        <div className="flex items-center gap-3 font-mono text-xs shrink-0">
          <div className="bg-[#0e1410] border border-[#233126] px-3 py-1.5 rounded-lg text-emerald-400">
            Fundos: <strong className="text-white">{guildFunds.toLocaleString()}</strong>
          </div>
          <div className="bg-[#0e1410] border border-[#233126] px-3 py-1.5 rounded-lg text-amber-300">
            Moedas: <strong className="text-white">🪙 {guildCoins.toLocaleString()}</strong>
          </div>
        </div>
      </div>

      {/* Skills Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {skills.map((skill) => {
          const isMaxed = skill.level >= skill.maxLevel;
          const canAfford =
            guildFunds >= skill.upgradeCostFunds && guildCoins >= skill.upgradeCostCoins;

          return (
            <div
              key={skill.id}
              className={`bg-[#121814] border rounded-xl p-4 flex flex-col justify-between gap-3 shadow-lg transition-all ${
                isMaxed
                  ? 'border-emerald-600/60 bg-gradient-to-br from-[#121a14] to-[#0e1410]'
                  : 'border-[#263529] hover:border-amber-600/60'
              }`}
            >
              {/* Header Info */}
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#1c2920] to-[#121a14] border border-amber-500/60 flex items-center justify-center text-2xl shrink-0 shadow">
                  {skill.icon}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-white text-sm truncate">
                      {skill.name}
                    </h4>
                    <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-[#1c2720] border border-[#2d3f33] text-amber-300">
                      Nível {skill.level}/{skill.maxLevel}
                    </span>
                  </div>

                  <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                    {skill.description}
                  </p>
                </div>
              </div>

              {/* Current Effect Badge */}
              <div className="bg-[#0c120e] p-2 rounded-lg border border-[#233126] text-xs flex justify-between items-center">
                <span className="text-gray-400">Efeito Atual:</span>
                <strong className="text-emerald-400 font-bold">{skill.effectText}</strong>
              </div>

              {/* Upgrade Button / Cost Row */}
              <div className="border-t border-[#1e2b21] pt-3 flex items-center justify-between gap-2">
                {!isMaxed && (
                  <div className="text-[11px] text-gray-400 font-mono">
                    <div>Custo: {skill.upgradeCostFunds.toLocaleString()} Fundos</div>
                    <div>🪙 {skill.upgradeCostCoins} Moedas de Guilda</div>
                  </div>
                )}

                {isMaxed ? (
                  <div className="w-full text-center py-1.5 bg-emerald-950/60 border border-emerald-700 text-emerald-400 text-xs font-bold rounded-lg flex items-center justify-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Nível Máximo Atingido</span>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      if (canAfford && isLeaderOrOfficer) {
                        sounds.playCoin();
                        onUpgradeSkill(skill.id);
                      }
                    }}
                    disabled={!canAfford || !isLeaderOrOfficer}
                    className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                      !isLeaderOrOfficer
                        ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
                        : canAfford
                        ? 'game-btn-gold shadow-md'
                        : 'bg-red-950/60 border border-red-800 text-red-300 cursor-not-allowed'
                    }`}
                  >
                    <ArrowUpCircle className="w-4 h-4" />
                    <span>
                      {!isLeaderOrOfficer
                        ? 'Requer Liderança'
                        : canAfford
                        ? 'Melhorar Habilidade'
                        : 'Recursos Insuficientes'}
                    </span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
