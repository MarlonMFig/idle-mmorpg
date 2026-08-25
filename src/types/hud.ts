import type { Decimal } from '@/lib/decimal';
import type { VillageId } from '@/types/village';
import type { StarterCharacterId } from '@/types/player-creation';

/** Estado de vitais exibido na HUD (independente da engine). */
export interface VitalsState {
  hp: Decimal;
  hpMax: Decimal;
  xp: Decimal;
  xpMax: Decimal;
  level: number;
}

export interface HudPlayerInfo {
  nickname: string;
  villageId: VillageId;
  starterCharacterId: StarterCharacterId;
}
