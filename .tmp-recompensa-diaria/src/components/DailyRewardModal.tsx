import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Sparkles,
  Volume2,
  VolumeX,
  RotateCcw,
  FastForward,
  Clock,
  Flame,
  Gift,
  HelpCircle,
  Award,
} from 'lucide-react';
import { DAILY_REWARDS_DATA } from '../data/rewards';
import { DayStatus, PlayerInventory, DayReward } from '../types';
import { RewardCard } from './RewardCard';
import { ClaimCelebrationModal } from './ClaimCelebrationModal';
import { PlayerInventoryBar } from './PlayerInventoryBar';
import { SoundFX } from '../utils/sound';

interface DailyRewardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DailyRewardModal: React.FC<DailyRewardModalProps> = ({ isOpen, onClose }) => {
  // State for current day (1 to 7)
  const [currentDay, setCurrentDay] = useState<number>(1);
  
  // State for claimed days
  const [claimedDays, setClaimedDays] = useState<number[]>([]);
  
  // Audio toggle
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  
  // Celebration modal state
  const [celebrationReward, setCelebrationReward] = useState<DayReward | null>(null);
  
  // Item hover tooltip info
  const [hoveredItem, setHoveredItem] = useState<{ name: string; description: string } | null>(null);

  // Player Inventory
  const [inventory, setInventory] = useState<PlayerInventory>({
    copper: 250,
    potions: 3,
    concentratedPotions: 1,
    ultraPotions: 0,
    scrolls: 1,
    revives: 1,
    chests: 0,
  });

