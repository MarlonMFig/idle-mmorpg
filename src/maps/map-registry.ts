/** Chaves e URLs dos mapas Tiled (.tmx). */
export const MAP_KEYS = {
  leafVillage: 'leafVillage',
  /** Hub ilustrado Konoha (PNG + colisão TMX). */
  leafVillageHub: 'leafVillageHub',
  forest: 'forest',
  /** Arena visual de clareira (todas as caças por enquanto). */
  huntForestClearing: 'huntForestClearing',
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
  academy: '/maps/academy.tmx',
  wonsrKonoha: '/maps/wonsr-konoha.tmx',
};
