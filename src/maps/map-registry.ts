/** Chaves e URLs dos mapas Tiled (.tmx). */
export const MAP_KEYS = {
  leafVillage: 'leafVillage',
  /** Hub ilustrado Konoha (PNG + colisão TMX). */
  leafVillageHub: 'leafVillageHub',
  forest: 'forest',
  /** Arena visual de clareira (fallback / legado). */
  huntForestClearing: 'huntForestClearing',
  huntArenaExameChunnin: 'huntArenaExameChunnin',
  huntCampoTreinamento: 'huntCampoTreinamento',
  huntEsconderijoAkatsuki: 'huntEsconderijoAkatsuki',
  huntKonohaDestruida: 'huntKonohaDestruida',
  huntLabOrochimaru: 'huntLabOrochimaru',
  huntPaisDoVento: 'huntPaisDoVento',
  huntPontePaisOnda: 'huntPontePaisOnda',
  huntValeDoFim: 'huntValeDoFim',
  academy: 'academy',
  wonsrKonoha: 'wonsrKonoha',
} as const;

export type MapKey = (typeof MAP_KEYS)[keyof typeof MAP_KEYS];

export const MAP_FILES: Record<MapKey, string> = {
  leafVillage: '/maps/leafVillage.tmx',
  leafVillageHub: '/maps/leaf-village-hub.tmx',
  // Área de caça = recorte de floresta do WONSR (render PNG + colisão do TMX).
  forest: '/maps/wonsr-forest.tmx',
  huntForestClearing: '/maps/hunt-forest-clearing.tmx',
  huntArenaExameChunnin: '/maps/hunt-arena-exame-chunnin.tmx',
  huntCampoTreinamento: '/maps/hunt-campo-treinamento.tmx',
  huntEsconderijoAkatsuki: '/maps/hunt-esconderijo-akatsuki.tmx',
  huntKonohaDestruida: '/maps/hunt-konoha-destruida.tmx',
  huntLabOrochimaru: '/maps/hunt-lab-orochimaru.tmx',
  huntPaisDoVento: '/maps/hunt-pais-do-vento.tmx',
  huntPontePaisOnda: '/maps/hunt-ponte-pais-onda.tmx',
  huntValeDoFim: '/maps/hunt-vale-do-fim.tmx',
  academy: '/maps/academy.tmx',
  wonsrKonoha: '/maps/wonsr-konoha.tmx',
};
