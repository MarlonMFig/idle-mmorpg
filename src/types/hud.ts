import type { VillageId } from '@/types/village';

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
}
