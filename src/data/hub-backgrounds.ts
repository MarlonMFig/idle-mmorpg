import { MAP_KEYS, type MapKey } from '@/maps/map-registry';

/** Hubs sociais — arte ilustrada única (não Tiled). */
export const HUB_KEYS = {
  interdimensional: 'hub-interdimensional',
} as const;

export type HubKey = (typeof HUB_KEYS)[keyof typeof HUB_KEYS];

export type HubCameraMode = 'cover' | 'follow' | 'contain';

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
   * Hub de perfil: trava os pés nesta Y e desliga o eixo vertical do
   * movimento. Sem isso o hub usa o caminhar livre 2D das praças top-down.
   */
  lateralFloorY?: number;
  /**
   * `contain` mostra a arte inteira (letterbox).
   * `cover` preenche o viewport (corta bordas).
   * `follow` segue o jogador com zoom fixo.
   */
  cameraMode?: HubCameraMode;
  /** Escala dos personagens no hub (default: HUB_CHARACTER_SCALE). */
  layoutScale?: number;
  /** Zoom fixo opcional (senão cover/contain/follow calculado). */
  cameraZoom?: number;
}

/**
 * Mundo do hub Konoha — PNG nativo 8192×4320 (cópia bit-a-bit, sem resample).
 * Fonte: Hub_Konoha_RPG_HD_4096x2160.png (8192×4320 nativo).
 */
export const HUB_NATIVE_WIDTH = 8192;
export const HUB_NATIVE_HEIGHT = 4320;
/** Fator contra o layout legado de 1024 de largura. */
export const HUB_LAYOUT_SCALE = HUB_NATIVE_WIDTH / 1024;

/**
 * Escala da UI de mundo. Cover em 1080p ≈ 0.256; 4.3 ≈ 25px de tela.
 */
export const HUB_UI_SCALE = 4.3;

/** Centro da praça (folha) — hub isométrico Konoha, caminhar 2D. */
const HUB_SPAWN = { x: 4104, y: 2856 };
const HUB_ART = '/hubs/hub-interdimensional.png?v=konoha-rpg-hd-8192';

export const HUB_BACKGROUNDS: Record<HubKey, HubBackgroundDef> = {
  [HUB_KEYS.interdimensional]: {
    key: HUB_KEYS.interdimensional,
    url: HUB_ART,
    width: HUB_NATIVE_WIDTH,
    height: HUB_NATIVE_HEIGHT,
    spawn: { x: HUB_SPAWN.x, y: HUB_SPAWN.y },
    cameraMode: 'cover',
    tilemapKey: MAP_KEYS.hubInterdimensional,
    tilemapImageKey: 'hub-interdimensional-img',
    tilemapImageUrl: HUB_ART,
    tilemapWidth: HUB_NATIVE_WIDTH,
    tilemapHeight: HUB_NATIVE_HEIGHT,
    tilemapSpawn: { x: HUB_SPAWN.x, y: HUB_SPAWN.y },
    layoutScale: 4.9,
  },
};

export function getActiveHub(): HubBackgroundDef {
  return HUB_BACKGROUNDS[HUB_KEYS.interdimensional];
}

/** Zoom inteiro opcional (Map Viewport Lab). Default: 1 se sem preferred. */
export function integerHubCameraZoom(
  _viewW: number,
  _viewH: number,
  _worldW: number,
  _worldH: number,
  preferred?: number | null,
): number {
  if (preferred != null && Number.isFinite(preferred)) {
    const z = Math.round(preferred);
    return Math.min(3, Math.max(1, z));
  }
  return 1;
}
