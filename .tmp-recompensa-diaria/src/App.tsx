import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Gift,
  Shield,
  Swords,
  Sparkles,
  Award,
  Crown,
  ChevronRight,
  Flame,
} from 'lucide-react';
import { DailyRewardModal } from './components/DailyRewardModal';

export default function App() {
  const [isModalOpen, setIsModalOpen] = useState<boolean>(true);

  return (
    <div className="min-h-screen w-full bg-[#050508] text-white flex flex-col items-center justify-between relative overflow-x-hidden select-none font-sans">
      {/* Immersive UI Dynamic Background Atmosphere */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Ambient Dark Cyan & Blue radial glow (top-left) */}
        <div className="absolute -top-32 -left-32 w-[600px] h-[600px] bg-blue-900/20 rounded-full blur-[140px]" />
        {/* Ambient Deep Purple radial glow (bottom-right) */}
        <div className="absolute -bottom-32 -right-32 w-[600px] h-[600px] bg-purple-900/20 rounded-full blur-[140px]" />
        
        {/* Horizontal Laser Line Accent */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-[1px] bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />
      </div>

      {/* Top Game Navigation / HUD Bar */}
      <header
        id="game-header-hud"
        className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between border-b border-white/10 bg-[#050508]/60 backdrop-blur-md"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-400 p-0.5 shadow-[0_0_15px_rgba(59,130,246,0.4)]">
            <div className="w-full h-full rounded-[14px] bg-[#050508] flex items-center justify-center">
              <Crown className="w-5 h-5 text-blue-400" />
            </div>
          </div>
          <div>
            <h2 className="font-bold text-base sm:text-lg tracking-wider text-white uppercase">
              Chronicles of Aethelgard
            </h2>
            <div className="flex items-center gap-2 text-xs text-gray-400 font-semibold">
              <span className="text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                Servidor: Valhalla-01
              </span>
              <span>•</span>
              <span className="text-gray-300">Nvl. 42 Paladino</span>
            </div>
          </div>
        </div>

        {/* Top Status & Trigger Button */}
        <div className="flex items-center gap-3">
          <button
            id="open-daily-reward-btn"
            onClick={() => setIsModalOpen(true)}
            className="relative group px-4 py-2 rounded-full bg-blue-600/20 border border-blue-500/50 hover:border-blue-400 text-blue-300 font-bold text-xs sm:text-sm tracking-wider shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:shadow-[0_0_30px_rgba(59,130,246,0.6)] transition-all flex items-center gap-2 cursor-pointer"
          >
            <div className="relative">
              <Gift className="w-4 h-4 text-blue-400 animate-bounce" style={{ animationDuration: '3s' }} />
              {/* Glowing notification badge */}
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.9)] animate-ping" />
            </div>
            <span>RECOMPENSA DIÁRIA</span>
            <span className="px-1.5 py-0.2 rounded-full bg-blue-500 text-white text-[10px] font-black uppercase">
              1 Nova
            </span>
          </button>
        </div>
      </header>

      {/* Main Game Stage / Hub Screen (visible behind modal or when closed) */}
      <main className="relative z-10 w-full max-w-5xl mx-auto px-4 py-12 flex-1 flex flex-col items-center justify-center text-center">
        {!isModalOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-xl p-8 rounded-3xl bg-[#090a12]/95 border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.9),0_0_30px_rgba(59,130,246,0.15)] text-center space-y-6"
          >
            <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 p-0.5 shadow-[0_0_30px_rgba(59,130,246,0.5)]">
              <div className="w-full h-full rounded-[22px] bg-[#050508] flex items-center justify-center">
                <Award className="w-10 h-10 text-blue-400 animate-pulse" />
              </div>
            </div>

            <div>
              <p className="text-blue-400 text-xs font-bold tracking-[0.3em] uppercase mb-1">
                BÔNUS DE LOGIN
              </p>
              <h3 className="text-2xl sm:text-3xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-gray-400 uppercase">
                Recompensa Diária Disponível!
              </h3>
              <p className="mt-2 text-sm text-gray-400">
                Sua recompensa de aventureiro para hoje está aguardando pelo seu resgate. Não quebre sua sequência para garantir o Baú Mítico no Dia 7.
              </p>
            </div>

            <div className="flex items-center justify-center gap-6 py-2 border-y border-white/5 text-xs text-gray-400">
              <div className="flex items-center gap-1.5 text-blue-300">
                <Flame className="w-4 h-4 text-blue-400" />
                <span>Sequência Ativa</span>
              </div>
              <div className="flex items-center gap-1.5 text-purple-300">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span>Baú Mítico em 7 Dias</span>
              </div>
            </div>

            <button
              id="reopen-modal-center-btn"
              onClick={() => setIsModalOpen(true)}
              className="w-full py-4 px-6 rounded-full font-black uppercase italic tracking-widest text-white bg-gradient-to-r from-blue-600 via-blue-500 to-blue-400 shadow-[0_0_30px_rgba(37,99,235,0.45)] hover:shadow-[0_0_45px_rgba(37,99,235,0.7)] transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Gift className="w-5 h-5 fill-white" />
              ABRIR JANELA DE RECOMPENSA
              <ChevronRight className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </main>

      {/* Footer / Context */}
      <footer className="relative z-10 w-full text-center py-4 border-t border-white/10 text-xs text-gray-500">
        <div className="flex items-center justify-center gap-4">
          <span className="flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-blue-500" />
            Interface de Recompensa Diária
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Swords className="w-3.5 h-3.5 text-blue-500" />
            Immersive UI Theme
          </span>
        </div>
      </footer>

      {/* Primary Daily Reward Modal Component */}
      <AnimatePresence>
        {isModalOpen && (
          <DailyRewardModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
