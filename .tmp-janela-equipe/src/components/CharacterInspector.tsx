import React from 'react';
import { Character } from '../types';
import { RARITY_CONFIG, ELEMENT_CONFIG } from '../utils/rarity';
import { sound } from '../utils/audio';
import confetti from 'canvas-confetti';
import {
  Crown,
  Star,
  Lock,
  Unlock,
  Anvil,
  Zap,
  Flame,
  Wind,
  Droplets,
  Mountain,
  Sun,
  Moon,
  Sparkles,
  Shield,
  Sword,
  Activity,
  Heart,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Award,
  BookOpen,
  Info,
  Coins
} from 'lucide-react';

interface CharacterInspectorProps {
  character: Character;
  isLeader: boolean;
  isInTeam: boolean;
  userCopper: number;
  userAwakeningMaterials: number;
  onToggleFavorite: (id: string) => void;
  onToggleLock: (id: string) => void;
  onSetLeader: (id: string) => void;
  onToggleTeamMember: (id: string) => void;
  onAwaken: (id: string) => void;
  onAddMasteryXp: (id: string, amount: number) => void;
  onResetMastery: (id: string) => void;
  onAddStars: (id: string) => void;
  onOpenForge: () => void;
  onOpenSkills: () => void;
}

export const CharacterInspector: React.FC<CharacterInspectorProps> = ({
  character,
  isLeader,
  isInTeam,
  userCopper,
  userAwakeningMaterials,
  onToggleFavorite,
  onToggleLock,
  onSetLeader,
  onToggleTeamMember,
  onAwaken,
  onAddMasteryXp,
  onResetMastery,
  onAddStars,
  onOpenForge,
  onOpenSkills,
}) => {
  const rarity = RARITY_CONFIG[character.rarity];
  const element = ELEMENT_CONFIG[character.element];

  // Calculate Awakening Requirements for current stage
  const nextAwakeningStage = character.awakeningStage + 1;
  const isMaxAwakened = character.awakeningStage >= 3;

  const reqLevel = nextAwakeningStage === 1 ? 20 : nextAwakeningStage === 2 ? 40 : 60;
  const reqStars = nextAwakeningStage === 1 ? 1 : nextAwakeningStage === 2 ? 2 : 3;
  const reqMastery = nextAwakeningStage === 1 ? 25 : nextAwakeningStage === 2 ? 50 : 75;
  const reqMaterial = nextAwakeningStage === 1 ? 1 : nextAwakeningStage === 2 ? 3 : 5;
  const reqCopper = nextAwakeningStage === 1 ? 1000 : nextAwakeningStage === 2 ? 5000 : 15000;

  const hasLevel = character.level >= reqLevel;
  const hasStars = character.stars >= reqStars;
  const hasMastery = character.masteryLevel >= reqMastery;
  const hasMaterial = userAwakeningMaterials >= reqMaterial;
  const hasCopper = userCopper >= reqCopper;

  const canAwaken = !isMaxAwakened && hasLevel && hasStars && hasMastery && hasMaterial && hasCopper;

  const handleAwakenClick = () => {
    if (!canAwaken) return;
    sound.playAwaken();
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#F59E0B', '#A855F7', '#38BDF8', '#10B981'],
    });
    onAwaken(character.id);
  };

  const renderElementIcon = (elem: Character['element']) => {
    switch (elem) {
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
    <div id="character-inspector" className="bg-gradient-to-br from-blue-900/20 via-slate-900/40 to-[#05070a] rounded-2xl border border-blue-500/20 p-5 sm:p-6 backdrop-blur-xl relative overflow-hidden shadow-2xl flex flex-col gap-6">
      {/* Background Watermark & ambient glow */}
      <div className="absolute -top-4 -right-2 opacity-[0.04] text-9xl font-black italic select-none pointer-events-none text-blue-300">
        {character.rarity.toUpperCase()}
      </div>
      <div className="absolute top-0 right-1/4 w-72 h-72 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Banner: Hero Overview & Meta */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-white/10">
        <div className="flex items-start gap-4">
          {/* Avatar Container with glowing frame */}
          <div className="relative group flex-shrink-0">
            <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border-2 ${rarity.badgeBorder} shadow-[0_0_25px_${rarity.glowColor}] bg-black/60`}>
              <img
                src={character.avatarUrl}
                alt={character.name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>
            <div className="absolute -bottom-2 -right-2 px-2 py-0.5 rounded-lg bg-black/80 border border-white/15 flex items-center gap-1 shadow-md">
              {renderElementIcon(character.element)}
              <span className={`text-[9px] font-bold ${element.color}`}>{element.label}</span>
            </div>
          </div>

          {/* Name, Title, Level & Stars */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 mb-1">
              <div className="text-yellow-500 text-xs font-bold tracking-[0.2em] uppercase">
                Lv. {character.level}
              </div>
              <div className="w-1 h-1 bg-white/20 rounded-full"></div>
              <div className="text-white/60 text-xs font-bold tracking-[0.2em] uppercase">
                {character.role}
              </div>
              <div className="w-1 h-1 bg-white/20 rounded-full"></div>
              <span className={`text-[9px] px-2 py-0.5 font-bold rounded italic uppercase tracking-wider border ${rarity.badgeBg} ${rarity.badgeBorder} ${rarity.badgeText}`}>
                {rarity.label}
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black italic tracking-tight uppercase leading-none text-white">
              {character.name}
            </h2>
            <p className="text-xs text-white/50">{character.title}</p>

            {/* Stars row */}
            <div className="flex items-center gap-2 pt-1">
              <div className="flex gap-1 text-yellow-500 text-xs">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span key={i} className={i < character.stars ? 'text-yellow-400' : 'text-white/20'}>★</span>
                ))}
              </div>
              <span className="text-[10px] text-white/40 font-mono">
                ({character.stars}/5 Estrelas)
              </span>
            </div>
          </div>
        </div>

        {/* Quick Toggles: Lock, Favorite, Forja, Skills */}
        <div className="flex items-center gap-1.5 self-start">
          <button
            id="btn-favorite-char"
            onClick={() => {
              sound.playSelect();
              onToggleFavorite(character.id);
            }}
            className={`w-9 h-9 rounded-lg border flex items-center justify-center text-xs transition cursor-pointer ${
              character.isFavorite
                ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400'
                : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/40 hover:text-white'
            }`}
            title={character.isFavorite ? 'Favoritado' : 'Favoritar'}
          >
            <Star className={`w-4 h-4 ${character.isFavorite ? 'fill-yellow-400' : ''}`} />
          </button>

          <button
            id="btn-lock-char"
            onClick={() => {
              sound.playLockToggle();
              onToggleLock(character.id);
            }}
            className={`w-9 h-9 rounded-lg border flex items-center justify-center text-xs transition cursor-pointer ${
              character.isLocked
                ? 'bg-rose-500/20 border-rose-500/50 text-rose-400'
                : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/40 hover:text-white'
            }`}
            title={character.isLocked ? 'Bloqueado contra descarte' : 'Desbloqueado'}
          >
            {character.isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
          </button>

          <button
            id="btn-open-forge"
            onClick={() => {
              sound.playSelect();
              onOpenForge();
            }}
            className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-yellow-300 flex items-center justify-center transition cursor-pointer"
            title="Forja de Equipamentos"
          >
            <Anvil className="w-4 h-4" />
          </button>

          <button
            id="btn-open-skills"
            onClick={() => {
              sound.playSelect();
              onOpenSkills();
            }}
            className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-blue-300 flex items-center justify-center transition cursor-pointer"
            title="Grimório de Jutsus"
          >
            <BookOpen className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Attributes Meters (Immersive UI Style) */}
      <div className="space-y-3.5 relative z-10">
        {/* Ataque */}
        <div className="group">
          <div className="flex justify-between text-[10px] uppercase font-bold mb-1.5">
            <span className="text-white/40 group-hover:text-white/70 tracking-wider flex items-center gap-1.5">
              <Sword className="w-3.5 h-3.5 text-blue-400" /> Ataque Base
            </span>
            <span className="text-blue-300 font-mono font-bold">{character.atk.toLocaleString('pt-BR')}</span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all duration-300"
              style={{ width: `${Math.min((character.atk / 1500) * 100, 100)}%` }}
            />
          </div>
        </div>

        {/* Defesa */}
        <div className="group">
          <div className="flex justify-between text-[10px] uppercase font-bold mb-1.5">
            <span className="text-white/40 group-hover:text-white/70 tracking-wider flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-blue-400" /> Defesa (Crit {character.critRate}%)
            </span>
            <span className="text-blue-300 font-mono font-bold">{character.def.toLocaleString('pt-BR')}</span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all duration-300"
              style={{ width: `${Math.min((character.def / 1200) * 100, 100)}%` }}
            />
          </div>
        </div>

        {/* Pontos de Vida (HP) */}
        <div className="group">
          <div className="flex justify-between text-[10px] uppercase font-bold mb-1.5">
            <span className="text-white/40 group-hover:text-white/70 tracking-wider flex items-center gap-1.5">
              <Heart className="w-3.5 h-3.5 text-rose-400" /> Pontos de Vida (HP)
            </span>
            <span className="text-rose-300 font-mono font-bold">{character.hp} / {character.maxHp}</span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-rose-600 to-rose-400 rounded-full transition-all duration-300"
              style={{ width: `${Math.min((character.hp / character.maxHp) * 100, 100)}%` }}
            />
          </div>
        </div>

        {/* Chakra / Mana */}
        <div className="group">
          <div className="flex justify-between text-[10px] uppercase font-bold mb-1.5">
            <span className="text-white/40 group-hover:text-white/70 tracking-wider flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-yellow-400" /> Chakra / Mana
            </span>
            <span className="text-yellow-300 font-mono font-bold">{character.chakra} / {character.maxChakra}</span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-yellow-600 to-yellow-400 rounded-full transition-all duration-300"
              style={{ width: `${Math.min((character.chakra / character.maxChakra) * 100, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Maestria Section */}
      <div id="mastery-section" className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-2.5 relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-white/80">
              Maestria do Herói
            </span>
          </div>
          <span className="text-xs font-bold font-mono text-blue-300">
            Lv. {character.masteryLevel} <span className="text-white/30">/ 100</span>
          </span>
        </div>

        <div className="space-y-1">
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 rounded-full transition-all duration-300"
              style={{ width: `${Math.min((character.masteryXp / character.maxMasteryXp) * 100, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-white/40 font-mono">
            <span>XP: {character.masteryXp} / {character.maxMasteryXp}</span>
            <span>Só o herói ativo ganha XP em combate</span>
          </div>
        </div>
      </div>

      {/* Despertar Section */}
      <div id="awakening-section" className="p-4 sm:p-5 rounded-xl bg-gradient-to-b from-purple-950/20 to-black/40 border border-purple-500/20 space-y-3.5 relative z-10">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <h3 className="text-xs font-black italic tracking-wider uppercase text-purple-300">
              Despertar de Combate
            </h3>
            <span className="px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 text-[10px] font-bold">
              {character.awakeningStage} / 3
            </span>
          </div>

          <div className="text-[10px] text-white/50 font-mono">
            Cristais: <strong className="text-purple-300">{userAwakeningMaterials}</strong> | Cobre: <strong className="text-yellow-400">{userCopper.toLocaleString('pt-BR')}</strong>
          </div>
        </div>

        {!isMaxAwakened ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
              <div className={`p-2 rounded-lg border flex items-center justify-between ${
                hasLevel ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-white/5 border-white/10 text-white/40'
              }`}>
                <span>Nível {reqLevel}</span>
                {hasLevel ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <XCircle className="w-3.5 h-3.5 text-white/30" />}
              </div>

              <div className={`p-2 rounded-lg border flex items-center justify-between ${
                hasStars ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-white/5 border-white/10 text-white/40'
              }`}>
                <span>{reqStars}★ Estrelas</span>
                {hasStars ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <XCircle className="w-3.5 h-3.5 text-white/30" />}
              </div>

              <div className={`p-2 rounded-lg border flex items-center justify-between ${
                hasMastery ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-white/5 border-white/10 text-white/40'
              }`}>
                <span>Maestria {reqMastery}</span>
                {hasMastery ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <XCircle className="w-3.5 h-3.5 text-white/30" />}
              </div>

              <div className={`p-2 rounded-lg border flex items-center justify-between ${
                hasMaterial ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-white/5 border-white/10 text-white/40'
              }`}>
                <span>{reqMaterial}x Cristal</span>
                {hasMaterial ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <XCircle className="w-3.5 h-3.5 text-white/30" />}
              </div>

              <div className={`p-2 rounded-lg border flex items-center justify-between col-span-2 ${
                hasCopper ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-white/5 border-white/10 text-white/40'
              }`}>
                <span>{reqCopper.toLocaleString('pt-BR')} Cobre</span>
                {hasCopper ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <XCircle className="w-3.5 h-3.5 text-white/30" />}
              </div>
            </div>

            <button
              id="btn-awaken-char"
              onClick={handleAwakenClick}
              disabled={!canAwaken}
              className={`w-full py-2.5 rounded-xl text-xs font-black italic tracking-widest uppercase transition flex items-center justify-center gap-2 cursor-pointer ${
                canAwaken
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-[0_5px_15px_rgba(168,85,247,0.3)]'
                  : 'bg-white/5 text-white/30 border border-white/10 cursor-not-allowed'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Despertar {['I', 'II', 'III'][character.awakeningStage]} (+20% em Todos os Atributos)
            </button>
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 text-center text-xs font-bold text-yellow-300 uppercase tracking-wider">
            ★ Potencial Divino Máximo Desperto (Estágio III)
          </div>
        )}
      </div>

      {/* Main Big CTA Button (As shown in Immersive UI: "Adicionar à Equipe" or "Líder Ativo") */}
      <div className="relative z-10 pt-1 mt-auto">
        {isInTeam ? (
          <div className="flex gap-2">
            <button
              onClick={() => {
                sound.playClick();
                onSetLeader(character.id);
              }}
              className={`flex-1 py-3.5 sm:py-4 font-black italic tracking-widest uppercase rounded-xl border-t border-white/30 transition-all cursor-pointer shadow-lg text-xs sm:text-sm ${
                isLeader
                  ? 'bg-yellow-500 hover:bg-yellow-400 text-black shadow-[0_10px_20px_rgba(234,179,8,0.3)]'
                  : 'bg-slate-800 hover:bg-slate-700 text-white'
              }`}
            >
              {isLeader ? '👑 Líder Ativo da Equipe' : 'Definir como Líder'}
            </button>

            <button
              onClick={() => {
                sound.playClick();
                onToggleTeamMember(character.id);
              }}
              className="px-4 py-3.5 rounded-xl bg-white/5 hover:bg-rose-950/80 border border-white/10 hover:border-rose-500 text-white/50 hover:text-rose-300 text-xs font-bold uppercase tracking-wider transition cursor-pointer"
              title="Remover da equipe"
            >
              Remover
            </button>
          </div>
        ) : (
          <button
            id="btn-add-to-team"
            onClick={() => {
              sound.playEquip();
              onToggleTeamMember(character.id);
            }}
            className="w-full py-3.5 sm:py-4 bg-blue-600 hover:bg-blue-500 text-white font-black italic tracking-widest uppercase rounded-xl border-t border-white/30 shadow-[0_10px_20px_rgba(37,99,235,0.3)] transition-all cursor-pointer text-xs sm:text-sm flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            Adicionar à Equipe
          </button>
        )}
      </div>
    </div>
  );
};
