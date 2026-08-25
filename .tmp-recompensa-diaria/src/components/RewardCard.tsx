import React from 'react';
import { motion } from 'motion/react';
import { Lock, Sparkles, Gift } from 'lucide-react';
import { DayReward, DayStatus } from '../types';
import { ItemIcon } from './ItemIcon';

interface RewardCardProps {
  reward: DayReward;
  status: DayStatus;
  isToday: boolean;
  onClaim?: () => void;
  onSelect?: () => void;
  soundEnabled?: boolean;
  onItemHover?: (name: string, description: string) => void;
}

export const RewardCard: React.FC<RewardCardProps> = ({
  reward,
  status,
  isToday,
  onClaim,
  onItemHover,
}) => {
  const isGrand = reward.isGrandReward;
  const isClaimed = status === 'claimed';
  const isAvailable = status === 'available';
  const isLocked = status === 'locked';

  const primaryItem = reward.items[0];

  // Day 7 Grand Reward - Immersive UI Special Layout
  if (isGrand) {
    return (
      <motion.div
        id={`reward-card-day-${reward.day}`}
        whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
        className={`col-span-1 sm:col-span-2 lg:col-span-2 bg-gradient-to-br from-purple-950/60 via-purple-900/30 to-blue-950/60 border rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between relative overflow-hidden transition-all duration-300 ${
          isClaimed
            ? 'border-green-500/50 shadow-[0_0_25px_rgba(34,197,94,0.15)]'
            : isAvailable
            ? 'border-yellow-400/80 shadow-[0_0_35px_rgba(234,179,8,0.25)] ring-1 ring-yellow-400/40'
            : 'border-yellow-500/40 shadow-[0_0_25px_rgba(234,179,8,0.12)]'
        }`}
      >
        {/* Ambient Gold Ray Blur in corner */}
        <div className="absolute top-0 right-0 w-36 h-36 bg-yellow-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-36 h-36 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Status Tag Pill if Today */}
        {isAvailable && (
          <div className="absolute -top-1 left-6 bg-blue-500 text-[10px] px-3 py-0.5 rounded-full font-black uppercase tracking-widest text-white shadow-[0_0_12px_rgba(59,130,246,0.6)]">
            Hoje
          </div>
        )}

        {/* Status Checkmark if Claimed */}
        {isClaimed && (
          <div className="absolute top-3 right-3 text-green-500">
            <svg className="w-6 h-6 drop-shadow-[0_0_8px_rgba(34,197,94,0.6)]" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
        )}

        {/* Left Side: Icon & Title */}
        <div className="flex items-center gap-4 sm:gap-6 relative z-10 w-full sm:w-auto mb-3 sm:mb-0">
          <div
            className="cursor-pointer transition-transform hover:scale-110"
            onMouseEnter={() => onItemHover?.(primaryItem.name, primaryItem.description)}
          >
            <ItemIcon
              type={primaryItem.type}
              rarity="legendary"
              size="lg"
              showGlow={true}
              className="!w-16 !h-16 border-amber-400/60 shadow-[0_0_20px_rgba(234,179,8,0.4)]"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-yellow-500 uppercase tracking-widest">
                Recompensa Final
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full bg-yellow-500/20 border border-yellow-500/30 text-[10px] font-bold text-yellow-300 font-sans">
                <Sparkles className="w-3 h-3 text-yellow-400" />
                Mítico
              </span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-white italic uppercase tracking-tight">
              Baú Lendário
            </h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {reward.items.map((item, idx) => (
                <span
                  key={idx}
                  onMouseEnter={() => onItemHover?.(item.name, item.description)}
                  className="text-xs font-semibold text-yellow-200/80 bg-black/40 px-2 py-0.5 rounded-md border border-white/5 cursor-help"
                >
                  {item.count > 1 ? `${item.count}× ` : ''}
                  {item.name}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side: Day & Subtitle + Action */}
        <div className="text-left sm:text-right relative z-10 w-full sm:w-auto flex sm:flex-col items-center sm:items-end justify-between gap-2">
          <div>
            <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider">
              Dia 7
            </span>
            <span className="text-xs sm:text-sm text-yellow-200/90 font-medium">
              Item Épico Garantido
            </span>
          </div>

          {isAvailable && onClaim && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={(e) => {
                e.stopPropagation();
                onClaim();
              }}
              className="sm:mt-2 px-4 py-1.5 rounded-full font-rajdhani font-black text-xs uppercase tracking-wider bg-gradient-to-r from-yellow-400 to-amber-500 text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.5)] cursor-pointer"
            >
              Resgatar
            </motion.button>
          )}
        </div>
      </motion.div>
    );
  }

  // Cards 1 to 6 - Immersive UI Theme
  return (
    <motion.div
      id={`reward-card-day-${reward.day}`}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className={`rounded-2xl p-5 flex flex-col items-center justify-between text-center relative transition-all duration-300 min-h-[170px] ${
        isClaimed
          ? 'bg-[#1a1b26]/85 border border-green-500/50 shadow-[0_0_20px_rgba(34,197,94,0.12)]'
          : isAvailable
          ? 'bg-blue-600/20 border-2 border-blue-400 shadow-[0_0_30px_rgba(59,130,246,0.3)] scale-[1.03] z-10'
          : 'bg-gray-900/40 border border-gray-700/50 opacity-60 hover:opacity-85'
      }`}
    >
      {/* Top Floating Pill: Hoje */}
      {isAvailable && (
        <div className="absolute -top-3 bg-blue-500 text-[10px] px-3 py-0.5 rounded-full font-black uppercase tracking-widest text-white shadow-[0_0_12px_rgba(59,130,246,0.7)]">
          Hoje
        </div>
      )}

      {/* Top-Right Badge: Coletado */}
      {isClaimed && (
        <div className="absolute top-2.5 right-2.5 text-green-500">
          <svg className="w-5 h-5 drop-shadow-[0_0_8px_rgba(34,197,94,0.6)]" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        </div>
      )}

      {/* Top-Right Icon: Bloqueado */}
      {isLocked && (
        <div className="absolute top-2.5 right-2.5 text-gray-500">
          <Lock className="w-3.5 h-3.5 opacity-60" />
        </div>
      )}

      {/* Item Icon Showcase with Hover Tooltip */}
      <div
        className="my-1.5 cursor-pointer transition-transform hover:scale-110"
        onMouseEnter={() => onItemHover?.(primaryItem.name, primaryItem.description)}
      >
        <ItemIcon
          type={primaryItem.type}
          rarity={primaryItem.rarity}
          size="lg"
          count={primaryItem.count}
          showGlow={isAvailable || primaryItem.rarity === 'legendary' || primaryItem.rarity === 'epic'}
          className={isLocked ? 'grayscale-[0.4] opacity-80' : ''}
        />
      </div>

      {/* Text Info */}
      <div className="w-full flex flex-col items-center">
        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
          Dia {reward.day}
        </span>
        <span
          className={`text-base sm:text-lg font-bold tracking-tight truncate max-w-full px-1 ${
            isClaimed
              ? 'text-green-400'
              : isAvailable
              ? 'text-white font-black'
              : 'text-gray-300'
          }`}
        >
          {primaryItem.count > 1 ? `${primaryItem.count}× ` : ''}
          {primaryItem.name}
        </span>

        {/* Secondary item if present */}
        {reward.items[1] && (
          <span className="text-[10px] text-gray-400 font-medium">
            + {reward.items[1].count > 1 ? `${reward.items[1].count}× ` : ''}{reward.items[1].name}
          </span>
        )}
      </div>

      {/* Quick Collect if Available */}
      {isAvailable && onClaim && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={(e) => {
            e.stopPropagation();
            onClaim();
          }}
          className="mt-2 w-full py-1.5 rounded-lg bg-blue-500 hover:bg-blue-400 text-white font-black uppercase text-xs tracking-wider shadow-[0_0_12px_rgba(59,130,246,0.5)] transition-all cursor-pointer flex items-center justify-center gap-1.5"
        >
          <Gift className="w-3.5 h-3.5" />
          Coletar
        </motion.button>
      )}
    </motion.div>
  );
};
