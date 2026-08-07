import { MAP_KEYS, type MapKey } from '@/maps/map-registry';

/**
 * Mapas do WONSR renderizados como PNG único.
 *
 * O TMX recortado tem milhares de GIDs únicos e o Phaser rende o tileset com
 * artefatos; então usamos a imagem pré-renderizada como visual e apenas a
 * camada `collision` do TMX para física. Mesmo padrão do hub Konoha, aqui
 * generalizado para os mapas de caça.
 */
export interface WonsrRenderedMap {
  /** Key do TMX (fonte da colisão) e do próprio mapa lógico. */
  mapKey: MapKey;
  /** Texture key do PNG pré-renderizado. */
  imageKey: string;
  imageUrl: string;
  /** Dimensões do mundo (px). */
  width: number;
  height: number;
  /** Spawn do jogador (px), validado contra a colisão via scripts/find-spawn.js. */
  spawn: { x: number; y: number };
  /** Pontos de spawn dos inimigos (px), extraídos do nowo-spawn.xml do recorte. */
  enemySpawns: readonly { x: number; y: number }[];
}

export const WONSR_RENDERED_MAPS: Partial<Record<MapKey, WonsrRenderedMap>> = {
  // Floresta a oeste de Konoha (bounds x=1808 y=1904 z=7, 56×56 tiles).
  [MAP_KEYS.forest]: {
    mapKey: MAP_KEYS.forest,
    imageKey: 'map-wonsr-forest',
    imageUrl: '/maps/wonsr-forest.png',
    width: 1792,
    height: 1792,
    spawn: { x: 752, y: 880 },
    // Spawns originais de monstros do WONSR dentro do recorte.
    enemySpawns: [
      { x: 1296, y: 48 },
      { x: 272, y: 240 },
      { x: 720, y: 368 },
      { x: 1360, y: 528 },
      { x: 1104, y: 880 },
      { x: 464, y: 976 },
      { x: 1488, y: 1328 },
      { x: 1104, y: 1456 },
      { x: 176, y: 1488 },
      { x: 688, y: 1616 },
      { x: 1744, y: 1648 },
    ],
  },
  // Arena de clareira (arte full-image) — todas as caças por enquanto.
  [MAP_KEYS.huntForestClearing]: {
    mapKey: MAP_KEYS.huntForestClearing,
    imageKey: 'map-hunt-forest-clearing',
    imageUrl: '/maps/hunt-forest-clearing.png',
    width: 1024,
    height: 576,
    spawn: { x: 528, y: 376 },
    enemySpawns: [
      { x: 528, y: 220 },
      { x: 370, y: 316 },
      { x: 686, y: 316 },
      { x: 428, y: 255 },
      { x: 628, y: 255 },
      { x: 413, y: 359 },
      { x: 643, y: 359 },
      { x: 528, y: 324 },
    ],
  },
};

export function getWonsrRenderedMap(mapKey: MapKey): WonsrRenderedMap | undefined {
  return WONSR_RENDERED_MAPS[mapKey];
}

export function listWonsrRenderedMaps(): WonsrRenderedMap[] {
  return Object.values(WONSR_RENDERED_MAPS).filter(
    (entry): entry is WonsrRenderedMap => entry != null,
  );
}
