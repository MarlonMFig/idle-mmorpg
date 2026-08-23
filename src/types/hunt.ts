import type { MapKey } from '@/maps/map-registry';

export interface HuntTargetAttack {
  name: string;
  intervalMs: number;
  min: number;
  max: number;
  range: number;
  element: string;
  /** Folha WONSR de efeito (impacto / jutsu). */
  effectId?: string;
  /** Folha WONSR de projétil (ataques com alcance > 1). */
  missileId?: string;
}

export interface HuntTarget {
  id: string;
  sourceId: string;
  name: string;
  category: string;
  source: string;
  lookType: number;
  hasSprite: boolean;
  requiredLevel: number;
  level: number;
  hp: number;
  xp: number;
  speed: number;
  targetDistance: number;
  attacks?: HuntTargetAttack[];
  loot: Array<{
    itemId: string;
    clientId: number;
    chance: number;
    countMax: number;
  }>;
}

export type HuntSelectorTab = 'naruto' | 'wonsr' | 'bosses';

export interface HuntDefinition {
  id: string;
  name: string;
  requiredLevel: number;
  mapKey: MapKey;
  description: string;
  /** Aba do seletor. Ausente = Naruto World. */
  tab?: HuntSelectorTab;
  /** false = Hunt não selável (bosses, dummy de treino). Default true. */
  sealable?: boolean;
  targets: HuntTarget[];
  /**
   * Duelo lateral: entra o próximo da lista (sem respawn do mesmo inimigo).
   * Com `maxAlive` > 1, vários ficam no mapa ao mesmo tempo.
   */
  sequentialTargets?: boolean;
  /** Quantos inimigos vivos ao mesmo tempo (default 1 se sequential). */
  maxAlive?: number;
  /** Delay (ms) entre cada entrada no modo sequencial. */
  entryDelayMs?: number;
  /** Alterna spawn nas bordas direita → esquerda → direita… */
  alternatingSides?: boolean;
}

export interface HuntCatalog {
  source: string;
  generatedAt: string;
  progression: {
    targetsPerHunt: number;
    charactersPerLevelTier: number;
    firstLevel: number;
    levelStep: number;
  };
  counts: {
    hunts: number;
    targets: number;
    baseCharacters: number;
    monsterVariants: number;
    uniqueLookTypes: number;
  };
  atlas: {
    key: string;
    imageUrl: string;
    atlasUrl: string;
    frameSize: number;
  };
  hunts: HuntDefinition[];
}

export interface PhaserAtlasFrame {
  frame: { x: number; y: number; w: number; h: number };
}

export interface PhaserAtlasData {
  frames: Record<string, PhaserAtlasFrame>;
  meta: {
    image: string;
    size: { w: number; h: number };
  };
}
