import { COMBAT_MAP_LAYOUT_SCALE, HUB_CHARACTER_SCALE } from '@/constants/sprites';
import {
  ENEMY_RESPAWN_MS,
  LATERAL_SIDE_ENEMY_RESPAWN_MS,
  LATERAL_SIDE_ENEMY_SPEED_MULT,
} from '@/constants/combat';
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
  /**
   * Combate lateral: trava pés nesta Y (visão de perfil).
   * Sem isso, o mapa usa movimento livre 2D das arenas top-down.
   */
  lateralFloorY?: number;
  /** Escala dos sprites neste mapa (default: 3.75 nas arenas 4K, 1 nos menores). */
  layoutScale?: number;
  /**
   * Overlay na frente dos sprites (grama / corte do solo).
   * Pés ficam atrás da vegetação; o restante da imagem é transparente.
   */
  foregroundKey?: string;
  foregroundUrl?: string;
  /** Fundo em vídeo (loop). O PNG `imageKey` fica atrás até o primeiro frame. */
  videoKey?: string;
  videoUrl?: string;
  /**
   * Mundo maior que a tela: a câmera segue o jogador em vez de enquadrar a
   * arena inteira. Só assim andar para cima revela outra parte do mapa.
   */
  cameraFollow?: boolean;
  /** Zoom fixo no modo `cameraFollow` (1 = pixels do PNG na escala nativa). */
  cameraZoom?: number;
  /**
   * Enquadra a arte inteira no viewport (como abrir o PNG no visualizador).
   * Sem isto, `cameraZoom: 1` em um mapa 5000² recorta e parece zoom enorme.
   */
  cameraFit?: 'contain';
  /** Traz os outros membros da equipe como aliados controlados pela IA. */
  teamParty?: boolean;
  /**
   * Cópias por ponto de spawn (mapa de teste farm). Default global = 1.
   * No vídeo de referência há ~8–10 alvos no enquadramento; 2 por ponto
   * com passo largo aproxima essa densidade sem amontoar labels.
   */
  enemiesPerSpawn?: number;
  /** Respawn dos monstros só neste mapa (ms). Sem isto usa ENEMY_RESPAWN_MS. */
  enemyRespawnMs?: number;
  /** Multiplicador da velocidade do líder e dos aliados neste mapa. */
  moveSpeedMult?: number;
  /** Multiplicador da speed de patrulha/perseguição dos monstros neste mapa. */
  enemySpeedMult?: number;
}

export const COMBAT_MAP_NATIVE_WIDTH = 3840;
export const COMBAT_MAP_NATIVE_HEIGHT = 2160;

/** Spawns das arenas art (3840×2160, layout × 3.75 vs 1024×576). */
const ART_ARENA_4K = {
  width: COMBAT_MAP_NATIVE_WIDTH,
  height: COMBAT_MAP_NATIVE_HEIGHT,
  spawn: { x: 1980, y: 1455 },
  enemySpawns: [
    { x: 1980, y: 904 },
    { x: 1328, y: 1249 },
    { x: 2633, y: 1249 },
    { x: 1523, y: 1043 },
    { x: 2438, y: 1043 },
    { x: 1459, y: 1388 },
    { x: 2501, y: 1388 },
    { x: 1980, y: 1283 },
  ],
} as const;

