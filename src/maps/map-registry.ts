/** Chaves e URLs dos mapas Tiled (.tmx). */
export const MAP_KEYS = {
  leafVillage: 'leafVillage',
  forest: 'forest',
  academy: 'academy',
} as const;

export type MapKey = (typeof MAP_KEYS)[keyof typeof MAP_KEYS];

export const MAP_FILES: Record<MapKey, string> = {
  leafVillage: '/maps/leafVillage.tmx',
  forest: '/maps/forest.tmx',
  academy: '/maps/academy.tmx',
};
