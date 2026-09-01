import { COMBAT_MAP_LAYOUT_SCALE } from '@/constants/sprites';
import {
  ENEMY_RESPAWN_MS,
  LATERAL_SIDE_ENEMY_RESPAWN_MS,
  LATERAL_SIDE_ENEMY_SPEED_MULT,
} from '@/constants/combat';
import { getDevMapConfig } from '@/lib/dev/dev-runtime-registry';
import { MAP_KEYS, type MapKey } from '@/maps/map-registry';

/**
 * Mapas do WONSR renderizados como PNG único.
 *
 * O TMX recortado tem milhares de GIDs únicos e o Phaser rende o tileset com
 * artefatos; então usamos a imagem pré-renderizada como visual e, quando
 * configurado, a camada `collision` do TMX para física. Mesmo padrão do hub
 * Konoha, aqui generalizado para os mapas de caça.
 */
export interface WonsrRenderedMap {
  /** Key do TMX e do próprio mapa lógico. */
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
  /** Define se a camada de tiles deve participar da física do mapa. */
  collisionMode?: 'tilemap' | 'none';
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

const NARUTO_TD_ENEMY_COUNT = 9;

const WONSR_NARUTO_TOPDOWN = {
  layoutScale: 3.1,
  cameraFollow: true,
  cameraFit: 'contain' as const,
  cameraZoom: 0.55,
  teamParty: true,
  enemiesPerSpawn: 1,
  enemyRespawnMs: 3500,
  moveSpeedMult: 1,
  enemySpeedMult: 1.6,
} as const;

function pickEvenSpawns(
  spawns: readonly { x: number; y: number }[],
  count: number,
): { x: number; y: number }[] {
  if (spawns.length <= count) return spawns.map((p) => ({ ...p }));
  const picked: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i += 1) {
    const idx = Math.round((i * (spawns.length - 1)) / (count - 1));
    picked.push({ ...spawns[idx] });
  }
  return picked;
}

