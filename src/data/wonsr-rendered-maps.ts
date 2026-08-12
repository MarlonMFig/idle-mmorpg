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

/** Spawns das arenas art (1024×576, npm run maps:hunt-arenas). */
const ART_ARENA_1024 = {
  width: 1024,
  height: 576,
  spawn: { x: 528, y: 388 },
  enemySpawns: [
    { x: 528, y: 241 },
    { x: 354, y: 333 },
    { x: 702, y: 333 },
    { x: 406, y: 278 },
    { x: 650, y: 278 },
    { x: 389, y: 370 },
    { x: 667, y: 370 },
    { x: 528, y: 342 },
  ],
} as const;

function artArena(
  mapKey: MapKey,
  slug: string,
): WonsrRenderedMap {
  return {
    mapKey,
    imageKey: `map-${slug}`,
    imageUrl: `/maps/${slug}.png`,
    width: ART_ARENA_1024.width,
    height: ART_ARENA_1024.height,
    spawn: { ...ART_ARENA_1024.spawn },
    enemySpawns: ART_ARENA_1024.enemySpawns,
  };
}

export const WONSR_RENDERED_MAPS: Partial<Record<MapKey, WonsrRenderedMap>> = {
  [MAP_KEYS.forest]: {
    mapKey: MAP_KEYS.forest,
    imageKey: 'map-wonsr-forest',
    imageUrl: '/maps/wonsr-forest.png',
    width: 1792,
    height: 1792,
    spawn: { x: 752, y: 880 },
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
  [MAP_KEYS.huntArenaExameChunnin]: artArena(
    MAP_KEYS.huntArenaExameChunnin,
    'hunt-arena-exame-chunnin',
  ),
  [MAP_KEYS.huntCampoTreinamento]: artArena(
    MAP_KEYS.huntCampoTreinamento,
    'hunt-campo-treinamento',
  ),
  [MAP_KEYS.huntEsconderijoAkatsuki]: artArena(
    MAP_KEYS.huntEsconderijoAkatsuki,
    'hunt-esconderijo-akatsuki',
  ),
  [MAP_KEYS.huntKonohaDestruida]: artArena(
    MAP_KEYS.huntKonohaDestruida,
    'hunt-konoha-destruida',
  ),
  [MAP_KEYS.huntLabOrochimaru]: artArena(MAP_KEYS.huntLabOrochimaru, 'hunt-lab-orochimaru'),
  [MAP_KEYS.huntPaisDoVento]: artArena(MAP_KEYS.huntPaisDoVento, 'hunt-pais-do-vento'),
  [MAP_KEYS.huntPontePaisOnda]: artArena(MAP_KEYS.huntPontePaisOnda, 'hunt-ponte-pais-onda'),
  [MAP_KEYS.huntValeDoFim]: artArena(MAP_KEYS.huntValeDoFim, 'hunt-vale-do-fim'),
};

export function getWonsrRenderedMap(mapKey: MapKey): WonsrRenderedMap | undefined {
  return WONSR_RENDERED_MAPS[mapKey];
}

export function listWonsrRenderedMaps(): WonsrRenderedMap[] {
  return Object.values(WONSR_RENDERED_MAPS).filter(
    (entry): entry is WonsrRenderedMap => entry != null,
  );
}
