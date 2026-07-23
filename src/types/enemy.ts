import type { MapKey } from '@/maps/map-registry';
import type { LootDropEntry } from '@/types/loot';

export interface EnemySpawn {
  x: number;
  y: number;
}

/** @deprecated use LootDropEntry — mantido como alias. */
export type EnemyLootEntry = LootDropEntry;

/** Definição autoritativa de um monstro. */
export interface EnemyDefinition {
  id: string;
  name: string;
  hp: number;
  level: number;
  xp: number;
  loot: LootDropEntry[];
  spawn: EnemySpawn;
  speed: number;
  chaseRadius: number;
  sprite: string;
  mapKey: MapKey;
}

export interface EnemyRuntimeStats {
  hp: number;
  hpMax: number;
  level: number;
  xp: number;
}
