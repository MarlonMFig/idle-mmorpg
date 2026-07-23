export const PLAYER_TEXTURE_KEY = 'player';
export const PLAYER_SPRITE_URL = '/sprites/player/naruto-walk.png';
export const PLAYER_ATTACK_TEXTURE_KEY = 'player-attack';
export const PLAYER_ATTACK_SPRITE_URL = '/sprites/player/naruto-combo1.png';
export const PLAYER_RASENGAN_TEXTURE_KEY = 'player-rasengan';
export const PLAYER_RASENGAN_SPRITE_URL = '/sprites/player/naruto-rasengan.png';
export const PLAYER_SEXY_JUTSU_TEXTURE_KEY = 'player-sexy-jutsu';
export const PLAYER_SEXY_JUTSU_SPRITE_URL = '/sprites/player/naruto-sexy-jutsu.png';

/** Frames do sheet lateral (personagem olha para a direita). */
export const PLAYER_FRAME_WIDTH = 64;
export const PLAYER_FRAME_HEIGHT = 98;
export const PLAYER_WALK_FRAME_COUNT = 6;

export const PLAYER_ATTACK_FRAME_WIDTH = 86;
export const PLAYER_ATTACK_FRAME_HEIGHT = 75;
export const PLAYER_ATTACK_FRAME_COUNT = 4;

export const PLAYER_RASENGAN_FRAME_WIDTH = 139;
export const PLAYER_RASENGAN_FRAME_HEIGHT = 74;
export const PLAYER_RASENGAN_FRAME_COUNT = 8;

export const PLAYER_SEXY_JUTSU_FRAME_WIDTH = 62;
export const PLAYER_SEXY_JUTSU_FRAME_HEIGHT = 63;
export const PLAYER_SEXY_JUTSU_FRAME_COUNT = 23;

/** Velocidade base em pixels/segundo (espelha BASE_ATTRIBUTES.speed). */
export const PLAYER_SPEED = 120;

/**
 * Direcoes de rede / movimento (8 vias).
 * Visual do sprite e so lateral: flipX quando a direcao contem "left".
 */
export const PLAYER_DIRECTIONS = [
  'down',
  'down-right',
  'right',
  'up-right',
  'up',
  'up-left',
  'left',
  'down-left',
] as const;

export type PlayerDirection = (typeof PLAYER_DIRECTIONS)[number];

export const PLAYER_IDLE_FRAME = 0;
export const PLAYER_WALK_FRAMES = [0, 1, 2, 3, 4, 5] as const;

export function directionFacesLeft(direction: PlayerDirection): boolean {
  return direction === 'left' || direction === 'up-left' || direction === 'down-left';
}
