/** Ids das cinco grandes vilas. */
export type VillageId = 'konoha' | 'suna' | 'kiri' | 'kumo' | 'iwa';

export interface VillageStanding {
  villageId: VillageId;
  /** Pontuação da vila (ranking). */
  score: number;
  /** Quantidade de jogadores na vila. */
  playerCount: number;
}

export type VillageWarStatus = 'idle' | 'declared' | 'active' | 'ended';

/**
 * Guerra entre vilas — estrutura pronta; combate de guerra virá depois.
 */
export interface VillageWar {
  id: string;
  attackerId: VillageId;
  defenderId: VillageId;
  status: Exclude<VillageWarStatus, 'idle'>;
  declaredAt: number;
  startedAt?: number;
  endsAt?: number;
  attackerScore: number;
  defenderScore: number;
}

export interface VillageRankEntry extends VillageStanding {
  rank: number;
  name: string;
  shortLabel: string;
}

export interface VillageSystemState {
  playerVillageId: VillageId | null;
  playerNickname: string | null;
  standings: Record<VillageId, VillageStanding>;
  wars: VillageWar[];
  isOpen: boolean;
}