function artArena(mapKey: MapKey, slug: string): WonsrRenderedMap {
  return {
    mapKey,
    imageKey: `map-${slug}`,
    imageUrl: `/maps/${slug}.png?v=4k`,
    width: ART_ARENA_4K.width,
    height: ART_ARENA_4K.height,
    spawn: { ...ART_ARENA_4K.spawn },
    enemySpawns: ART_ARENA_4K.enemySpawns,
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
    imageUrl: '/maps/hunt-forest-clearing.png?v=lat4k2',
    foregroundKey: 'map-hunt-forest-clearing-fg',
    foregroundUrl: '/maps/hunt-forest-clearing-fg.png?v=lat4k2',
    width: 3840,
    height: 2160,
    spawn: { x: 1920, y: 1400 },
    enemySpawns: [
      { x: 3680, y: 1400 },
      { x: 160, y: 1400 },
    ],
    lateralFloorY: 1400,
    layoutScale: 4.75,
  },
  [MAP_KEYS.huntValeDoFim]: {
    mapKey: MAP_KEYS.huntValeDoFim,
    imageKey: 'map-hunt-vale-do-fim',
    imageUrl: '/maps/hunt-vale-do-fim.png?v=lat4k2',
    foregroundKey: 'map-hunt-vale-do-fim-fg',
    foregroundUrl: '/maps/hunt-vale-do-fim-fg.png?v=lat4k2',
    width: 3840,
    height: 2160,
    spawn: { x: 1920, y: 1384 },
    enemySpawns: [
      { x: 3680, y: 1384 },
      { x: 160, y: 1384 },
    ],
    lateralFloorY: 1384,
    layoutScale: 4.75,
  },
  [MAP_KEYS.huntCampoTreinamento]: {
    mapKey: MAP_KEYS.huntCampoTreinamento,
    imageKey: 'map-hunt-campo-treinamento',
    imageUrl: '/maps/hunt-campo-treinamento.png?v=lat4k2',
    foregroundKey: 'map-hunt-campo-treinamento-fg',
    foregroundUrl: '/maps/hunt-campo-treinamento-fg.png?v=lat4k2',
    width: 3840,
    height: 2160,
    spawn: { x: 1920, y: 1386 },
    enemySpawns: [
      { x: 3680, y: 1386 },
      { x: 160, y: 1386 },
    ],
    // A grama vai até 1380 e a terra começa em 1396: 1400 enterrava os pés.
    lateralFloorY: 1386,
    layoutScale: 4.75,
  },
  [MAP_KEYS.huntPontePaisOnda]: {
    mapKey: MAP_KEYS.huntPontePaisOnda,
    imageKey: 'map-hunt-ponte-pais-onda',
    imageUrl: '/maps/hunt-ponte-pais-onda.png?v=lat4k2',
    foregroundKey: 'map-hunt-ponte-pais-onda-fg',
    foregroundUrl: '/maps/hunt-ponte-pais-onda-fg.png?v=lat4k2',
    width: 3840,
    height: 2160,
    spawn: { x: 1920, y: 1470 },
    enemySpawns: [
      { x: 3680, y: 1470 },
      { x: 160, y: 1470 },
    ],
    lateralFloorY: 1470,
    layoutScale: 4.75,
  },
  [MAP_KEYS.huntEsconderijoAkatsuki]: {
    mapKey: MAP_KEYS.huntEsconderijoAkatsuki,
    imageKey: 'map-hunt-esconderijo-akatsuki',
    imageUrl: '/maps/hunt-esconderijo-akatsuki.png?v=lat4k2',
    foregroundKey: 'map-hunt-esconderijo-akatsuki-fg',
    foregroundUrl: '/maps/hunt-esconderijo-akatsuki-fg.png?v=lat4k2',
    width: 3840,
    height: 2160,
    spawn: { x: 1920, y: 1400 },
    enemySpawns: [
      { x: 3680, y: 1400 },
      { x: 160, y: 1400 },
    ],
    lateralFloorY: 1400,
    layoutScale: 4.75,
  },
  [MAP_KEYS.huntLabOrochimaru]: {
    mapKey: MAP_KEYS.huntLabOrochimaru,
    imageKey: 'map-hunt-lab-orochimaru',
    imageUrl: '/maps/hunt-lab-orochimaru.png?v=lat4k2',
    foregroundKey: 'map-hunt-lab-orochimaru-fg',
    foregroundUrl: '/maps/hunt-lab-orochimaru-fg.png?v=lat4k2',
    width: 3840,
    height: 2160,
    spawn: { x: 1920, y: 1400 },
    enemySpawns: [
      { x: 3680, y: 1400 },
      { x: 160, y: 1400 },
    ],
    lateralFloorY: 1400,
    layoutScale: 4.75,
  },
  [MAP_KEYS.huntPaisDoVento]: {
    mapKey: MAP_KEYS.huntPaisDoVento,
    imageKey: 'map-hunt-pais-do-vento',
    imageUrl: '/maps/hunt-pais-do-vento.png?v=lat4k2',
    foregroundKey: 'map-hunt-pais-do-vento-fg',
    foregroundUrl: '/maps/hunt-pais-do-vento-fg.png?v=lat4k2',
    width: 3840,
    height: 2160,
    spawn: { x: 1920, y: 1387 },
    enemySpawns: [
      { x: 3680, y: 1387 },
      { x: 160, y: 1387 },
    ],
    lateralFloorY: 1387,
    layoutScale: 4.75,
  },
  [MAP_KEYS.huntArenaExameChunnin]: {
    mapKey: MAP_KEYS.huntArenaExameChunnin,
    imageKey: 'map-hunt-arena-exame-chunnin',
    imageUrl: '/maps/hunt-arena-exame-chunnin.png?v=lat4k2',
    foregroundKey: 'map-hunt-arena-exame-chunnin-fg',
    foregroundUrl: '/maps/hunt-arena-exame-chunnin-fg.png?v=lat4k2',
    width: 3840,
    height: 2160,
    spawn: { x: 1920, y: 1400 },
    enemySpawns: [
      { x: 3680, y: 1400 },
      { x: 160, y: 1400 },
    ],
    lateralFloorY: 1400,
    layoutScale: 4.75,
  },
  [MAP_KEYS.huntMonteMyoboku]: {
    mapKey: MAP_KEYS.huntMonteMyoboku,
    imageKey: 'map-hunt-monte-myoboku',
    imageUrl: '/maps/hunt-monte-myoboku.png?v=lat4k3',
    foregroundKey: 'map-hunt-monte-myoboku-fg',
    foregroundUrl: '/maps/hunt-monte-myoboku-fg.png?v=lat4k3',
    width: 3840,
    height: 2160,
    spawn: { x: 1920, y: 1440 },
    enemySpawns: [
      { x: 3680, y: 1440 },
      { x: 160, y: 1440 },
    ],
    lateralFloorY: 1440,
    layoutScale: 4.75,
  },
  [MAP_KEYS.huntArenaExameChunin]: {
    mapKey: MAP_KEYS.huntArenaExameChunin,
    imageKey: 'map-hunt-arena-exame-chunin',
    imageUrl: '/maps/hunt-arena-exame-chunin.png?v=lat4k3',
    foregroundKey: 'map-hunt-arena-exame-chunin-fg',
    foregroundUrl: '/maps/hunt-arena-exame-chunin-fg.png?v=lat4k3',
    width: 3840,
    height: 2160,
    spawn: { x: 1920, y: 1500 },
    enemySpawns: [
      { x: 3680, y: 1500 },
      { x: 160, y: 1500 },
    ],
    lateralFloorY: 1500,
    layoutScale: 4.75,
  },
  [MAP_KEYS.huntDistritoUchiha]: {
    mapKey: MAP_KEYS.huntDistritoUchiha,
    imageKey: 'map-hunt-distrito-uchiha',
    imageUrl: '/maps/hunt-distrito-uchiha.png?v=lat4k3',
    foregroundKey: 'map-hunt-distrito-uchiha-fg',
    foregroundUrl: '/maps/hunt-distrito-uchiha-fg.png?v=lat4k3',
    width: 3840,
    height: 2160,
    spawn: { x: 1920, y: 1420 },
    enemySpawns: [
      { x: 3680, y: 1420 },
      { x: 160, y: 1420 },
    ],
    lateralFloorY: 1420,
    layoutScale: 4.75,
  },
  [MAP_KEYS.huntCampoGuerraNinja]: {
    mapKey: MAP_KEYS.huntCampoGuerraNinja,
    imageKey: 'map-hunt-campo-guerra-ninja',
    imageUrl: '/maps/hunt-campo-guerra-ninja.png?v=lat4k3',
    foregroundKey: 'map-hunt-campo-guerra-ninja-fg',
    foregroundUrl: '/maps/hunt-campo-guerra-ninja-fg.png?v=lat4k3',
    width: 3840,
    height: 2160,
    spawn: { x: 1920, y: 1390 },
    enemySpawns: [
      { x: 3680, y: 1390 },
      { x: 160, y: 1390 },
    ],
    lateralFloorY: 1390,
    layoutScale: 4.75,
  },
  [MAP_KEYS.huntArredoresReinoClover]: {
    mapKey: MAP_KEYS.huntArredoresReinoClover,
    imageKey: 'map-hunt-arredores-reino-clover',
    imageUrl: '/maps/hunt-arredores-reino-clover.png?v=4k1',
    // PNG 4096×2160 original, copiado sem recompressão ou resize.
    width: 4096,
    height: 2160,
    spawn: { x: 2048, y: 1396 },
    enemySpawns: [
      { x: 3760, y: 1396 },
      { x: 336, y: 1396 },
    ],
    lateralFloorY: 1396,
    layoutScale: 5.75,
  },
  [MAP_KEYS.huntKonohaDestruida]: artArena(MAP_KEYS.huntKonohaDestruida, 'hunt-konoha-destruida'),
  [MAP_KEYS.huntValeDoFimLateral]: {
    mapKey: MAP_KEYS.huntValeDoFimLateral,
    imageKey: 'map-hunt-vale-do-fim-lateral',
    imageUrl: '/maps/hunt-vale-do-fim-lateral.png?v=forest2',
    foregroundKey: 'map-hunt-vale-do-fim-lateral-fg',
    foregroundUrl: '/maps/hunt-vale-do-fim-lateral-fg.png?v=forest2',
    width: 1024,
    height: 576,
    spawn: { x: 512, y: 373 },
    enemySpawns: [
      { x: 968, y: 373 },
      { x: 56, y: 373 },
    ],
    lateralFloorY: 373,
    // Sprites grandes na visão de perfil (mapa 1024×576).
    layoutScale: 1.8,
  },
  [MAP_KEYS.huntValeLoop]: {
    mapKey: MAP_KEYS.huntValeLoop,
    imageKey: 'map-hunt-vale-loop',
    imageUrl: '/maps/hunt-vale-loop.png?v=loop2',
    videoKey: 'map-hunt-vale-loop-video',
    videoUrl: '/maps/hunt-vale-loop.mp4?v=loop2',
    width: 1904,
    height: 1088,
    spawn: { x: 952, y: 861 },
    enemySpawns: [
      { x: 1824, y: 861 },
      { x: 80, y: 861 },
    ],
    lateralFloorY: 861,
    layoutScale: 3.2,
  },
  [MAP_KEYS.huntNamekusei]: {
    mapKey: MAP_KEYS.huntNamekusei,
    imageKey: 'map-hunt-namekusei',
    imageUrl: '/maps/hunt-namekusei.png?v=latdb2',
    foregroundKey: 'map-hunt-namekusei-fg',
    foregroundUrl: '/maps/hunt-namekusei-fg.png?v=latdb2',
    width: 3840,
    height: 2160,
    spawn: { x: 1920, y: 1384 },
    enemySpawns: [
      { x: 3680, y: 1384 },
      { x: 160, y: 1384 },
    ],
    lateralFloorY: 1384,
    layoutScale: 5.75,
  },
  [MAP_KEYS.huntJogosCell]: artArena(MAP_KEYS.huntJogosCell, 'hunt-jogos-cell'),
  [MAP_KEYS.huntTorneioArtesMarciais]: {
    mapKey: MAP_KEYS.huntTorneioArtesMarciais,
    imageKey: 'map-hunt-torneio-artes-marciais',
    imageUrl: '/maps/hunt-torneio-artes-marciais.png?v=latdb2',
    foregroundKey: 'map-hunt-torneio-artes-marciais-fg',
    foregroundUrl: '/maps/hunt-torneio-artes-marciais-fg.png?v=latdb2',
    width: 3840,
    height: 2160,
    spawn: { x: 1920, y: 1460 },
    enemySpawns: [
      { x: 3680, y: 1460 },
      { x: 160, y: 1460 },
    ],
    lateralFloorY: 1460,
    layoutScale: 5.75,
  },
  [MAP_KEYS.huntSalaDoTempo]: {
    mapKey: MAP_KEYS.huntSalaDoTempo,
    imageKey: 'map-hunt-sala-do-tempo',
    imageUrl: '/maps/hunt-sala-do-tempo.png?v=latdb2',
    foregroundKey: 'map-hunt-sala-do-tempo-fg',
    foregroundUrl: '/maps/hunt-sala-do-tempo-fg.png?v=latdb2',
    width: 3840,
    height: 2160,
    spawn: { x: 1920, y: 1464 },
    enemySpawns: [
      { x: 3680, y: 1464 },
      { x: 160, y: 1464 },
    ],
    lateralFloorY: 1464,
    layoutScale: 5.75,
  },
  [MAP_KEYS.huntDesertoSaiyajin]: {
    mapKey: MAP_KEYS.huntDesertoSaiyajin,
    imageKey: 'map-hunt-deserto-saiyajin',
    imageUrl: '/maps/hunt-deserto-saiyajin.png?v=latdb2',
    foregroundKey: 'map-hunt-deserto-saiyajin-fg',
    foregroundUrl: '/maps/hunt-deserto-saiyajin-fg.png?v=latdb2',
    width: 3840,
    height: 2160,
    spawn: { x: 1920, y: 1424 },
    enemySpawns: [
      { x: 3680, y: 1424 },
      { x: 160, y: 1424 },
    ],
    lateralFloorY: 1424,
    layoutScale: 5.75,
  },
  // Teste top-down: mundo 3072² percorrível, sprites em escala nativa (pequenos
  // perto do mapa) e câmera colada no líder da equipe.
  [MAP_KEYS.huntTesteEquipe]: {
    mapKey: MAP_KEYS.huntTesteEquipe,
    // Mesma key do tileset do TMX: o PNG de 7 MB é baixado uma vez só.
    imageKey: 'wonsr-konoha',
    imageUrl: '/maps/wonsr-konoha.png',
    width: 3072,
    height: 3072,
    spawn: { x: 1776, y: 1840 },
    // Todos no mesmo componente conexo da colisão do TMX (pátios murados ficam
    // de fora): sem isso a equipe nasce trancada e a câmera nunca sai do lugar.
    enemySpawns: [
      { x: 1072, y: 752 },
      { x: 2928, y: 560 },
      { x: 976, y: 1616 },
      { x: 2736, y: 1552 },
      { x: 2928, y: 2256 },
      { x: 2320, y: 2608 },
      { x: 1584, y: 3024 },
      { x: 3024, y: 3024 },
    ],
    layoutScale: 1,
    cameraFollow: true,
    cameraZoom: 1,
    teamParty: true,
  },
  // Clareira de treinamento (arte 4096×2160 original, mesma resolução do hub,
  // copiada sem resize). Colisão e spawns saem da própria imagem via
  // scripts/install-teste-clareira-map.js. Sprites na escala do hub para
  // não contrastar com a arte 4K.
  [MAP_KEYS.huntTesteFarmWonsr]: {
    mapKey: MAP_KEYS.huntTesteFarmWonsr,
    imageKey: 'hunt-teste-clareira',
    imageUrl: '/maps/hunt-teste-clareira.png?v=clareira2160',
    width: 4096,
    height: 2160,
    spawn: { x: 2040, y: 1080 },
    enemySpawns: [
      { x: 1528, y: 360 },
      { x: 2472, y: 376 },
      { x: 1768, y: 552 },
      { x: 2136, y: 616 },
      { x: 1336, y: 648 },
      { x: 2472, y: 792 },
      { x: 2888, y: 888 },
      { x: 1464, y: 984 },
      { x: 1208, y: 1272 },
      { x: 2552, y: 1288 },
      { x: 1608, y: 1368 },
      { x: 2264, y: 1400 },
      { x: 2808, y: 1448 },
      { x: 1944, y: 1592 },
      { x: 1608, y: 1784 },
      { x: 2232, y: 1800 },
    ],
    layoutScale: HUB_CHARACTER_SCALE,
    cameraFollow: true,
    cameraFit: 'contain',
    teamParty: true,
    enemiesPerSpawn: 2,
    enemyRespawnMs: 3500,
    moveSpeedMult: 2.2,
    enemySpeedMult: 1.6,
  },
};

