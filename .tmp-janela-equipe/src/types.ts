export type Rarity = 'comum' | 'incomum' | 'raro' | 'epico' | 'lendario' | 'mitico' | 'supremo';

export type ElementType = 'fogo' | 'trovao' | 'vento' | 'agua' | 'terra' | 'luz' | 'trevas';

export type CharacterRole = 'Assassino' | 'Ninjutsu' | 'Guerreiro' | 'Suporte' | 'Tanque';

export interface Skill {
  id: string;
  name: string;
  type: 'Ativa' | 'Passiva' | 'Suprema';
  chakraCost: number;
  cooldown: number;
  description: string;
  iconName: string;
}

export interface Equipment {
  id: string;
  name: string;
  type: 'Arma' | 'Armadura' | 'Acessório' | 'Amuleto';
  rarity: Rarity;
  bonus: string;
  iconName: string;
}

export interface Character {
  id: string;
  name: string;
  title: string;
  avatarUrl: string;
  rarity: Rarity;
  element: ElementType;
  role: CharacterRole;
  level: number;
  maxLevel: number;
  xp: number;
  maxXp: number;
  hp: number;
  maxHp: number;
  chakra: number;
  maxChakra: number;
  atk: number;
  def: number;
  speed: number;
  critRate: number; // percentage
  masteryLevel: number; // 0 - 100
  masteryXp: number;
  maxMasteryXp: number;
  stars: number; // 0 - 5
  fragments: number;
  maxFragments: number;
  awakeningStage: number; // 0, 1, 2, 3
  isFavorite: boolean;
  isLocked: boolean;
  isLeader?: boolean;
  skills: Skill[];
  equipment: {
    weapon?: Equipment;
    armor?: Equipment;
    accessory?: Equipment;
    amulet?: Equipment;
  };
  lore: string;
}

export interface TeamPreset {
  id: string;
  name: string;
  slotIds: (string | null)[];
  leaderSlotIndex: number;
}

export interface AwakeningRequirements {
  minLevel: number;
  minStars: number;
  minMastery: number;
  materialName: string;
  materialRequired: number;
  copperCost: number;
  bonusDescription: string;
}
