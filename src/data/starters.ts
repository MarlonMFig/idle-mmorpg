import type { StarterCharacterId } from '@/types/player-creation';

export interface StarterDefinition {
  id: StarterCharacterId;
  name: string;
  epithet: string;
  /** Cor de destaque no seletor. */
  accent: string;
  /** Cor secundária (aura / CTA offset). */
  accentSoft: string;
  blurb: string;
  element: string;
  elementIcon: string;
  /** Preview na tela de criação. */
  previewUrl: string;
}

export const STARTERS: readonly StarterDefinition[] = [
  {
    id: 'naruto-classic',
    name: 'Naruto',
    epithet: 'Genin de Konoha',
    accent: '#f97316',
    accentSoft: '#fbbf24',
    blurb: 'Rasengan e Oodama Rasengan. Ofensiva versátil.',
    element: 'Vento',
    elementIcon: '🌪️',
    previewUrl: '/sprites/player/previews/naruto.png',
  },
  {
    id: 'sasuke-classic',
    name: 'Sasuke',
    epithet: 'Último Uchiha',
    accent: '#6366f1',
    accentSoft: '#a855f7',
    blurb: 'Katon: Goukakyuu. Alta pressão ofensiva.',
    element: 'Relâmpago',
    elementIcon: '⚡',
    previewUrl: '/sprites/player/previews/sasuke.png',
  },
  {
    id: 'rock-lee',
    name: 'Rock Lee',
    epithet: 'Gênio do esforço',
    accent: '#10b981',
    accentSoft: '#34d399',
    blurb: 'Omote Renge. Taijutsu puro.',
    element: 'Taijutsu',
    elementIcon: '👊',
    previewUrl: '/sprites/player/previews/rock-lee.png',
  },
] as const;

/** Sugestões para o botão "Nome Aleatório" na tela inicial. */
export const RANDOM_NICKNAMES: readonly string[] = [
  'KageShinobi',
  'NarutoUchiha',
  'ShadowStrike',
  'RaikiriLord',
  'VentoNegro',
  'ChakraGod',
  'LotusOculta',
  'KazekageBr',
  'ItachiPride',
  'HokageMaster',
  'GeninLegend',
  'TrovaoSilencioso',
  'SabioDosSeis',
  'AkatsukiHunter',
];
