import * as Phaser from 'phaser';
import { RemotePlayer } from '@/entities/remote-player';
import { multiplayerStore } from '@/stores/multiplayer-store';
import type { PlayerNetState } from '@/types/net';

/**
 * Gerencia entidades de jogadores remotos a partir de snapshots de rede.
 */
export class RemotePlayerManager {
  private readonly remotes = new Map<string, RemotePlayer>();

  constructor(private readonly scene: Phaser.Scene) {}

  upsert(state: PlayerNetState): void {
    const existing = this.remotes.get(state.playerId);
    if (existing) {
      existing.applyNetworkState(state);
      return;
    }
    this.remotes.set(state.playerId, new RemotePlayer(this.scene, state));
    multiplayerStore.setRemoteCount(this.remotes.size);
  }

  remove(playerId: string): void {
    const remote = this.remotes.get(playerId);
    if (!remote) return;
    remote.destroy();
    this.remotes.delete(playerId);
    multiplayerStore.setRemoteCount(this.remotes.size);
  }

  update(): void {
    for (const remote of this.remotes.values()) {
      remote.update();
    }
  }

  clear(): void {
    for (const remote of this.remotes.values()) {
      remote.destroy();
    }
    this.remotes.clear();
    multiplayerStore.setRemoteCount(0);
  }

  count(): number {
    return this.remotes.size;
  }
}
