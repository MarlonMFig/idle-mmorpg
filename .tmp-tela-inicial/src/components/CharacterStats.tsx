import { motion } from 'motion/react';
import React from 'react';
import { CharacterStats as StatsType, ShinobiCharacter } from '../types';

interface CharacterStatsProps {
  character: ShinobiCharacter;
}

const STAT_CONFIG: { key: keyof StatsType; label: string; icon: string }[] = [
  { key: 'forca', label: 'FORÇA', icon: '⚔️' },
  { key: 'ninjutsu', label: 'NINJUTSU', icon: '🌀' },
  { key: 'taijutsu', label: 'TAIJUTSU', icon: '👊' },
  { key: 'agilidade', label: 'AGILIDADE', icon: '⚡' },
  { key: 'estamina', label: 'ESTAMINA', icon: '❤️' },
  { key: 'selos', label: 'SELOS / TÁT.', icon: '📜' },
];

export const CharacterStatsView: React.FC<CharacterStatsProps> = ({ character }) => {
  return (
    <div className="grid grid-cols-2 gap-x-5 gap-y-2.5">
      {STAT_CONFIG.map((stat) => {
        const val = character.stats[stat.key];
        const percentage = Math.min(100, Math.max(8, val));

        return (
          <div key={stat.key} className="flex flex-col">
            <div className="flex items-center justify-between text-[10px] uppercase font-bold tracking-wider mb-1">
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="text-[11px]">{stat.icon}</span>
                {stat.label}
              </span>
              <span 
                className="font-mono font-bold"
                style={{ color: val >= 90 ? character.themeColor.accent : '#94a3b8' }}
              >
                {val}
              </span>
            </div>

            {/* Immersive UI Glow Stat Bar */}
            <div className="h-1.5 w-full bg-slate-800/90 rounded-full overflow-hidden p-[0.5px] border border-white/5">
              <motion.div
                key={`${character.id}-${stat.key}`}
                initial={{ width: 0 }}
                animate={{ width: `${percentage}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="h-full rounded-full"
                style={{
                  backgroundColor: character.themeColor.primary,
                  boxShadow: `0 0 10px ${character.themeColor.primary}`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
