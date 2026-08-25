import { Rarity, ElementType } from '../types';

export interface RarityConfig {
  label: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  cardBg: string;
  cardBorder: string;
  glowColor: string;
  textColor: string;
  accentGradient: string;
}

export const RARITY_CONFIG: Record<Rarity, RarityConfig> = {
  comum: {
    label: 'Comum',
    badgeBg: 'bg-white/10',
    badgeText: 'text-white/70',
    badgeBorder: 'border-white/20',
    cardBg: 'bg-slate-800/30',
    cardBorder: 'border-white/10 hover:border-white/30',
    glowColor: 'rgba(255, 255, 255, 0.08)',
    textColor: 'text-white/70',
    accentGradient: 'from-slate-800/80 via-transparent to-transparent',
  },
  incomum: {
    label: 'Incomum',
    badgeBg: 'bg-emerald-500/20',
    badgeText: 'text-emerald-300',
    badgeBorder: 'border-emerald-500/40',
    cardBg: 'bg-slate-800/40',
    cardBorder: 'border-emerald-500/40 hover:border-emerald-400/70',
    glowColor: 'rgba(16, 185, 129, 0.2)',
    textColor: 'text-emerald-300',
    accentGradient: 'from-emerald-900/70 via-transparent to-transparent',
  },
  raro: {
    label: 'Raro',
    badgeBg: 'bg-blue-500/20',
    badgeText: 'text-blue-300',
    badgeBorder: 'border-blue-500/40',
    cardBg: 'bg-slate-800/40',
    cardBorder: 'border-blue-500/50 hover:border-blue-400',
    glowColor: 'rgba(59, 130, 246, 0.25)',
    textColor: 'text-blue-300',
    accentGradient: 'from-blue-900/80 via-transparent to-transparent',
  },
  epico: {
    label: 'Épico',
    badgeBg: 'bg-purple-500/20',
    badgeText: 'text-purple-300',
    badgeBorder: 'border-purple-500/40',
    cardBg: 'bg-slate-800/40',
    cardBorder: 'border-purple-500/50 hover:border-purple-400',
    glowColor: 'rgba(168, 85, 247, 0.25)',
    textColor: 'text-purple-300',
    accentGradient: 'from-purple-900/80 via-transparent to-transparent',
  },
  lendario: {
    label: 'Lendário',
    badgeBg: 'bg-yellow-500 text-black',
    badgeText: 'text-black',
    badgeBorder: 'border-yellow-400',
    cardBg: 'bg-slate-800/40',
    cardBorder: 'border-yellow-500/50 hover:border-yellow-400',
    glowColor: 'rgba(234, 179, 8, 0.25)',
    textColor: 'text-yellow-300',
    accentGradient: 'from-yellow-900/80 via-transparent to-transparent',
  },
  mitico: {
    label: 'Mítico',
    badgeBg: 'bg-rose-500 text-white',
    badgeText: 'text-white',
    badgeBorder: 'border-rose-400',
    cardBg: 'bg-slate-800/40',
    cardBorder: 'border-rose-500/50 hover:border-rose-400',
    glowColor: 'rgba(244, 63, 94, 0.28)',
    textColor: 'text-rose-300',
    accentGradient: 'from-rose-900/80 via-transparent to-transparent',
  },
  supremo: {
    label: 'Supremo',
    badgeBg: 'bg-gradient-to-r from-cyan-400 to-blue-500 text-black',
    badgeText: 'text-black',
    badgeBorder: 'border-cyan-300',
    cardBg: 'bg-slate-800/40',
    cardBorder: 'border-cyan-400/60 hover:border-cyan-300',
    glowColor: 'rgba(6, 182, 212, 0.35)',
    textColor: 'text-cyan-300',
    accentGradient: 'from-cyan-900/80 via-purple-900/40 to-transparent',
  },
};

export const ELEMENT_CONFIG: Record<ElementType, { label: string; color: string; icon: string; bg: string }> = {
  fogo: { label: 'Fogo', color: 'text-orange-400', icon: 'Flame', bg: 'bg-orange-500/15 border-orange-500/30' },
  trovao: { label: 'Trovão', color: 'text-yellow-400', icon: 'Zap', bg: 'bg-yellow-500/15 border-yellow-500/30' },
  vento: { label: 'Vento', color: 'text-emerald-400', icon: 'Wind', bg: 'bg-emerald-500/15 border-emerald-500/30' },
  agua: { label: 'Água', color: 'text-blue-400', icon: 'Droplets', bg: 'bg-blue-500/15 border-blue-500/30' },
  terra: { label: 'Terra', color: 'text-amber-600', icon: 'Mountain', bg: 'bg-amber-700/15 border-amber-700/30' },
  luz: { label: 'Luz', color: 'text-amber-200', icon: 'Sun', bg: 'bg-amber-200/15 border-amber-200/30' },
  trevas: { label: 'Trevas', color: 'text-purple-400', icon: 'Moon', bg: 'bg-purple-900/20 border-purple-500/30' },
};
