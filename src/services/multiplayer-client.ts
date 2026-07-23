import type { NetTransport } from '@/services/net/transport';
import { StubNetTransport } from '@/services/net/stub-transport';
import type {
  NetConnectOptions,
  NetMessage,
  PlayerNetState,
} from '@/types/net';

export type MultiplayerClientHandlers = {
  onWelcome?: (playerId: string) => void;
  onPlayerJoin?: (player: PlayerNetState) => void;
  onPlayerLeave?: (playerId: string) => void;
  onPlayerState?: (player: PlayerNetState) => void;
  onConnectionChange?: (connected: boolean) => void;
};

/**
 * Cliente multiplayer de alto nível.
 * Trocar o transport (stub → WebSocket) sem mudar a GameScene.
 */
export class MultiplayerClient {
  private unsubMessage: (() => void) | null = null;
  private unsubStatus: (() => void) | null = null;
  private localPlayerId: string | null = null;
  private handlers: MultiplayerClientHandlers = {};

  constructor(private readonly transport: NetTransport = new StubNetTransport()) {}

  getTransportName(): string {
    return this.transport.name;
  }

  isConnected(): boolean {
    return this.transport.isConnected();
  }

  getLocalPlayerId(): string | null {
    return this.localPlayerId;
  }

  setHandlers(handlers: MultiplayerClientHandlers): void {
    this.handlers = handlers;
  }

  async connect(options: NetConnectOptions): Promise<void> {
    this.detach();
    this.localPlayerId = options.playerId;

    this.unsubMessage = this.transport.onMessage((message) => this.handleMessage(message));
    this.unsubStatus = this.transport.onStatus((connected) => {
      this.handlers.onConnectionChange?.(connected);
    });

    await this.transport.connect(options);
  }

  disconnect(): void {
    this.transport.disconnect();
    this.detach();
    this.localPlayerId = null;
  }

  /** Publica estado do jogador local para a rede. */
  sendLocalState(player: PlayerNetState): void {
    if (!this.transport.isConnected()) return;
    if (player.playerId !== this.localPlayerId) return;
    this.transport.send({ type: 'player_state', player });
  }

  sendHelloJoin(player: PlayerNetState): void {
    if (!this.transport.isConnected()) return;
    this.transport.send({ type: 'player_join', player });
  }

  private handleMessage(message: NetMessage): void {
    switch (message.type) {
      case 'session_welcome':
        this.localPlayerId = message.playerId;
        this.handlers.onWelcome?.(message.playerId);
        break;
      case 'player_join':
        if (message.player.playerId === this.localPlayerId) return;
        this.handlers.onPlayerJoin?.(message.player);
        break;
      case 'player_leave':
        if (message.playerId === this.localPlayerId) return;
        this.handlers.onPlayerLeave?.(message.playerId);
        break;
      case 'player_state':
        if (message.player.playerId === this.localPlayerId) return;
        this.handlers.onPlayerState?.(message.player);
        break;
      case 'player_state_batch':
        for (const player of message.players) {
          if (player.playerId === this.localPlayerId) continue;
          this.handlers.onPlayerState?.(player);
        }
        break;
      default:
        break;
    }
  }

  private detach(): void {
    this.unsubMessage?.();
    this.unsubStatus?.();
    this.unsubMessage = null;
    this.unsubStatus = null;
  }
}

/** Factory padrão — stub até existir servidor. */
export function createMultiplayerClient(): MultiplayerClient {
  return new MultiplayerClient(new StubNetTransport());
}
