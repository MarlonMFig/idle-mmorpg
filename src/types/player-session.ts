import type { VillageId } from '@/types/village';
import type { StarterCharacterId } from '@/types/player-creation';

/** Sessão do jogador local injetada no Phaser registry. */
export interface PlayerSession {
  playerId: string;
  nickname: string;
  villageId: VillageId;
  starterCharacterId: StarterCharacterId;
}