  // Countdown timer simulation (until next day reset)
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number }>({
    hours: 14,
    minutes: 32,
    seconds: 45,
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev.seconds > 0) {
          return { ...prev, seconds: prev.seconds - 1 };
        } else if (prev.minutes > 0) {
          return { ...prev, minutes: prev.minutes - 1, seconds: 59 };
        } else if (prev.hours > 0) {
          return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
        } else {
          return { hours: 23, minutes: 59, seconds: 59 };
        }
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Determine status for each day
  const getDayStatus = (day: number): DayStatus => {
    if (claimedDays.includes(day)) return 'claimed';
    if (day === currentDay) return 'available';
    if (day < currentDay) return 'missed';
    return 'locked';
  };

  const isTodayAvailable = !claimedDays.includes(currentDay);
  const currentDayReward = DAILY_REWARDS_DATA.find((r) => r.day === currentDay);

  // Claim reward handler
  const handleClaim = (dayToClaim: number = currentDay) => {
    if (claimedDays.includes(dayToClaim)) return;

    const reward = DAILY_REWARDS_DATA.find((r) => r.day === dayToClaim);
    if (!reward) return;

    // Update claimed list
    setClaimedDays((prev) => [...prev, dayToClaim]);

    // Update inventory
    setInventory((prev) => {
      const nextInv = { ...prev };
      reward.items.forEach((item) => {
        if (item.type === 'copper') nextInv.copper += item.count;
        if (item.type === 'potion') nextInv.potions += item.count;
        if (item.type === 'concentrated_potion') nextInv.concentratedPotions += item.count;
        if (item.type === 'ultra_potion') nextInv.ultraPotions += item.count;
        if (item.type === 'scroll') nextInv.scrolls += item.count;
        if (item.type === 'revive') nextInv.revives += item.count;
        if (item.type === 'chest') nextInv.chests += item.count;
      });
      return nextInv;
    });

    // Open celebration modal
    setCelebrationReward(reward);
  };

  // Dev tools actions
  const handleNextDay = () => {
    SoundFX.playClick(soundEnabled);
    if (currentDay < 7) {
      setCurrentDay((prev) => prev + 1);
    } else {
      // Loop back to day 1 for full showcase
      setCurrentDay(1);
      setClaimedDays([]);
    }
  };

  const handleReset = () => {
    SoundFX.playClick(soundEnabled);
    setCurrentDay(1);
    setClaimedDays([]);
  };

  const formatTwoDigits = (n: number) => n.toString().padStart(2, '0');

  if (!isOpen) return null;

  return (
    <div
      id="daily-reward-modal-backdrop"
      className="fixed inset-0 z-40 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-[#050508]/85 backdrop-blur-xl overflow-y-auto"
    >
      {/* Background ambient lighting for Immersive UI */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-blue-900/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="fixed -bottom-20 -right-20 w-[500px] h-[500px] bg-purple-900/15 rounded-full blur-[130px] pointer-events-none" />

      {/* Main Window Container */}
      <motion.div
        id="daily-reward-window"
        initial={{ opacity: 0, scale: 0.94, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ type: 'spring', damping: 26, stiffness: 320 }}
        className="relative z-10 w-full max-w-5xl rounded-3xl bg-[#090a12]/95 border border-white/10 shadow-[0_0_60px_rgba(0,0,0,0.9),0_0_30px_rgba(59,130,246,0.15)] flex flex-col my-auto overflow-hidden"
      >
        {/* Top laser beam accent */}
        <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />

        {/* Top Header Bar & Controls */}
        <div className="relative z-20 px-6 sm:px-8 pt-6 pb-2 flex items-center justify-between gap-4 border-b border-white/5 bg-white/[0.02]">
          {/* Inventory bar */}
          <PlayerInventoryBar inventory={inventory} />

          {/* Quick Controls */}
          <div className="flex items-center gap-2">
            {/* Sound Toggle */}
            <button
              id="sound-toggle-btn"
              onClick={() => {
                SoundFX.playClick(!soundEnabled);
                setSoundEnabled(!soundEnabled);
              }}
              title={soundEnabled ? 'Desativar Som' : 'Ativar Som'}
              className="p-2 rounded-xl bg-gray-900/80 border border-gray-800 hover:border-blue-500/50 text-gray-400 hover:text-blue-300 transition-colors cursor-pointer"
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-gray-600" />}
            </button>

            {/* Close Button */}
            <button
              id="modal-close-btn"
              onClick={() => {
                SoundFX.playClick(soundEnabled);
                onClose();
              }}
              title="Fechar Janela"
              className="p-2 rounded-xl bg-gray-900/80 border border-gray-800 hover:border-red-500/50 text-gray-400 hover:text-red-400 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Immersive UI Hero Title Section */}
        <div className="relative z-20 px-6 sm:px-8 pt-5 pb-3 text-center">
          <p className="text-blue-400 text-xs sm:text-sm font-bold tracking-[0.3em] uppercase mb-1 flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-400 animate-pulse" />
            BÔNUS DE LOGIN
            <Sparkles className="w-4 h-4 text-blue-400 animate-pulse" />
          </p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-gray-400 uppercase">
            RECOMPENSA DIÁRIA
          </h1>
          <p className="text-gray-400 mt-1 text-xs sm:text-sm md:text-base font-normal">
            Volte todos os dias para desbloquear itens lendários e fortalecer seus atributos
          </p>

          {/* Streak & Timer Info Strip */}
          <div className="mt-4 inline-flex flex-wrap items-center justify-center gap-3 sm:gap-6 px-4 py-1.5 rounded-full bg-white/[0.04] border border-white/5 text-xs">
            <div className="flex items-center gap-1.5 text-blue-300 font-bold uppercase tracking-wider">
              <Flame className="w-4 h-4 text-blue-400 fill-blue-400/30" />
              Sequência: {claimedDays.length} / 7 Dias
            </div>
            <span className="text-gray-600 hidden sm:inline">•</span>
            <div className="flex items-center gap-1.5 text-gray-400">
              <Clock className="w-3.5 h-3.5 text-blue-400" />
              <span>Próximo ciclo em:</span>
              <span className="font-bold text-blue-200 tracking-wider">
                {formatTwoDigits(timeLeft.hours)}h {formatTwoDigits(timeLeft.minutes)}m{' '}
                {formatTwoDigits(timeLeft.seconds)}s
              </span>
            </div>
          </div>
        </div>

        {/* Rewards Content Grid */}
        <div className="px-6 sm:px-8 py-4 space-y-4 max-h-[58vh] overflow-y-auto">
          {/* Main 4-Column Immersive Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
            {DAILY_REWARDS_DATA.slice(0, 6).map((reward) => (
              <RewardCard
                key={reward.day}
                reward={reward}
                status={getDayStatus(reward.day)}
                isToday={reward.day === currentDay}
                onClaim={() => handleClaim(reward.day)}
                soundEnabled={soundEnabled}
                onItemHover={(name, description) => setHoveredItem({ name, description })}
              />
            ))}

            {/* Day 7 Grand Reward (2-Column Span) */}
            {DAILY_REWARDS_DATA[6] && (
              <RewardCard
                reward={DAILY_REWARDS_DATA[6]}
                status={getDayStatus(7)}
                isToday={currentDay === 7}
                onClaim={() => handleClaim(7)}
                soundEnabled={soundEnabled}
                onItemHover={(name, description) => setHoveredItem({ name, description })}
              />
            )}
          </div>

          {/* Hover Item Inspector / Tooltip Bar */}
          {hoveredItem && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 rounded-2xl bg-blue-950/40 border border-blue-500/30 text-xs flex items-center justify-between gap-4 text-gray-300"
            >
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-blue-400 shrink-0" />
                <span>
                  <strong className="text-white">{hoveredItem.name}:</strong> {hoveredItem.description}
                </span>
              </div>
              <button
                onClick={() => setHoveredItem(null)}
                className="text-gray-400 hover:text-white text-[10px] uppercase font-bold tracking-wider cursor-pointer"
              >
                Dispensar
              </button>
            </motion.div>
          )}
        </div>

        {/* Immersive UI Bottom CTA Section */}
        <div className="relative z-20 px-6 sm:px-8 py-5 border-t border-white/10 bg-[#06070b] flex flex-col items-center justify-center">
          {/* Main Rounded Action Button */}
          {isTodayAvailable ? (
            <motion.button
              id="main-claim-highlighted-btn"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => handleClaim(currentDay)}
              className="group relative px-10 sm:px-16 md:px-20 py-3.5 sm:py-4 bg-gradient-to-r from-blue-600 via-blue-500 to-blue-400 rounded-full shadow-[0_0_40px_rgba(37,99,235,0.45)] hover:shadow-[0_0_50px_rgba(37,99,235,0.7)] transition-all cursor-pointer overflow-hidden flex items-center justify-center gap-3"
            >
              {/* Inner ambient glow on hover */}
              <div className="absolute inset-0 bg-white/20 rounded-full opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-300 pointer-events-none" />
              <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/30 to-transparent" />

              <Sparkles className="w-5 h-5 fill-white text-white animate-spin" style={{ animationDuration: '6s' }} />
              <span className="relative text-base sm:text-lg md:text-xl font-black uppercase italic tracking-widest text-white drop-shadow-md">
                RESGATAR RECOMPENSA (DIA {currentDay})
              </span>
            </motion.button>
          ) : (
            <button
              id="main-claim-disabled-btn"
              disabled
              className="px-10 sm:px-14 py-3.5 sm:py-4 rounded-full bg-gray-900 border border-gray-800 text-gray-500 font-bold uppercase tracking-widest text-xs sm:text-sm cursor-not-allowed flex items-center justify-center gap-2"
            >
              <span>COLETADO HOJE • RETORNE AMANHÃ</span>
            </button>
          )}

          {/* Immersive UI Status Legend */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-6 sm:gap-8 text-[11px] font-bold uppercase tracking-widest text-gray-400">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
              <span>Coletado</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]"></div>
              <span>Disponível</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-gray-700"></div>
              <span>Bloqueado</span>
            </div>
          </div>
        </div>

        {/* Development & Showcase Testing Toolbar (Dev bar) */}
        <div className="px-6 sm:px-8 py-2 bg-[#040407] border-t border-gray-900 flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-400">
          <div className="flex items-center gap-2">
            <span className="font-bold text-blue-400 uppercase">Demonstração:</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Quick Day Selector */}
            <div className="flex items-center gap-1 mr-2">
              <span className="text-gray-500">Dia Ativo:</span>
              {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                <button
                  key={d}
                  onClick={() => {
                    SoundFX.playClick(soundEnabled);
                    setCurrentDay(d);
                  }}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    currentDay === d
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  D{d}
                </button>
              ))}
            </div>

            <button
              id="dev-advance-day-btn"
              onClick={handleNextDay}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-300 hover:text-white transition-colors cursor-pointer"
            >
              <FastForward className="w-3 h-3 text-blue-400" />
              Avançar Dia (+1)
            </button>

            <button
              id="dev-reset-btn"
              onClick={handleReset}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-300 hover:text-white transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3 text-red-400" />
              Resetar Tudo
            </button>
          </div>
        </div>
      </motion.div>

      {/* Reward Claim Celebration Modal */}
      <ClaimCelebrationModal
        isOpen={!!celebrationReward}
        reward={celebrationReward}
        onClose={() => setCelebrationReward(null)}
        soundEnabled={soundEnabled}
      />
    </div>
  );
};
