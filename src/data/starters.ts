import type { StarterCharacterId } from '@/types/player-creation';

export interface StarterDefinition {
  id: StarterCharacterId;
  name: string;
  epithet: string;
  /** Cor de destaque no seletor. */
  accent: string;
  blurb: string;
  /** Preview na tela de criação. */
  previewUrl: string;
}

export const STARTERS: readonly StarterDefinition[] = [
  {
    id: 'naruto-classic',
    name: 'Naruto',
    epithet: 'Genin de Konoha',
    accent: '#f0a020',
    blurb: 'Rasengan e Oodama Rasengan. Ofensiva versátil.',
    previewUrl: '/sprites/player/previews/naruto.png',
  },
  {
    id: 'sasuke-classic',
    name: 'Sasuke',
    epithet: 'Último Uchiha',
    accent: '#4a7dff',
    blurb: 'Chidori e Chidori Nagashi. Alta pressão em sequência.',
    previewUrl: '/sprites/player/previews/sasuke.png',
  },
  {
    id: 'rock-lee',
    name: 'Rock Lee',
    epithet: 'Gênio do esforço',
    accent: '#3ecf6a',
    blurb: 'Konoha Senpu e Omote Renge. Taijutsu puro.',
    previewUrl: '/sprites/player/previews/rock-lee.png',
  },
] as const;
