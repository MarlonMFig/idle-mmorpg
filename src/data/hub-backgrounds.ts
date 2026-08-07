import { MAP_KEYS, type MapKey } from '@/maps/map-registry';

/** Hubs de vila — arte fullscreen (não Tiled). */
export const HUB_KEYS = {
  konoha: 'hub-konoha',
} as const;

export type HubKey = (typeof HUB_KEYS)[keyof typeof HUB_KEYS];

export interface HubBackgroundDef {
  key: HubKey;
  url: string;
  width: number;
  height: number;
  /** Spawn do jogador no hub. */
  spawn: { x: number; y: number };
  /**
   * Quando definido, o hub usa o TMX recortado do WONSR (câmera segue o
   * jogador) em vez da arte fullscreen.
   */
  tilemapKey?: MapKey;
  /** PNG renderizado do recorte — usado como imagem única (evita bug do tileset 96×96). */
  tilemapImageKey?: string;
  tilemapImageUrl?: string;
  /** Dimensões do mundo tilemap (px). */
  tilemapWidth?: number;
  tilemapHeight?: number;
  /** Spawn do jogador no TMX (px). */
  tilemapSpawn?: { x: number; y: number };
}

export const HUB_BACKGROUNDS: Record<HubKey, HubBackgroundDef> = {
  [HUB_KEYS.konoha]: {
    key: HUB_KEYS.konoha,
    url: '/hubs/konoha.png?v=1',
    width: 1024,
    height: 576,
    spawn: { x: 512, y: 340 },
    tilemapKey: MAP_KEYS.wonsrKonoha,
    tilemapImageKey: 'hub-wonsr-konoha',
    tilemapImageUrl: '/maps/wonsr-konoha.png',
    tilemapWidth: 3072,
    tilemapHeight: 3072,
    // Praça central do recorte — tile (47,41), validado contra o layer de colisão.
    tilemapSpawn: { x: 1520, y: 1328 },
  },
};

export function getKonohaHub(): HubBackgroundDef {
  return HUB_BACKGROUNDS[HUB_KEYS.konoha];
}
