/**
 * Sistema de Missões (Item 24).
 * Daily/Weekly = ciclo + contadores de evento.
 * Journey = permanente, sequencial, pode observar estado atual.
 * Sem Quest XP / Battle Pass / moeda nova.
 */

export const MISSION_TYPES = ['daily', 'weekly', 'journey'] as const;
export type MissionType = (typeof MISSION_TYPES)[number];

export const MISSION_TAGS = [
  'combat',
  'capture',
  'loot',
  'mastery',
  'consumable',
  'lineage',
  'progress',
] as const;
export type MissionTag = (typeof MISSION_TAGS)[number];

export const MISSION_TYPE_LABELS: Record<MissionType, string> = {
  daily: 'Diárias',
  weekly: 'Semanais',
  journey: 'Jornada',
};

/** Família anti-redundância na seleção do ciclo. */
export type MissionVariantGroup =
  | 'online-kills'
  | 'hunt-kills'
  | 'lineage-kills'
  | 'unique-enemies'
  | 'capture'
  | 'drops'
  | 'copper-combat'
  | 'potions'
  | 'mastery-xp'
  | 'progress';

export type MissionCondition =
  | { type: 'onlineKills'; value: number }
  | { type: 'onlineKillsInHunt'; value: number; huntId: string }
  | { type: 'uniqueEnemiesKilled'; value: number }
  | { type: 'charactersCaptured'; value: number }
  | { type: 'itemsDropped'; value: number }
  | { type: 'specificItemDropped'; value: number; itemId: string }
  | { type: 'copperEarnedFromCombat'; value: number }
  | { type: 'playerLevel'; value: number }
  | { type: 'characterLevel'; value: number }
  | { type: 'characterMastery'; value: number }
  | { type: 'characterStars'; value: number }
  | { type: 'awakeningLevel'; value: number }
  | { type: 'uniqueCharacters'; value: number }
  | { type: 'lineageSelected' }
  | { type: 'lineageRank'; value: number }
  | { type: 'specializationSelected' }
  | { type: 'specializationLevel'; value: number }
  | { type: 'potionsUsed'; value: number }
  | { type: 'revivesUsed'; value: number }
  | { type: 'masteryXpGained'; value: number }
  | { type: 'lineageCompatibleKills'; value: number }
  | { type: 'bossDefeated'; value: number };

export type MissionReward =
  | { type: 'copper'; amount: number }
  | { type: 'item'; id: string; amount: number };

export type MissionFeatureId =
  | 'potion'
  | 'revive'
  | 'capture'
  | 'awakening'
  | 'lineage'
  | 'specialization';

export interface MissionEligibility {
  minimumPlayerLevel?: number;
  requiresLineage?: boolean;
  requiresSpecialization?: boolean;
  requiresFeature?: MissionFeatureId;
  requiresHuntId?: string;
}

export interface MissionDefinition {
  id: string;
  type: MissionType;
  name: string;
  description: string;
  tag: MissionTag;
  variantGroup: MissionVariantGroup;
  condition: MissionCondition;
  rewards: readonly MissionReward[];
  /** Balanceamento inicial / DEV. */
  rewardsDev?: boolean;
  eligibility?: MissionEligibility;
  nextMissionId?: string;
}

export type MissionUiStatus = 'active' | 'completed' | 'claimed';

export interface MissionEntryState {
  progress: number;
  completed: boolean;
  claimed: boolean;
  /** Para uniqueEnemiesKilled / specificItemDropped. */
  uniqueKeys?: Record<string, true>;
}

export interface MissionCycleBucket {
  cycleId: string;
  selectedIds: string[];
  missions: Record<string, MissionEntryState>;
}

export interface JourneyMissionState {
  currentId: string | null;
  missions: Record<string, MissionEntryState>;
}

export interface MissionsProgressState {
  daily: MissionCycleBucket;
  weekly: MissionCycleBucket;
  journey: JourneyMissionState;
}

export const EMPTY_CYCLE_BUCKET: MissionCycleBucket = {
  cycleId: '',
  selectedIds: [],
  missions: {},
};

export const DEFAULT_MISSIONS_PROGRESS: MissionsProgressState = {
  daily: { cycleId: '', selectedIds: [], missions: {} },
  weekly: { cycleId: '', selectedIds: [], missions: {} },
  journey: { currentId: null, missions: {} },
};

export type MissionProgressSource = 'gameplay' | 'dev' | 'mission-reward' | 'offline';

export interface MissionWorldSnapshot {
  playerLevel: number;
  maxCharacterLevel: number;
  maxMastery: number;
  maxStars: number;
  maxAwakening: number;
  uniqueCharacters: number;
  hasLineage: boolean;
  lineageId: string | null;
  lineageRank: number;
  hasSpecialization: boolean;
  specializationLevel: number;
}

export const EVENT_CONDITION_TYPES = new Set<MissionCondition['type']>([
  'onlineKills',
  'onlineKillsInHunt',
  'uniqueEnemiesKilled',
  'charactersCaptured',
  'itemsDropped',
  'specificItemDropped',
  'copperEarnedFromCombat',
  'potionsUsed',
  'revivesUsed',
  'masteryXpGained',
  'lineageCompatibleKills',
  'bossDefeated',
]);

export const STATE_CONDITION_TYPES = new Set<MissionCondition['type']>([
  'playerLevel',
  'characterLevel',
  'characterMastery',
  'characterStars',
  'awakeningLevel',
  'uniqueCharacters',
  'lineageSelected',
  'lineageRank',
  'specializationSelected',
  'specializationLevel',
]);
