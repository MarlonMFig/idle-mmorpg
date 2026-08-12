import React, { useState } from 'react';
import { GuildBoss, BossDamager } from '../../types';
import { Swords, Flame, Timer, Trophy, Gift, Zap, Sparkles, ShieldAlert } from 'lucide-react';
import { sounds } from '../../utils/audio';

interface BossTabProps {
  boss: GuildBoss;
  currentUserName: string;
  onAttackBoss: (damageAmount: number) => void;
}

export const BossTab: React.FC<BossTabProps> = ({ boss, currentUserName, onAttackBoss }) => {
  const [lastAttackDamage, setLastAttackDamage] = useState<number | null>(null);
  const [isCriticalHit, setIsCriticalHit] = useState(false);
  const [isAttacking, setIsAttacking] = useState(false);

  const hpPercent = Math.max(0, Math.round((boss.currentHp / boss.maxHp) * 100));

  const handleAttack = () => {
    if (boss.currentHp <= 0 || isAttacking) return;

    setIsAttacking(true);
    sounds.playBossAttack();

    // Calculate simulated attack damage (e.g. 850,000 - 2,500,000 damage with 25% crit chance)
    const isCrit = Math.random() < 0.25;
    const baseDamage = Math.floor(Math.random() * 1200000) + 850000;
    const finalDamage = isCrit ? Math.floor(baseDamage * 2.2) : baseDamage;

    setIsCriticalHit(isCrit);
    setLastAttackDamage(finalDamage);

    setTimeout(() => {
      onAttackBoss(finalDamage);
      setIsAttacking(false);
    }, 400);
  };

  return (
    <div className="p-4 space-y-4">
      {/* BOSS RAID MAIN CARD */}
      <div className="relative bg-gradient-to-br from-[#1a120b] via-[#1f1911] to-[#121613] border-2 border-[#e5a93c] rounded-2xl p-5 text-white shadow-2xl overflow-hidden">
        
        {/* Background fiery aura effect */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          
          {/* Boss Avatar & Title */}
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-red-600 to-amber-700 border-2 border-amber-400 flex items-center justify-center text-4xl shadow-[0_0_25px_rgba(239,68,68,0.5)] animate-pulse">
              {boss.avatarUrl}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="bg-red-950 text-red-400 border border-red-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                  Chefe da Guilda
                </span>
                <span className="bg-amber-950 text-amber-300 border border-amber-800 text-[10px] font-bold px-2 py-0.5 rounded">
                  Lv. {boss.level}
                </span>
              </div>
              <h2 className="text-2xl font-bold game-title-font text-amber-400 mt-1">
                {boss.name}
              </h2>
              <p className="text-xs text-gray-300 italic">{boss.title}</p>
            </div>
          </div>

          {/* Time Remaining & Status Badge */}
          <div className="flex flex-col items-center md:items-end">
            <div className="flex items-center gap-1.5 text-xs text-amber-300 font-bold bg-[#0d130f] border border-[#27352b] px-3 py-1.5 rounded-xl">
              <Timer className="w-4 h-4 text-amber-400" />
              <span>Tempo Restante: 07h 45m</span>
            </div>
            <span className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              Raid Ativa • Todos podem atacar 3x ao dia
            </span>
          </div>

        </div>

        {/* Boss HP Bar */}
        <div className="mt-5 space-y-1">
          <div className="flex justify-between text-xs font-bold">
            <span className="text-red-400 flex items-center gap-1">
              <Flame className="w-4 h-4" />
              Vida do Chefe ({hpPercent}%):
            </span>
            <span className="text-amber-300 font-mono">
              {boss.currentHp.toLocaleString()} / {boss.maxHp.toLocaleString()} HP
            </span>
          </div>

          <div className="w-full bg-black/80 h-4 rounded-full p-0.5 border border-red-900/80 overflow-hidden shadow-inner">
            <div
              className="bg-gradient-to-r from-red-700 via-amber-500 to-yellow-400 h-full rounded-full transition-all duration-300 shadow-[0_0_12px_rgba(239,68,68,0.8)]"
              style={{ width: `${hpPercent}%` }}
            />
          </div>
        </div>

        {/* Attack Damage Splash Indicator */}
        {lastAttackDamage !== null && (
          <div className={`mt-3 p-2 rounded-xl text-center text-xs font-bold animate-bounce ${
            isCriticalHit
              ? 'bg-gradient-to-r from-amber-600 to-red-600 text-white border border-yellow-300 shadow-lg'
              : 'bg-amber-950/80 text-amber-200 border border-amber-700'
          }`}>
            {isCriticalHit ? '⚡ GOLPE CRÍTICO FURIOSO! ⚡' : '⚔️ ATAQUE REALIZADO!'}
            <div className="text-lg font-mono text-amber-300">
              -{lastAttackDamage.toLocaleString()} Dano Cauterizado!
            </div>
          </div>
        )}

        {/* Attack Action Button */}
        <div className="mt-5 flex justify-center">
          <button
            onClick={handleAttack}
            disabled={boss.currentHp <= 0 || isAttacking}
            className={`px-8 py-3 rounded-2xl text-sm font-bold flex items-center gap-2 shadow-2xl transition-all transform hover:scale-105 ${
              boss.currentHp <= 0
                ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
                : 'game-btn-gold text-lg'
            }`}
          >
            <Swords className="w-6 h-6 text-amber-200" />
            <span>{isAttacking ? 'ATACANDO...' : 'ATACAR CHEFE DA GUILDA'}</span>
          </button>
        </div>

      </div>

      {/* REWARDS & LEADERBOARD GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Left Column: Boss Rewards */}
        <div className="bg-[#121814] border border-[#263529] rounded-xl p-4 text-xs text-gray-300 space-y-3">
          <h3 className="text-sm font-bold game-title-font text-amber-400 flex items-center gap-1.5 border-b border-gray-800 pb-2">
            <Gift className="w-4 h-4" />
            Recompensas de Derrota
          </h3>

          <div className="space-y-2">
            <div className="bg-[#18231c] p-2 rounded-lg flex justify-between items-center">
              <span className="text-gray-400">EXP de Guilda:</span>
              <strong className="text-emerald-400 font-mono">+{boss.rewards.exp.toLocaleString()} EXP</strong>
            </div>

            <div className="bg-[#18231c] p-2 rounded-lg flex justify-between items-center">
              <span className="text-gray-400">Moedas de Guilda:</span>
              <strong className="text-amber-300 font-mono">🪙 +{boss.rewards.coins} Moedas</strong>
            </div>

            <div className="bg-[#18231c] p-2 rounded-lg space-y-1">
              <span className="text-gray-400 block font-bold text-[11px]">Itens Especiais de Recompensa:</span>
              {boss.rewards.items.map((item, i) => (
                <div key={i} className="text-amber-200 text-[11px] flex items-center gap-1">
                  <span>✦</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right 2 Columns: Top Damagers Leaderboard */}
        <div className="md:col-span-2 bg-[#121814] border border-[#263529] rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-bold game-title-font text-amber-400 flex items-center justify-between border-b border-gray-800 pb-2">
            <span className="flex items-center gap-1.5">
              <Trophy className="w-4 h-4" />
              Ranking de Dano no Boss
            </span>
            <span className="text-xs text-gray-400 font-normal">Sua guilda no comando</span>
          </h3>

          <div className="space-y-2">
            {boss.topDamagers.map((damager, index) => {
              const isSelf = damager.memberName === currentUserName;

              return (
                <div
                  key={damager.id}
                  className={`p-2.5 rounded-lg border text-xs flex items-center justify-between gap-2 ${
                    isSelf
                      ? 'bg-amber-950/40 border-amber-600'
                      : 'bg-[#18231c] border-[#28382d]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="font-bold text-amber-400 w-5 text-center">
                      #{index + 1}
                    </span>
                    <div>
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <span>{damager.memberName}</span>
                        {isSelf && (
                          <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500 px-1 rounded">
                            Você
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-gray-400">
                        {damager.characterName} • {damager.attacksCount} Ataques realizados
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-bold text-amber-300 font-mono">
                      ⚡ {damager.damage.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-emerald-400">
                      {damager.percentage}% do dano total
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
};
