import React, { useState } from 'react';
import { Character } from '../types';
import { sound } from '../utils/audio';
import { 
  Wrench, 
  Sparkles, 
  ChevronDown, 
  ChevronUp, 
  RotateCcw, 
  Coins, 
  Award, 
  Star, 
  Flame, 
  Zap, 
  Layers,
  ArrowUpCircle
} from 'lucide-react';

interface DevToolsDrawerProps {
  selectedChar: Character;
  userCopper: number;
  userMaterials: number;
  onSetAwakening: (charId: string, stage: number) => void;
  onAddMasteryXp: (charId: string, amount: number) => void;
  onResetMastery: (charId: string) => void;
  onAddCopper: (amount: number) => void;
  onAddMaterials: (amount: number) => void;
  onLevelUpChar: (charId: string, levels: number) => void;
  onAddStarFragments: (charId: string, amount: number) => void;
  onResetChar: (charId: string) => void;
}

export const DevToolsDrawer: React.FC<DevToolsDrawerProps> = ({
  selectedChar,
  userCopper,
  userMaterials,
  onSetAwakening,
  onAddMasteryXp,
  onResetMastery,
  onAddCopper,
  onAddMaterials,
  onLevelUpChar,
  onAddStarFragments,
  onResetChar,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-black/40 border border-white/5 rounded-2xl p-3 sm:p-4 backdrop-blur-xl shadow-2xl">
      {/* Header bar to toggle drawer */}
      <div
        onClick={() => {
          sound.playClick();
          setIsOpen(!isOpen);
        }}
        className="flex items-center justify-between cursor-pointer select-none group"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
            <Wrench className="w-3.5 h-3.5 group-hover:rotate-45 transition-transform" />
          </div>
          <div>
            <span className="text-xs font-bold font-['Rajdhani'] uppercase tracking-widest text-blue-400">
              Painel DEV & Sandbox de Teste
            </span>
            <span className="text-[11px] text-white/40 ml-2 hidden sm:inline">
              (Simule evolução, maestria e materiais do herói {selectedChar.name})
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-white/50 uppercase tracking-wider">
            {isOpen ? 'Ocultar' : 'Expandir Ações DEV'}
          </span>
          {isOpen ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
        </div>
      </div>

      {/* Expanded Tools Content */}
      {isOpen && (
        <div className="mt-4 pt-3 border-t border-white/10 space-y-3.5 text-xs animate-in slide-in-from-top-2 duration-200">
          {/* Despertar Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold text-purple-300 flex items-center gap-1 min-w-[130px]">
              <Sparkles className="w-3.5 h-3.5" /> Despertar DEV:
            </span>
            {[0, 1, 2, 3].map((stage) => (
              <button
                key={stage}
                onClick={() => {
                  sound.playAwaken();
                  onSetAwakening(selectedChar.id, stage);
                }}
                className={`px-2.5 py-1 rounded-lg font-mono font-bold text-[11px] transition cursor-pointer ${
                  selectedChar.awakeningStage === stage
                    ? 'bg-purple-600 text-white shadow-[0_0_10px_rgba(168,85,247,0.4)]'
                    : 'bg-white/5 hover:bg-white/10 text-white/70 border border-white/10'
                }`}
              >
                DEV Set {stage}
              </button>
            ))}
            <button
              onClick={() => {
                sound.playClick();
                onSetAwakening(selectedChar.id, 0);
              }}
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white text-[11px] border border-white/10 cursor-pointer"
            >
              Reset Despertar
            </button>
          </div>

          {/* Mastery Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold text-blue-300 flex items-center gap-1 min-w-[130px]">
              <Award className="w-3.5 h-3.5" /> Maestria DEV:
            </span>
            <button
              onClick={() => {
                sound.playSelect();
                onAddMasteryXp(selectedChar.id, 50);
              }}
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-blue-300 font-mono text-[11px] border border-blue-500/30 cursor-pointer"
            >
              DEV +50 M.XP
            </button>
            <button
              onClick={() => {
                sound.playSelect();
                onAddMasteryXp(selectedChar.id, 100);
              }}
              className="px-2.5 py-1 rounded-lg bg-blue-600/30 hover:bg-blue-600/40 text-blue-200 font-mono font-bold text-[11px] border border-blue-500/50 cursor-pointer"
            >
              DEV +100 M.XP
            </button>
            <button
              onClick={() => {
                sound.playClick();
                onResetMastery(selectedChar.id);
              }}
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white text-[11px] border border-white/10 cursor-pointer"
            >
              DEV Reset Maestria
            </button>
          </div>

          {/* Currencies & Resources */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold text-emerald-300 flex items-center gap-1 min-w-[130px]">
              <Coins className="w-3.5 h-3.5" /> Recursos & Moedas:
            </span>
            <button
              onClick={() => {
                sound.playClick();
                onAddCopper(5000);
              }}
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-emerald-300 font-mono text-[11px] border border-emerald-500/30 cursor-pointer"
            >
              +5.000 Cobre
            </button>
            <button
              onClick={() => {
                sound.playClick();
                onAddCopper(25000);
              }}
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-emerald-300 font-mono text-[11px] border border-emerald-500/30 cursor-pointer"
            >
              +25.000 Cobre
            </button>
            <button
              onClick={() => {
                sound.playClick();
                onAddMaterials(3);
              }}
              className="px-2.5 py-1 rounded-lg bg-purple-950/40 hover:bg-purple-900/40 text-purple-300 font-mono text-[11px] border border-purple-700/50 cursor-pointer"
            >
              +3 Mat. Despertar
            </button>
          </div>

          {/* Level & Stars Quick Boost */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold text-sky-300 flex items-center gap-1 min-w-[130px]">
              <ArrowUpCircle className="w-3.5 h-3.5" /> Nível & Fragmentos:
            </span>
            <button
              onClick={() => {
                sound.playSelect();
                onLevelUpChar(selectedChar.id, 5);
              }}
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-sky-300 font-mono text-[11px] border border-sky-500/30 cursor-pointer"
            >
              +5 Níveis
            </button>
            <button
              onClick={() => {
                sound.playSelect();
                onLevelUpChar(selectedChar.id, 20);
              }}
              className="px-2.5 py-1 rounded-lg bg-sky-950/40 hover:bg-sky-900/40 text-sky-300 font-mono text-[11px] border border-sky-600/40 cursor-pointer"
            >
              +20 Níveis (Req. Despertar)
            </button>
            <button
              onClick={() => {
                sound.playSelect();
                onAddStarFragments(selectedChar.id, 5);
              }}
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-yellow-300 font-mono text-[11px] border border-yellow-500/30 cursor-pointer"
            >
              +5 Frags Estrela
            </button>
            <button
              onClick={() => {
                sound.playClick();
                onResetChar(selectedChar.id);
              }}
              className="px-2.5 py-1 rounded-lg bg-rose-950/30 hover:bg-rose-900/40 text-rose-300 text-[11px] border border-rose-800/40 cursor-pointer ml-auto"
            >
              Resetar Herói para Padrão
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