/** Mapa lateral com dois spawns nas bordas esquerda/direita. */
export function isLateralSideSpawnMap(map: WonsrRenderedMap): boolean {
  if (map.lateralFloorY == null || map.enemySpawns.length !== 2) return false;
  const xs = map.enemySpawns.map((spawn) => spawn.x);
  const leftX = Math.min(...xs);
  const rightX = Math.max(...xs);
  return leftX <= map.width * 0.15 && rightX >= map.width * 0.85;
}

export function enemyRespawnMsForMap(map: WonsrRenderedMap | undefined): number {
  if (!map) return ENEMY_RESPAWN_MS;
  if (map.enemyRespawnMs != null) return map.enemyRespawnMs;
  if (isLateralSideSpawnMap(map)) return LATERAL_SIDE_ENEMY_RESPAWN_MS;
  return ENEMY_RESPAWN_MS;
}

export function enemySpeedMultForMap(map: WonsrRenderedMap | undefined): number {
  if (!map) return 1;
  if (map.enemySpeedMult != null) return map.enemySpeedMult;
  if (isLateralSideSpawnMap(map)) return LATERAL_SIDE_ENEMY_SPEED_MULT;
  return 1;
}

export function getWonsrRenderedMap(mapKey: MapKey): WonsrRenderedMap | undefined {
  return WONSR_RENDERED_MAPS[mapKey];
}

export function listWonsrRenderedMaps(): WonsrRenderedMap[] {
  return Object.values(WONSR_RENDERED_MAPS).filter(
    (entry): entry is WonsrRenderedMap => entry != null,
  );
}

/** 3.75 nos mapas 4K; override por mapa; 1 no recorte legado. */
export function combatLayoutScale(mapKey: MapKey | null | undefined): number {
  if (!mapKey) return 1;
  const rendered = getWonsrRenderedMap(mapKey);
  if (!rendered) return 1;
  if (typeof rendered.layoutScale === 'number' && rendered.layoutScale > 0) {
    return rendered.layoutScale;
  }
  if (rendered.width < COMBAT_MAP_NATIVE_WIDTH) return 1;
  return COMBAT_MAP_LAYOUT_SCALE;
}
