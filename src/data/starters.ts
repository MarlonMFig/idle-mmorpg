import type { StarterCharacterId } from '@/types/player-creation';

export interface StarterDefinition {
  id: StarterCharacterId;
  name: string;
  epithet: string;
  /** Cor de destaque no seletor. */
  accent: string;
  blurb: string;
}

export const STARTERS: readonly StarterDefinition[] = [
  {
    id: 'naruto-classic',
    name: 'Naruto',
    epithet: 'Genin de Konoha',
    accent: '#f0a020',
    blurb: 'Rasengan e Jutsu Sexy. Ofensiva versátil.',
  },
  {
    id: 'sasuke-classic',
    name: 'Sasuke',
    epithet: 'Último Uchiha',
    accent: '#4a7dff',
    blurb: 'Chidori e Housenka. Alta pressão em sequência.',
  },
  {
    id: 'rock-lee',
    name: 'Rock Lee',
    epithet: 'Gênio do esforço',
    accent: '#3ecf6a',
    blurb: 'Taijutsu puro. Velocidade e persistência.',
  },
] as const;
