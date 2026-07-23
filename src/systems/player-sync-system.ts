import { MULTIPLAYER_SEND_INTERVAL_MS } from '@/constants/multiplayer';
import type { Player } from '@/entities/player';
import type { MultiplayerClient } from '@/services/multiplayer-client';
import type { RemotePlayerManager } from '@/systems/remote-player-manager';
import type { PlayerNetState } from '@/types/net';
import type { VillageId } from '@/types/village';

export interface PlayerSyncIdentity {
  playerId: string;
  nickname: string;
  villageId: VillageId;
  mapKey: string;
}

/**
 * Publica estado local e aplica updates remotos (posição, direção, animação).
 */
export class PlayerSyncSystem {
  private lastSendAt = 0;
  private identity: PlayerSyncIdentity | null = null;

  constructor(
    private readonly client: MultiplayerClient,
    private readonly localPlayer: Player,
    private readonly remotes: RemotePlayerManager,
  ) {
    this.client.setHandlers({
      onPlayerJoin: (player) => this.remotes.upsert(player),
      onPlayerState: (player) => this.remotes.upsert(player),
      onPlayerLeave: (playerId) => this.remotes.remove(playerId),
    });
  }

  setIdentity(identity: PlayerSyncIdentity): void {
    this.identity = identity;
  }

  update(time: number): void {
    this.remotes.update();

    if (!this.identity || !this.client.isConnected()) return;
    if (time - this.lastSendAt < MULTIPLAYER_SEND_INTERVAL_MS) return;

    this.lastSendAt = time;
    const snapshot = this.buildLocalSnapshot();
    if (!snapshot) return;
    this.client.sendLocalState(snapshot);
  }

  publishJoin(): void {
    const snapshot = this.buildLocalSnapshot();
    if (!snapshot) return;
    this.client.sendHelloJoin(snapshot);
  }

  private buildLocalSnapshot(): PlayerNetState | null {
    if (!this.identity) return null;
    return {
      playerId: this.identity.playerId,
      nickname: this.identity.nickname,
      villageId: this.identity.villageId,
      mapKey: this.identity.mapKey,
      x: this.localPlayer.x,
      y: this.localPlayer.y,
      direction: this.localPlayer.direction,
      anim: this.localPlayer.animState,
      updatedAt: Date.now(),
    };
  }
}
