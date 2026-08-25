import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { Sparkles, CheckCircle2, ArrowRight } from 'lucide-react';
import { DayReward } from '../types';
import { ItemIcon } from './ItemIcon';
import { SoundFX } from '../utils/sound';

interface ClaimCelebrationModalProps {
  isOpen: boolean;
  reward: DayReward | null;
  onClose: () => void;
  soundEnabled?: boolean;
}

export const ClaimCelebrationModal: React.FC<ClaimCelebrationModalProps> = ({
  isOpen,
  reward,
  onClose,
  soundEnabled = true,
}) => {
  useEffect(() => {
    if (isOpen && reward) {
      if (reward.isGrandReward) {
        SoundFX.playGrandFanfare(soundEnabled);
      } else {
        SoundFX.playClaim(soundEnabled);
      }

      // Trigger multi-stage confetti
      const count = reward.isGrandReward ? 180 : 90;
      const defaults = {
        origin: { y: 0.65 },
        colors: ['#fbbf24', '#f59e0b', '#ef4444', '#3b82f6', '#a855f7', '#ffffff'],
      };

      const fire = (particleRatio: number, opts: confetti.Options) => {
        confetti({
          ...defaults,
          ...opts,
          particleCount: Math.floor(count * particleRatio),
        });
      };

      fire(0.25, {
        spread: 26,
        startVelocity: 55,
      });
      fire(0.2, {
        spread: 60,
      });
      fire(0.35, {
        spread: 100,
        decay: 0.91,
        scalar: 0.8,
      });
      fire(0.1, {
        spread: 120,
        startVelocity: 25,
        decay: 0.92,
        scalar: 1.2,
      });
      fire(0.1, {
        spread: 120,
        startVelocity: 45,
      });
    }
  }, [isOpen, reward, soundEnabled]);

  if (!isOpen || !reward) return null;

  return (
    <AnimatePresence>
      <div
        id="claim-celebration-backdrop"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
        onClick={onClose}
      >
        {/* Animated Radiant Rays */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
          <div
            className="w-[600px] h-[600px] sm:w-[800px] sm:h-[800px] rounded-full opacity-40 blur-3xl animate-pulse-glow"
            style={{
              background: reward.isGrandReward
                ? 'radial-gradient(circle, rgba(234,179,8,0.5) 0%, rgba(59,130,246,0.3) 50%, transparent 70%)'
                : 'radial-gradient(circle, rgba(59,130,246,0.5) 0%, rgba(147,51,234,0.3) 50%, transparent 70%)',
            }}
          />
        </div>

        <motion.div
          id="claim-celebration-dialog"
          initial={{ opacity: 0, scale: 0.85, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', damping: 24, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="relative z-10 w-full max-w-lg rounded-3xl bg-[#090a12]/95 border border-white/15 p-6 sm:p-8 text-center shadow-[0_0_60px_rgba(0,0,0,0.9),0_0_30px_rgba(59,130,246,0.25)] overflow-hidden"
        >
          {/* Top subtle shine bar */}
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-blue-400 to-transparent" />

          {/* Icon Badge */}
          <div className="mx-auto mb-4 w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-gradient-to-br from-blue-500 to-indigo-600 p-0.5 shadow-[0_0_30px_rgba(59,130,246,0.5)]">
            <div className="w-full h-full rounded-[22px] bg-[#050508] flex items-center justify-center">
              <Sparkles className="w-8 h-8 sm:w-10 sm:h-10 text-blue-400 animate-pulse" />
            </div>
          </div>

          {/* Title */}
          <p className="text-blue-400 text-xs font-bold tracking-[0.3em] uppercase mb-1">
            BÔNUS RESGATADO
          </p>
          <h3 className="text-2xl sm:text-3xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-gray-400 uppercase">
            Recompensa Coletada!
          </h3>

          <p className="mt-1 text-sm font-bold tracking-wider text-blue-300">
            {reward.title.toUpperCase()} • {reward.subtitle?.toUpperCase() || 'PROVISÕES RECEBIDAS'}
          </p>

          <p className="mt-2 text-xs sm:text-sm text-gray-400">
            Os seguintes itens foram transferidos e equipados diretamente na sua bolsa de aventureiro:
          </p>

          {/* Items Showcase Card Grid */}
          <div className="my-6 grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-56 overflow-y-auto px-1">
            {reward.items.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + index * 0.08 }}
                className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/10 shadow-inner text-left hover:border-blue-500/40 transition-colors"
              >
                <ItemIcon
                  type={item.type}
                  rarity={item.rarity}
                  size="md"
                  count={item.count}
                  showGlow={true}
                />
                <div className="flex flex-col min-w-0">
                  <span className="text-xs sm:text-sm font-bold text-white truncate">
                    {item.count > 1 ? `${item.count}× ` : ''}
                    {item.name}
                  </span>
                  <span className="text-[10px] text-gray-400 line-clamp-1">
                    {item.description}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Confirmation Action Button */}
          <motion.button
            id="celebration-confirm-btn"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              SoundFX.playClick(soundEnabled);
              onClose();
            }}
            className="w-full relative group py-3.5 px-6 rounded-full font-black uppercase italic tracking-widest text-white bg-gradient-to-r from-blue-600 via-blue-500 to-blue-400 shadow-[0_0_30px_rgba(37,99,235,0.45)] hover:shadow-[0_0_40px_rgba(37,99,235,0.7)] transition-all duration-200 cursor-pointer overflow-hidden"
          >
            <span className="relative z-10 flex items-center justify-center gap-2">
              <CheckCircle2 className="w-5 h-5 fill-white text-blue-600" />
              CONFIRMAR E CONTINUAR
              <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
            </span>
            <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
          </motion.button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
