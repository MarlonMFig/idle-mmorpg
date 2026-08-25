import React from 'react';
import { Character } from '../types';
import { RARITY_CONFIG, ELEMENT_CONFIG } from '../utils/rarity';
import { sound } from '../utils/audio';
import { 
  Crown, 
  Plus, 
  X, 
  ShieldAlert, 
  Swords, 
  Sparkles, 
  Flame, 
  Zap, 
  Wind, 
  Droplets, 
  Mountain, 
  Sun, 
  Moon,
  ChevronRight,
  Award
} from 'lucide-react';

interface TeamFormationProps {
  slots: (Character | null)[];
  leaderSlotIndex: number;
  selectedCharId: string | null;
  onSelectCharacter: (char: Character) => void;
  onRemoveFromSlot: (slotIndex: number) => void;
  onSetLeader: (slotIndex: number) => void;
  onEmptySlotClick: (slotIndex: number) => void;
}

export const TeamFormation: React.FC<TeamFormationProps> = ({
  slots,
  leaderSlotIndex,
  selectedCharId,
  onSelectCharacter,
  onRemoveFromSlot,
  onSetLeader,
  onEmptySlotClick,
}) => {
  // Calculate total battle power (CP)
  const totalCP = slots.reduce((acc, char) => {
    if (!char) return acc;
    return acc + (char.atk * 3 + char.def * 2 + char.hp / 10 + char.speed * 2 + char.level * 25 + char.awakeningStage * 300);
  }, 0);

  const activeCount = slots.filter(Boolean).length;

  const renderElementIcon = (element: Character['element']) => {
    switch (element) {
      case 'fogo': return <Flame className="w-3.5 h-3.5 text-orange-400" />;
      case 'trovao': return <Zap className="w-3.5 h-3.5 text-yellow-400" />;
      case 'vento': return <Wind className="w-3.5 h-3.5 text-emerald-400" />;
      case 'agua': return <Droplets className="w-3.5 h-3.5 text-blue-400" />;
      case 'terra': return <Mountain className="w-3.5 h-3.5 text-amber-600" />;
      case 'luz': return <Sun className="w-3.5 h-3.5 text-amber-200" />;
      case 'trevas': return <Moon className="w-3.5 h-3.5 text-purple-400" />;
    }
  };

  return (
    <div id="team-formation-panel" className="bg-[#05070a]/60 border border-white/10 rounded-2xl p-5 backdrop-blur-xl relative overflow-hidden shadow-2xl">
      {/* Background ambient glow */}
      <div className="absolute -top-24 -left-24 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-inner">
            <Swords className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black tracking-wider italic uppercase font-['Rajdhani'] text-white">
                Formação de Combate
              </h2>
              <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300">
                {activeCount}/3 Ativos
              </span>
            </div>
            <p className="text-xs text-white/50">
              O Líder concede sua aura e bônus de combate para todos os aliados
            </p>
          </div>
        </div>

        {/* Combat Power (CP) Badge */}
        <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-slate-900/80 border border-white/10">
          <Sparkles className="w-4 h-4 text-yellow-400 animate-pulse" />
          <div className="text-right">
            <div className="text-[10px] uppercase font-bold tracking-widest text-white/40">Poder de Luta</div>
            <div className="text-lg sm:text-xl font-black font-mono text-yellow-400 leading-none">
              {Math.round(totalCP).toLocaleString('pt-BR')}
            </div>
          </div>
        </div>
      </div>

      {/* 3 Slots Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
        {slots.map((char, index) => {
          const isLeader = index === leaderSlotIndex && char !== null;
          const isSelected = char && selectedCharId === char.id;

          if (!char) {
            return (
              <button
                key={`empty-slot-${index}`}
                id={`team-slot-empty-${index}`}
                onClick={() => {
                  sound.playClick();
                  onEmptySlotClick(index);
                }}
                className="w-full min-h-[220px] bg-white/5 border border-dashed border-white/20 rounded-xl flex flex-col items-center justify-center gap-2.5 group cursor-pointer hover:bg-white/10 hover:border-blue-400/50 transition-all p-5 text-center"
              >
                <div className="w-11 h-11 rounded-full border border-white/30 flex items-center justify-center text-2xl text-white/30 group-hover:text-blue-300 group-hover:border-blue-400 group-hover:scale-110 transition-all shadow-lg">
                  +
                </div>
                <div className="text-xs font-bold text-white/70 group-hover:text-white uppercase tracking-wider">
                  {index === 0 ? 'Posição Líder (Vazio)' : `Posição ${index + 1} Vazia`}
                </div>
                <div className="text-[10px] text-white/40 group-hover:text-blue-300 uppercase tracking-widest">
                  Clique para Equipar
                </div>
                <div className="text-[9px] font-mono text-white/30 px-2 py-0.5 rounded bg-black/40 border border-white/5 mt-1">
                  SLOT 0{index + 1}
                </div>
              </button>
            );
          }

          const rarity = RARITY_CONFIG[char.rarity];
          const element = ELEMENT_CONFIG[char.element];

          return (
            <div
              key={char.id}
              id={`team-slot-${index}`}
              onClick={() => {
                sound.playSelect();
                onSelectCharacter(char);
              }}
              className={`w-full min-h-[220px] rounded-xl border relative overflow-hidden transition-all duration-300 cursor-pointer p-4 flex flex-col justify-between group ${
                isSelected
                  ? 'border-blue-400 bg-slate-800/80 shadow-[0_0_30px_rgba(59,130,246,0.3)] ring-2 ring-blue-400/30'
                  : `bg-slate-800/40 ${rarity.cardBorder} hover:border-white/40 shadow-[0_0_25px_${rarity.glowColor}]`
              }`}
            >
              {/* Card Bottom / Top Gradient Overlay (Immersive design) */}
              <div className={`absolute inset-0 bg-gradient-to-t ${rarity.accentGradient} pointer-events-none opacity-80`} />

              {/* Slot Header with Tag */}
              <div className="relative z-10 flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`text-[9px] px-2 py-0.5 font-bold rounded italic uppercase tracking-wider border ${rarity.badgeBg} ${rarity.badgeBorder} ${rarity.badgeText}`}>
                    {rarity.label}
                  </span>

                  {isLeader && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-yellow-500/20 border border-yellow-500/50 text-yellow-300 text-[9px] font-bold uppercase tracking-wider">
                      <Crown className="w-2.5 h-2.5 fill-yellow-400" />
                      Líder
                    </span>
                  )}
                </div>

                {/* Remove button */}
                <button
                  id={`remove-char-${index}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    sound.playClick();
                    onRemoveFromSlot(index);
                  }}
                  className="w-6 h-6 rounded-lg bg-black/50 hover:bg-rose-950 border border-white/10 hover:border-rose-500/60 text-white/50 hover:text-rose-300 flex items-center justify-center transition"
                  title="Remover da equipe"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Character Details in Center / Bottom */}
              <div className="relative z-10 flex items-center gap-3.5 my-3">
                <div className="relative flex-shrink-0">
                  <div className={`w-16 h-16 rounded-xl overflow-hidden border-2 ${isSelected ? 'border-blue-400' : rarity.badgeBorder} bg-black/60 shadow-lg`}>
                    <img
                      src={char.avatarUrl}
                      alt={char.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <div className="absolute -bottom-1 -right-1 p-0.5 rounded-md bg-black/80 border border-white/10">
                    {renderElementIcon(char.element)}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-black italic text-base uppercase tracking-tight text-white truncate">
                      {char.name}
                    </h3>
                  </div>
                  <div className="text-[10px] text-white/60 font-medium truncate">
                    {char.role} • <span className="text-yellow-400 font-bold">Lv. {char.level}</span>
                  </div>

                  <div className="flex gap-0.5 mt-1 text-yellow-400 text-[10px]">
                    {Array.from({ length: Math.min(char.stars, 5) }).map((_, i) => (
                      <span key={i}>★</span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bottom Quick Info & Actions */}
              <div className="relative z-10 pt-2 border-t border-white/10 flex items-center justify-between text-[10px]">
                <div className="text-white/50">
                  Maestria: <strong className="text-white">Lv.{char.masteryLevel}</strong>
                </div>

                {!isLeader && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      sound.playClick();
                      onSetLeader(index);
                    }}
                    className="px-2 py-0.5 rounded bg-white/5 hover:bg-yellow-500/20 border border-white/10 hover:border-yellow-400/50 text-white/60 hover:text-yellow-300 font-bold uppercase tracking-wider transition"
                  >
                    Tornar Líder
                  </button>
                )}

                {isLeader && (
                  <span className="text-yellow-400 font-bold uppercase tracking-wider text-[9px]">
                    Líder Ativo
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Team Synergies & Passive overview */}
      <div className="mt-5 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs text-white/50">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-white/80 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-blue-400" /> Sinergias Ativas:
          </span>
          {activeCount >= 2 ? (
            <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold text-[10px] uppercase tracking-wider">
              ✓ Ressonância (+8% ATK & DEF)
            </span>
          ) : (
            <span className="text-white/40 italic text-[11px]">
              Adicione pelo menos 2 heróis para ativar ressonância
            </span>
          )}
          {slots.some(c => c?.rarity === 'lendario' || c?.rarity === 'mitico' || c?.rarity === 'supremo') && (
            <span className="px-2.5 py-0.5 rounded-md bg-yellow-500/15 border border-yellow-500/30 text-yellow-300 font-bold text-[10px] uppercase tracking-wider">
              ★ Presença Heroica (+10% Crítico)
            </span>
          )}
        </div>

        <div className="text-[10px] uppercase tracking-widest text-white/40">
          Slots Ativos: {activeCount}/3
        </div>
      </div>
    </div>
  );
};
