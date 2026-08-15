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
   * `follow` segue o jogador com zoom fixo (mapas grandes tipo WONSR).
   */
  cameraMode?: HubCameraMode;
}

/**
 * Mundo do hub. 4096×2160 é a proporção exata da ilustração (1.8963) — em 16:9
 * os prédios das pontas seriam cortados. A arte vem de um render 10752×5670
 * reduzido 2.625× (ver scripts/install-interdimensional-hub.js).
 */
export const HUB_NATIVE_WIDTH = 4096;
export const HUB_NATIVE_HEIGHT = 2160;
/** Fator contra o layout legado de 1024 de largura. */
export const HUB_LAYOUT_SCALE = HUB_NATIVE_WIDTH / 1024;

/**
 * Escala da UI de mundo do hub (nome do prédio no hover). Menor que
 * `HUB_LAYOUT_SCALE` porque a câmera do hub 4K dá zoom ~0.5 em 1080p: 2.2 deixa
 * o texto em ~25px de tela.
 */
export const HUB_UI_SCALE = 2.2;

/** Passeio de pedra da plataforma — ver scripts/install-interdimensional-hub.js. */
const HUB_FLOOR_Y = 1489;
const HUB_ART = '/hubs/hub-interdimensional.png?v=3';

export const HUB_BACKGROUNDS: Record<HubKey, HubBackgroundDef> = {
  [HUB_KEYS.interdimensional]: {
    key: HUB_KEYS.interdimensional,
    url: HUB_ART,
    width: HUB_NATIVE_WIDTH,
    height: HUB_NATIVE_HEIGHT,
    // Em frente à casa central, no meio da plataforma.
    spawn: { x: 2048, y: HUB_FLOOR_Y },
    cameraMode: 'follow',
    tilemapKey: MAP_KEYS.hubInterdimensional,
    tilemapImageKey: 'hub-interdimensional-img',
    tilemapImageUrl: HUB_ART,
    tilemapWidth: HUB_NATIVE_WIDTH,
    tilemapHeight: HUB_NATIVE_HEIGHT,
    tilemapSpawn: { x: 2048, y: HUB_FLOOR_Y },
    lateralFloorY: HUB_FLOOR_Y,
  },
};

export function getActiveHub(): HubBackgroundDef {
  return HUB_BACKGROUNDS[HUB_KEYS.interdimensional];
}