function narutoTopdownHunt(
  mapKey: MapKey,
  slug: string,
  spawn: { x: number; y: number },
  enemySpawns: readonly { x: number; y: number }[],
): WonsrRenderedMap {
  return {
    mapKey,
    imageKey: slug,
    imageUrl: `/maps/${slug}.png?v=naruto-td1`,
    width: 3840,
    height: 2160,
    spawn,
    enemySpawns: pickEvenSpawns(enemySpawns, NARUTO_TD_ENEMY_COUNT),
    ...WONSR_NARUTO_TOPDOWN,
    collisionMode: mapKey.startsWith('huntTd') ? 'none' : 'tilemap',
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
    imageUrl: '/maps/hunt-campo-treinamento.png?v=lat4k-up3',
    foregroundKey: 'map-hunt-campo-treinamento-fg',
    foregroundUrl: '/maps/hunt-campo-treinamento-fg.png?v=lat4k-up3',
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
    imageUrl: '/maps/hunt-esconderijo-akatsuki.png?v=lat4k-up3',
    foregroundKey: 'map-hunt-esconderijo-akatsuki-fg',
    foregroundUrl: '/maps/hunt-esconderijo-akatsuki-fg.png?v=lat4k-up3',
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
    imageUrl: '/maps/hunt-lab-orochimaru.png?v=lat4k-up3',
    foregroundKey: 'map-hunt-lab-orochimaru-fg',
    foregroundUrl: '/maps/hunt-lab-orochimaru-fg.png?v=lat4k-up3',
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
  [MAP_KEYS.wonsrFarmAnbu]: {
    mapKey: MAP_KEYS.wonsrFarmAnbu,
    imageKey: 'wonsr-farm-anbu',
    imageUrl: '/maps/wonsr-farm-anbu.png',
    width: 3072,
    height: 3072,
    spawn: { x: 1488, y: 1552 },
    enemySpawns: [
      { x: 336, y: 240 },
      { x: 2480, y: 400 },
      { x: 1264, y: 560 },
      { x: 1712, y: 624 },
      { x: 2224, y: 656 },
      { x: 2768, y: 720 },
      { x: 1648, y: 1008 },
      { x: 304, y: 1040 },
      { x: 2224, y: 1040 },
      { x: 1200, y: 1072 },
      { x: 1136, y: 1520 },
      { x: 2032, y: 1552 },
    ],
    layoutScale: 1,
    cameraFollow: true,
    cameraZoom: 1,
    teamParty: true,
  },
  // Aba WONSR: 8 mapas top-down Naruto 3840×2160.
  [MAP_KEYS.huntWonsrFlorestaDaMorte]: narutoTopdownHunt(
    MAP_KEYS.huntWonsrFlorestaDaMorte,
    'wonsr-floresta-da-morte',
    { x: 1912, y: 1080 },
    [
      { x: 1928, y: 456 },
      { x: 1144, y: 600 },
      { x: 1800, y: 744 },
      { x: 1384, y: 760 },
      { x: 2456, y: 792 },
      { x: 2152, y: 808 },
      { x: 1560, y: 1016 },
      { x: 2264, y: 1144 },
      { x: 1672, y: 1352 },
      { x: 1368, y: 1368 },
      { x: 2440, y: 1400 },
      { x: 2024, y: 1416 },
      { x: 1112, y: 1512 },
      { x: 2680, y: 1560 },
      { x: 1896, y: 1704 },
      { x: 1720, y: 1928 },
    ],
  ),
  [MAP_KEYS.huntWonsrCampoTreinamento]: narutoTopdownHunt(
    MAP_KEYS.huntWonsrCampoTreinamento,
    'wonsr-campo-treinamento',
    { x: 1912, y: 1080 },
    [
      { x: 1144, y: 264 },
      { x: 2472, y: 312 },
      { x: 984, y: 504 },
      { x: 2600, y: 568 },
      { x: 1256, y: 584 },
      { x: 632, y: 680 },
      { x: 3160, y: 680 },
      { x: 3144, y: 1000 },
      { x: 2312, y: 1256 },
      { x: 1640, y: 1336 },
      { x: 1928, y: 1336 },
    ],
  ),
  [MAP_KEYS.huntWonsrCavernaAkatsuki]: narutoTopdownHunt(
    MAP_KEYS.huntWonsrCavernaAkatsuki,
    'wonsr-caverna-akatsuki',
    { x: 1912, y: 1080 },
    [
      { x: 1928, y: 456 },
      { x: 1144, y: 600 },
      { x: 1800, y: 744 },
      { x: 1384, y: 760 },
      { x: 2456, y: 792 },
      { x: 2152, y: 808 },
      { x: 1560, y: 1016 },
      { x: 2264, y: 1144 },
      { x: 1672, y: 1352 },
      { x: 1368, y: 1368 },
      { x: 2440, y: 1400 },
      { x: 2024, y: 1416 },
      { x: 1112, y: 1512 },
      { x: 2680, y: 1560 },
      { x: 1896, y: 1704 },
      { x: 1720, y: 1928 },
    ],
  ),
  [MAP_KEYS.huntWonsrDesertoAreia]: narutoTopdownHunt(
    MAP_KEYS.huntWonsrDesertoAreia,
    'wonsr-deserto-areia',
    { x: 1912, y: 1080 },
    [
      { x: 1352, y: 456 },
      { x: 1128, y: 632 },
      { x: 1384, y: 760 },
      { x: 1816, y: 760 },
      { x: 2584, y: 792 },
      { x: 2008, y: 968 },
      { x: 1560, y: 1016 },
      { x: 2568, y: 1112 },
      { x: 2264, y: 1144 },
      { x: 1112, y: 1288 },
      { x: 1672, y: 1352 },
      { x: 1384, y: 1368 },
      { x: 2440, y: 1368 },
      { x: 840, y: 1384 },
      { x: 2040, y: 1384 },
      { x: 2728, y: 1384 },
    ],
  ),
  [MAP_KEYS.huntWonsrEsconderijoOrochimaru]: narutoTopdownHunt(
    MAP_KEYS.huntWonsrEsconderijoOrochimaru,
    'wonsr-esconderijo-orochimaru',
    { x: 1912, y: 1080 },
    [
      { x: 1944, y: 456 },
      { x: 1224, y: 520 },
      { x: 1800, y: 744 },
      { x: 1384, y: 760 },
      { x: 2456, y: 792 },
      { x: 2152, y: 808 },
      { x: 1560, y: 1016 },
      { x: 2264, y: 1144 },
      { x: 1672, y: 1352 },
      { x: 1368, y: 1368 },
      { x: 2440, y: 1368 },
      { x: 2024, y: 1384 },
      { x: 1128, y: 1544 },
      { x: 2680, y: 1544 },
      { x: 1896, y: 1704 },
      { x: 1720, y: 1928 },
    ],
  ),
  [MAP_KEYS.huntWonsrPaisDoFerro]: narutoTopdownHunt(
    MAP_KEYS.huntWonsrPaisDoFerro,
    'wonsr-pais-do-ferro',
    { x: 1912, y: 1080 },
    [
      { x: 1928, y: 456 },
      { x: 1144, y: 600 },
      { x: 1800, y: 744 },
      { x: 1384, y: 760 },
      { x: 2456, y: 792 },
      { x: 2152, y: 808 },
      { x: 1560, y: 1016 },
      { x: 2264, y: 1144 },
      { x: 1672, y: 1352 },
      { x: 1368, y: 1368 },
      { x: 2440, y: 1400 },
      { x: 2024, y: 1416 },
      { x: 1112, y: 1512 },
      { x: 2680, y: 1560 },
      { x: 1896, y: 1704 },
      { x: 1720, y: 1928 },
    ],
  ),
  [MAP_KEYS.huntWonsrPonteDaNevoa]: narutoTopdownHunt(
    MAP_KEYS.huntWonsrPonteDaNevoa,
    'wonsr-ponte-da-nevoa',
    { x: 1912, y: 1432 },
    [
      { x: 792, y: 1480 },
      { x: 1144, y: 1480 },
      { x: 1496, y: 1480 },
      { x: 1848, y: 1480 },
      { x: 2552, y: 1480 },
      { x: 2840, y: 1480 },
      { x: 2264, y: 1496 },
      { x: 968, y: 1704 },
      { x: 1320, y: 1704 },
      { x: 1672, y: 1704 },
      { x: 2440, y: 1752 },
      { x: 2728, y: 1752 },
      { x: 2024, y: 1768 },
      { x: 1144, y: 1928 },
      { x: 1496, y: 1928 },
      { x: 2952, y: 1928 },
    ],
  ),
  [MAP_KEYS.huntWonsrValeDasEstatuas]: narutoTopdownHunt(
    MAP_KEYS.huntWonsrValeDasEstatuas,
    'wonsr-vale-das-estatuas',
    { x: 1944, y: 1368 },
    [
      { x: 3112, y: 1256 },
      { x: 936, y: 1400 },
      { x: 2872, y: 1416 },
      { x: 1224, y: 1432 },
      { x: 1512, y: 1432 },
      { x: 1896, y: 1432 },
      { x: 2296, y: 1432 },
      { x: 2584, y: 1480 },
      { x: 1704, y: 1640 },
      { x: 1384, y: 1688 },
      { x: 2056, y: 1704 },
      { x: 2456, y: 1736 },
      { x: 1128, y: 1816 },
      { x: 2728, y: 1832 },
      { x: 1880, y: 1928 },
      { x: 2232, y: 1928 },
    ],
  ),

  [MAP_KEYS.huntWonsrClareiraEquipe7]: narutoTopdownHunt(
    MAP_KEYS.huntWonsrClareiraEquipe7,
    'wonsr-clareira-equipe-7',
    { x: 1912, y: 1080 },
    [
      { x: 1928, y: 456 },
      { x: 1144, y: 600 },
      { x: 1800, y: 744 },
      { x: 1384, y: 760 },
      { x: 2456, y: 792 },
      { x: 2152, y: 808 },
      { x: 1560, y: 1016 },
      { x: 2264, y: 1144 },
      { x: 1672, y: 1352 },
      { x: 1368, y: 1368 },
      { x: 2440, y: 1400 },
      { x: 2024, y: 1416 },
      { x: 1112, y: 1512 },
      { x: 2680, y: 1560 },
      { x: 1896, y: 1704 },
      { x: 1720, y: 1928 },
    ],
  ),
  [MAP_KEYS.huntWonsrLaboratorioOrochimaru]: narutoTopdownHunt(
    MAP_KEYS.huntWonsrLaboratorioOrochimaru,
    'wonsr-laboratorio-orochimaru',
    { x: 1912, y: 1080 },
    [
      { x: 1928, y: 456 },
      { x: 1144, y: 600 },
      { x: 1800, y: 744 },
      { x: 1384, y: 760 },
      { x: 2456, y: 792 },
      { x: 2152, y: 808 },
      { x: 1560, y: 1016 },
      { x: 2264, y: 1144 },
      { x: 1672, y: 1352 },
      { x: 1368, y: 1368 },
      { x: 2440, y: 1400 },
      { x: 2024, y: 1416 },
      { x: 1112, y: 1512 },
      { x: 2680, y: 1560 },
      { x: 1896, y: 1704 },
      { x: 1720, y: 1928 },
    ],
  ),

  [MAP_KEYS.huntTdValeDoFim]: narutoTopdownHunt(
    MAP_KEYS.huntTdValeDoFim,
    'hunt-td-vale-do-fim',
    { x: 1912, y: 1080 },
    [
      { x: 2408, y: 664 },
      { x: 1096, y: 712 },
      { x: 1800, y: 744 },
      { x: 1384, y: 760 },
      { x: 2152, y: 808 },
      { x: 2488, y: 936 },
      { x: 1560, y: 1016 },
      { x: 2264, y: 1144 },
      { x: 1672, y: 1352 },
      { x: 1368, y: 1368 },
      { x: 2440, y: 1400 },
      { x: 2024, y: 1416 },
      { x: 1112, y: 1512 },
      { x: 2680, y: 1560 },
      { x: 1896, y: 1704 },
      { x: 1720, y: 1928 },
    ],
  ),
  [MAP_KEYS.huntTdArenaExameChunin]: narutoTopdownHunt(
    MAP_KEYS.huntTdArenaExameChunin,
    'hunt-td-arena-exame-chunin',
    { x: 1912, y: 1080 },
    [
      { x: 1928, y: 456 },
      { x: 1128, y: 616 },
      { x: 1800, y: 744 },
      { x: 1384, y: 760 },
      { x: 2456, y: 792 },
      { x: 2152, y: 808 },
      { x: 1560, y: 1016 },
      { x: 2264, y: 1144 },
      { x: 1672, y: 1352 },
      { x: 1368, y: 1368 },
      { x: 2440, y: 1400 },
      { x: 2024, y: 1416 },
      { x: 1112, y: 1512 },
      { x: 2680, y: 1560 },
      { x: 1896, y: 1704 },
      { x: 1720, y: 1928 },
    ],
  ),
  [MAP_KEYS.huntTdPonteDasOndas]: narutoTopdownHunt(
    MAP_KEYS.huntTdPonteDasOndas,
    'hunt-td-ponte-das-ondas',
    { x: 1912, y: 1080 },
    [
      { x: 1064, y: 696 },
      { x: 1800, y: 744 },
      { x: 1368, y: 760 },
      { x: 2152, y: 824 },
      { x: 2488, y: 840 },
      { x: 1928, y: 1000 },
      { x: 1560, y: 1016 },
      { x: 2264, y: 1144 },
      { x: 1672, y: 1352 },
      { x: 1368, y: 1368 },
      { x: 2440, y: 1400 },
      { x: 2024, y: 1416 },
      { x: 1112, y: 1512 },
      { x: 2680, y: 1560 },
      { x: 1896, y: 1704 },
      { x: 1720, y: 1928 },
    ],
  ),
  [MAP_KEYS.huntTdClareiraEquipe7]: narutoTopdownHunt(
    MAP_KEYS.huntTdClareiraEquipe7,
    'hunt-td-clareira-equipe-7',
    { x: 1912, y: 1080 },
    [
      { x: 1928, y: 456 },
      { x: 1144, y: 600 },
      { x: 1800, y: 744 },
      { x: 1384, y: 760 },
      { x: 2456, y: 792 },
      { x: 2152, y: 808 },
      { x: 1560, y: 1016 },
      { x: 2264, y: 1144 },
      { x: 1672, y: 1352 },
      { x: 1368, y: 1368 },
      { x: 2440, y: 1400 },
      { x: 2024, y: 1416 },
      { x: 1112, y: 1512 },
      { x: 2680, y: 1560 },
      { x: 1896, y: 1704 },
      { x: 1720, y: 1928 },
    ],
  ),
  [MAP_KEYS.huntTdCavernaAkatsuki]: narutoTopdownHunt(
    MAP_KEYS.huntTdCavernaAkatsuki,
    'hunt-td-caverna-akatsuki',
    { x: 1912, y: 1080 },
    [
      { x: 1928, y: 456 },
      { x: 1144, y: 600 },
      { x: 1800, y: 744 },
      { x: 1384, y: 760 },
      { x: 2456, y: 792 },
      { x: 2152, y: 808 },
      { x: 1560, y: 1016 },
      { x: 2264, y: 1144 },
      { x: 1672, y: 1352 },
      { x: 1368, y: 1368 },
      { x: 2440, y: 1400 },
      { x: 2024, y: 1416 },
      { x: 1112, y: 1512 },
      { x: 2680, y: 1560 },
      { x: 1896, y: 1704 },
      { x: 1720, y: 1928 },
    ],
  ),
  [MAP_KEYS.huntTdCrateraKonoha]: narutoTopdownHunt(
    MAP_KEYS.huntTdCrateraKonoha,
    'hunt-td-cratera-konoha',
    { x: 1912, y: 1080 },
    [
      { x: 1928, y: 472 },
      { x: 1144, y: 600 },
      { x: 1800, y: 744 },
      { x: 1384, y: 760 },
      { x: 2456, y: 792 },
      { x: 2152, y: 808 },
      { x: 1560, y: 1016 },
      { x: 2264, y: 1144 },
      { x: 1672, y: 1352 },
      { x: 1368, y: 1368 },
      { x: 2440, y: 1400 },
      { x: 2024, y: 1416 },
      { x: 1112, y: 1512 },
      { x: 2680, y: 1560 },
      { x: 1896, y: 1704 },
      { x: 1720, y: 1928 },
    ],
  ),
  [MAP_KEYS.huntTdLaboratorioOrochimaru]: narutoTopdownHunt(
    MAP_KEYS.huntTdLaboratorioOrochimaru,
    'hunt-td-laboratorio-orochimaru',
    { x: 1912, y: 1080 },
    [
      { x: 1928, y: 456 },
      { x: 1144, y: 600 },
      { x: 1800, y: 744 },
      { x: 1384, y: 760 },
      { x: 2456, y: 792 },
      { x: 2152, y: 808 },
      { x: 1560, y: 1016 },
      { x: 2264, y: 1144 },
      { x: 1672, y: 1352 },
      { x: 1368, y: 1368 },
      { x: 2440, y: 1400 },
      { x: 2024, y: 1416 },
      { x: 1112, y: 1512 },
      { x: 2680, y: 1560 },
      { x: 1896, y: 1704 },
      { x: 1720, y: 1928 },
    ],
  ),
  [MAP_KEYS.huntTdArenaVilaAreia]: narutoTopdownHunt(
    MAP_KEYS.huntTdArenaVilaAreia,
    'hunt-td-arena-vila-areia',
    { x: 1912, y: 1080 },
    [
      { x: 1928, y: 456 },
      { x: 1144, y: 600 },
      { x: 1800, y: 744 },
      { x: 1384, y: 760 },
      { x: 2456, y: 792 },
      { x: 2152, y: 808 },
      { x: 1560, y: 1016 },
      { x: 2264, y: 1144 },
      { x: 1672, y: 1352 },
      { x: 1368, y: 1368 },
      { x: 2440, y: 1400 },
      { x: 2024, y: 1416 },
      { x: 1112, y: 1512 },
      { x: 2680, y: 1560 },
      { x: 1896, y: 1704 },
      { x: 1720, y: 1928 },
    ],
  ),

  // Floresta upscale 5016² (crop 5008² p/ tile 16). Colisão/spawns via
  // scripts/install-teste-clareira-map.js. Top-down explorável com follow.
  // Zoom 1 no PNG 5k “microscopiza” a grama e deixa sprites ~62px como formigas;
  // zoom < 1 + layoutScale maior alinham peso visual mapa ↔ personagem.
  [MAP_KEYS.huntTesteFarmWonsr]: {
    mapKey: MAP_KEYS.huntTesteFarmWonsr,
    imageKey: 'hunt-teste-clareira',
    imageUrl: '/maps/hunt-teste-clareira.png?v=caca-upscale-5008',
    width: 5008,
    height: 5008,
    spawn: { x: 2504, y: 2504 },
    enemySpawns: [
      { x: 2520, y: 1336 },
      { x: 1064, y: 1624 },
      { x: 2248, y: 1880 },
      { x: 3560, y: 1928 },
      { x: 1464, y: 1960 },
      { x: 2888, y: 2056 },
      { x: 1800, y: 2360 },
      { x: 3208, y: 2712 },
      { x: 2072, y: 3048 },
      { x: 1496, y: 3080 },
      { x: 2728, y: 3192 },
      { x: 1016, y: 3304 },
      { x: 3912, y: 3352 },
      { x: 3464, y: 3416 },
      { x: 2488, y: 3560 },
      { x: 2456, y: 4168 },
    ],
    layoutScale: 3.1,
    cameraFollow: true,
    cameraZoom: 0.55,
    teamParty: true,
    enemiesPerSpawn: 2,
    enemyRespawnMs: 3500,
    moveSpeedMult: 1,
    enemySpeedMult: 1.6,
  },
  [MAP_KEYS.huntTesteDemon]: {
    mapKey: MAP_KEYS.huntTesteDemon,
    imageKey: 'hunt-teste-clareira',
    imageUrl: '/maps/hunt-teste-clareira.png?v=caca-upscale-5008',
    width: 5008,
    height: 5008,
    spawn: { x: 2504, y: 2504 },
    enemySpawns: [
      { x: 2520, y: 1336 },
      { x: 1064, y: 1624 },
      { x: 2248, y: 1880 },
      { x: 3560, y: 1928 },
      { x: 1464, y: 1960 },
      { x: 2888, y: 2056 },
      { x: 1800, y: 2360 },
      { x: 3208, y: 2712 },
      { x: 2072, y: 3048 },
      { x: 1496, y: 3080 },
      { x: 2728, y: 3192 },
      { x: 1016, y: 3304 },
      { x: 3912, y: 3352 },
      { x: 3464, y: 3416 },
      { x: 2488, y: 3560 },
      { x: 2456, y: 4168 },
    ],
    layoutScale: 3.1,
    cameraFollow: true,
    cameraZoom: 0.55,
    teamParty: true,
    enemiesPerSpawn: 2,
    enemyRespawnMs: 3500,
    moveSpeedMult: 1,
    enemySpeedMult: 1.6,
  },
  [MAP_KEYS.huntTesteWonsrMonsters]: {
    mapKey: MAP_KEYS.huntTesteWonsrMonsters,
    imageKey: 'hunt-teste-clareira',
    imageUrl: '/maps/hunt-teste-clareira.png?v=caca-upscale-5008',
    width: 5008,
    height: 5008,
    spawn: { x: 2504, y: 2504 },
    enemySpawns: [
      { x: 2520, y: 1336 },
      { x: 1064, y: 1624 },
      { x: 2248, y: 1880 },
      { x: 3560, y: 1928 },
      { x: 1464, y: 1960 },
      { x: 2888, y: 2056 },
      { x: 1800, y: 2360 },
      { x: 3208, y: 2712 },
      { x: 2072, y: 3048 },
      { x: 1496, y: 3080 },
      { x: 2728, y: 3192 },
      { x: 1016, y: 3304 },
      { x: 3912, y: 3352 },
      { x: 3464, y: 3416 },
      { x: 2488, y: 3560 },
      { x: 2456, y: 4168 },
    ],
    layoutScale: 3.1,
    cameraFollow: true,
    cameraZoom: 0.55,
    teamParty: true,
    enemiesPerSpawn: 2,
    enemyRespawnMs: 3500,
    moveSpeedMult: 1,
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
  const overlay = getDevMapConfig(mapKey);
  if (typeof overlay?.layoutScale === 'number' && overlay.layoutScale > 0) {
    return overlay.layoutScale;
  }
  const rendered = getWonsrRenderedMap(mapKey);
  if (!rendered) return 1;
  if (typeof rendered.layoutScale === 'number' && rendered.layoutScale > 0) {
    return rendered.layoutScale;
  }
  if (rendered.width < COMBAT_MAP_NATIVE_WIDTH) return 1;
  return COMBAT_MAP_LAYOUT_SCALE;
}

/** Zoom oficial (fonte + overlay DEV). Null = derivado por cover/contain. */
export function officialCameraZoom(mapKey: MapKey | null | undefined): number | null {
  if (!mapKey) return null;
  const overlay = getDevMapConfig(mapKey);
  if (overlay && 'cameraZoom' in overlay) {
    return overlay.cameraZoom ?? null;
  }
  return getWonsrRenderedMap(mapKey)?.cameraZoom ?? null;
}
