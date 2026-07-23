import type { PlayerDirection } from '@/constants/player';
import type { VillageId } from '@/types/village';

export type PlayerAnimState = 'idle' | 'walk';

/** Snapshot sincronizado de um jogador na rede. */
export interface PlayerNetState {
  playerId: string;
  nickname: string;
  villageId: VillageId;
  mapKey: string;
  x: number;
  y: number;
  direction: PlayerDirection;
  anim: PlayerAnimState;
  /** Timestamp do emissor (ms). */
  updatedAt: number;
}

export type NetMessage =
  | { type: 'session_welcome'; playerId: string; serverTime: number }
  | { type: 'player_join'; player: PlayerNetState }
  | { type: 'player_leave'; playerId: string }
  | { type: 'player_state'; player: PlayerNetState }
  | { type: 'player_state_batch'; players: PlayerNetState[] };

export type NetConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface NetConnectOptions {
  playerId: string;
  nickname: string;
  villageId: VillageId;
  mapKey: string;
}
