import { MAP_KEYS, type MapKey } from '@/maps/map-registry';

/** Hubs de vila — arte fullscreen (não Tiled). */
export const HUB_KEYS = {
  konoha: 'hub-konoha',
} as const;

export type HubKey = (typeof HUB_KEYS)[keyof typeof HUB_KEYS];

export type HubCameraMode = 'cover' | 'follow';

export interface HubBackgroundDef {
  key: HubKey;
  url: string;
  width: number;
  height: number;
  /** Spawn do jogador no hub. */
  spawn: { x: number; y: number };
  /**
   * Quando definido, o hub usa o TMX (câmera conforme `cameraMode`) em vez da
   * arte fullscreen pura sem colisão.
   */
  tilemapKey?: MapKey;
  /** PNG renderizado — imagem única + colisão do TMX. */
  tilemapImageKey?: string;
  tilemapImageUrl?: string;
  /** Dimensões do mundo tilemap (px). */
  tilemapWidth?: number;
  tilemapHeight?: number;
  /** Spawn do jogador no TMX (px). */
  tilemapSpawn?: { x: number; y: number };
  /**
   * `cover` preenche o viewport (hub ilustrado 16:9).
   * `follow` segue o jogador com zoom fixo (mapas grandes tipo WONSR).
   */
  cameraMode?: HubCameraMode;
}

export const HUB_BACKGROUNDS: Record<HubKey, HubBackgroundDef> = {
  [HUB_KEYS.konoha]: {
    key: HUB_KEYS.konoha,
    url: '/hubs/konoha.png?v=2',
    width: 1024,
    height: 576,
    spawn: { x: 528, y: 336 },
    tilemapKey: MAP_KEYS.leafVillageHub,
    tilemapImageKey: 'hub-leaf-village',
    tilemapImageUrl: '/maps/leaf-village-hub.png?v=2',
    tilemapWidth: 1024,
    tilemapHeight: 576,
    // Centro da praça de pedra — validado contra o layer de colisão.
    tilemapSpawn: { x: 528, y: 336 },
    cameraMode: 'cover',
  },
};

export function getKonohaHub(): HubBackgroundDef {
  return HUB_BACKGROUNDS[HUB_KEYS.konoha];
}
