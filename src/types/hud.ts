import type { VillageId } from '@/types/village';
import type { StarterCharacterId } from '@/types/player-creation';

/** Estado de vitais exibido na HUD (independente da engine). */
export interface VitalsState {
  hp: number;
  hpMax: number;
  xp: number;
  xpMax: number;
  level: number;
}

export interface HudPlayerInfo {
  nickname: string;
  villageId: VillageId;
  starterCharacterId: StarterCharacterId;
}
