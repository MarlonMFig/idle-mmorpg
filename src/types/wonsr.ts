export type WonsrCatalogName =
  | 'skills'
  | 'monsters'
  | 'items'
  | 'npcs'
  | 'vocations'
  | 'outfits'
  | 'quests';

export interface WonsrManifest {
  source: string;
  generatedAt: string;
  counts: Record<WonsrCatalogName, number>;
  files: string[];
}

export interface WonsrSkill {
  id: string;
  name: string;
  words: string;
  character: string;
  script: string;
  level: number;
  mana: number;
  cooldownMs: number;
  range: number;
  target: boolean;
  aggressive: boolean;
  description: string;
}

export interface WonsrMonster {
  id: string;
  name: string;
  category: string;
  source: string;
  level: number;
  experience: number;
  health: number;
  speed: number;
  lookType: number;
  corpseId: number;
  hostile: boolean;
  targetDistance: number;
  attacks: Array<{
    name: string;
    intervalMs: number;
    min: number;
    max: number;
    range: number;
    element: string;
  }>;
  loot: Array<{
    itemId: string;
    clientId: number;
    chance: number;
    countMax: number;
  }>;
}

export interface WonsrItem {
  id: string;
  clientId: number;
  name: string;
  article: string;
  description: string;
  weight: number;
  attack: number;
  defense: number;
  armor: number;
  slotType: string;
  weaponType: string;
  stackable: boolean;
  charges: number;
  decayTo: number;
  attributes: Record<string, string>;
}

export interface WonsrNpc {
  id: string;
  name: string;
  source: string;
  script: string;
  lookType: number;
  dialogue: string[];
  parameters: Record<string, string>;
}

export interface WonsrVocation {
  id: number;
  name: string;
  description: string;
  gainHp: number;
  gainMana: number;
  baseSpeed: number;
  attackSpeedMs: number;
  premium: boolean;
  formula: Record<string, string>;
}

export interface WonsrOutfit {
  id: number;
  vocationId: number;
  level: number;
  gender: string;
  lookType: number;
  name: string;
}

export interface WonsrQuest {
  id: string;
  name: string;
  startStorageId: number;
  startStorageValue: number;
  missions: Array<{
    name: string;
    storageId: number;
    startValue: number;
    endValue: number;
    description: string;
  }>;
}

export interface WonsrCatalogMap {
  skills: WonsrSkill;
  monsters: WonsrMonster;
  items: WonsrItem;
  npcs: WonsrNpc;
  vocations: WonsrVocation;
  outfits: WonsrOutfit;
  quests: WonsrQuest;
}
