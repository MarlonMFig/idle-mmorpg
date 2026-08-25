export type Village = 'Konohagakure' | 'Sunagakure' | 'Kirigakure' | 'Kumogakure' | 'Iwagakure';

export type ElementAffinity = 'Vento (Fūton)' | 'Fogo (Katon)' | 'Relâmpago (Raiton)' | 'Terra (Doton)' | 'Água (Suiton)' | 'Taijutsu Puro';

export interface Jutsu {
  id: string;
  name: string;
  type: 'Ninjutsu' | 'Taijutsu' | 'Genjutsu' | 'Kekkei Genkai';
  chakraCost: number;
  damageMultiplier: string;
  description: string;
  visualEffect: 'rasengan' | 'chidori' | 'lotus' | 'sand' | 'raikiri' | 'amaterasu';
}

export interface CharacterStats {
  forca: number;       // 1 - 100
  ninjutsu: number;    // 1 - 100
  taijutsu: number;    // 1 - 100
  agilidade: number;   // 1 - 100
  estamina: number;    // 1 - 100
  selos: number;       // 1 - 100
}

export interface ShinobiCharacter {
  id: string;
  name: string;
  subtitle: string;
  clan: string;
  village: Village;
  element: ElementAffinity;
  elementIcon: string;
  role: string;
  difficulty: 'Fácil' | 'Médio' | 'Avançado';
  shortDescription: string;
  lore: string;
  quote: string;
  stats: CharacterStats;
  jutsus: Jutsu[];
  passiveSkill: {
    name: string;
    description: string;
  };
  themeColor: {
    primary: string;       // e.g. '#f97316'
    accent: string;        // e.g. '#fbbf24'
    glow: string;          // e.g. 'rgba(249, 115, 22, 0.4)'
    badgeBg: string;       // e.g. 'bg-orange-500/20 text-orange-400 border-orange-500/30'
    buttonGradient: string;// Tailwind classes
    auraGradient: string;  // CSS linear/radial gradient
  };
  pixelArtType: 'naruto' | 'sasuke' | 'lee' | 'gaara' | 'kakashi' | 'itachi';
}

export interface GameState {
  playerName: string;
  selectedCharacter: ShinobiCharacter;
  selectedVillage: Village;
  level: number;
  ryo: number;
  chakra: number;
  isPlaying: boolean;
  gameStarted: boolean;
}
