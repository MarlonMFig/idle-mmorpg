import type { VillageId } from '@/types/village';

export type { VillageId } from '@/types/village';

export type StarterCharacterId = 'naruto-classic' | 'sasuke-classic' | 'rock-lee';

export interface PlayerCreation {
  nickname: string;
  villageId: VillageId;
  starterCharacterId: StarterCharacterId;
}
