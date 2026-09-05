import type { CharacterQuality } from '@/types/character-meta';

export interface CharacterStarUpgradeCost {
  copies: number;
  fragments: number;
  signature: number;
}

export const STAR_UPGRADE_CAP_BY_QUALITY: Record<CharacterQuality, number> = {
  D: 2,
  C: 2,
  B: 3,
  A: 4,
  S: 4,
  SS: 5,
  SSS: 5,
};

export const STAR_UPGRADE_COSTS: Record<CharacterQuality, readonly CharacterStarUpgradeCost[]> = {
  D: [
    { copies: 40, fragments: 100, signature: 2 },
    { copies: 80, fragments: 200, signature: 4 },
  ],
  C: [
    { copies: 25, fragments: 130, signature: 3 },
    { copies: 50, fragments: 270, signature: 5 },
  ],
  B: [
    { copies: 12, fragments: 140, signature: 3 },
    { copies: 24, fragments: 230, signature: 5 },
    { copies: 40, fragments: 330, signature: 6 },
  ],
  A: [
    { copies: 6, fragments: 160, signature: 3 },
    { copies: 12, fragments: 250, signature: 5 },
    { copies: 20, fragments: 330, signature: 6 },
    { copies: 32, fragments: 360, signature: 8 },
  ],
  S: [
    { copies: 4, fragments: 200, signature: 4 },
    { copies: 8, fragments: 330, signature: 6 },
    { copies: 14, fragments: 440, signature: 9 },
    { copies: 22, fragments: 530, signature: 11 },
  ],
  SS: [
    { copies: 2, fragments: 250, signature: 5 },
    { copies: 4, fragments: 380, signature: 7 },
    { copies: 7, fragments: 470, signature: 9 },
    { copies: 11, fragments: 530, signature: 11 },
    { copies: 16, fragments: 570, signature: 12 },
  ],
  SSS: [
    { copies: 1, fragments: 330, signature: 7 },
    { copies: 2, fragments: 500, signature: 10 },
    { copies: 3, fragments: 640, signature: 13 },
    { copies: 5, fragments: 730, signature: 14 },
    { copies: 8, fragments: 800, signature: 16 },
  ],
};
