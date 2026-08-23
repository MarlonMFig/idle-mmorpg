/**
 * Sistema de Conquistas e Títulos (Item 23).
 * Achievements observam sistemas oficiais. Titles são cosméticos (sem stats).
 */

export const ACHIEVEMENT_CATEGORIES = [
  'progressao',
  'combate',
  'colecao',
  'personagens',
  'linhagem',
  'hunts',
  'guild',
  'especiais',
] as const;

export type AchievementCategory = (typeof ACHIEVEMENT_CATEGORIES)[number];

export const ACHIEVEMENT_CATEGORY_LABELS: Record<AchievementCategory, string> = {
  progressao: 'Progressão',
  combate: 'Combate',
  colecao: 'Coleção',
  personagens: 'Personagens',
  linhagem: 'Linhagem',
  hunts: 'Hunts',
  guild: 'Guild',
  especiais: 'Especiais',
};

export const TITLE_RARITIES = [
  'comum',
  'incomum',
  'raro',
  'epico',
  'lendario',
  'mitico',
  'supremo',
] as const;

export type TitleRarity = (typeof TITLE_RARITIES)[number];

export const TITLE_RARITY_LABELS: Record<TitleRarity, string> = {
  comum: 'Comum',
  incomum: 'Incomum',
  raro: 'Raro',
  epico: 'Épico',
  lendario: 'Lendário',
  mitico: 'Mítico',
  supremo: 'Supremo',
};

/** Condições — todas derivadas de fontes oficiais (exceto onlineKills = gemStore.totalKills). */
export type AchievementCondition =
  | { type: 'playerLevel'; value: number }
  | { type: 'onlineKills'; value: number }
  | { type: 'uniqueCharacters'; value: number }
  | { type: 'characterStars'; minStars: number }
  | { type: 'characterMastery'; masteryLevel: number }
  | { type: 'awakeningLevel'; awakeningLevel: number }
  | { type: 'hasLineage'; value?: true }
  | { type: 'lineageRank'; rank: number; lineageId?: string }
  | { type: 'hasSpecialization'; value?: true }
  | { type: 'specializationLevel'; level: number; specializationKey?: string; lineageId?: string }
  | { type: 'guildMembership'; value?: true }
  /** Preparado — Hunt Progress ainda não persiste "concluídas". */
  | { type: 'huntProgress'; value: number; huntIds?: readonly string[] };

export type AchievementReward =
  | { type: 'copper'; amount: number }
  | { type: 'title'; id: string };

export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  condition: AchievementCondition;
  rewards: readonly AchievementReward[];
  /** Valor de balanceamento inicial / DEV. */
  rewardsDev?: boolean;
  hidden?: boolean;
  repeatable?: boolean;
  previousAchievementId?: string;
}

export interface TitleDefinition {
  id: string;
  name: string;
  description: string;
  rarity: TitleRarity;
  source: string;
  /** Proibido neste item — sempre vazio/ausente. */
  stats?: never;
}

export interface AchievementProgressState {
  unlocked: Record<string, true>;
  claimed: Record<string, true>;
  unlockedTitles: Record<string, true>;
  equippedTitleId: string | null;
}

/** Estado UI do painel — não persistido. */
export type AchievementsPanelTab = 'conquistas' | 'titulos';

export const DEFAULT_ACHIEVEMENT_PROGRESS: AchievementProgressState = {
  unlocked: {},
  claimed: {},
  unlockedTitles: {},
  equippedTitleId: null,
};

/** Snapshot derivado das fontes oficiais (não persistido). */
export interface AchievementWorldSnapshot {
  playerLevel: number;
  onlineKills: number;
  uniqueCharacters: number;
  maxStars: number;
  maxMastery: number;
  maxAwakening: number;
  hasLineage: boolean;
  lineageId: string | null;
  lineageRank: number;
  hasSpecialization: boolean;
  specializationLevel: number;
  specializationKey: string | null;
  inGuild: boolean;
  huntsCompleted: number;
}
