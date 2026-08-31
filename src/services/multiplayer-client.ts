import type { NetTransport } from '@/services/net/transport';
import { StubNetTransport } from '@/services/net/stub-transport';
import { PartyKitTransport } from '@/services/net/partykit-transport';
import { WsNetTransport } from '@/services/net/ws-transport';
import { UnavailableNetTransport } from '@/services/net/unavailable-transport';
import type { NetConnectOptions, NetMessage, PlayerNetState } from '@/types/net';

export type MultiplayerClientHandlers = {
  onWelcome?: (playerId: string) => void;
  onPlayerJoin?: (player: PlayerNetState) => void;
  onPlayerLeave?: (playerId: string) => void;
  onPlayerState?: (player: PlayerNetState) => void;
  onChat?: (payload: { playerId: string; nickname: string; text: string; at: number }) => void;
  onConnectionChange?: (connected: boolean) => void;
};

/**
 * Cliente multiplayer de alto nível.
 * Transport: WebSocket (NEXT_PUBLIC_MULTIPLAYER_WS_URL) → PartyKit → stub.
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
    this.handlers = { ...this.handlers, ...handlers };
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

  sendLocalState(player: PlayerNetState): void {
    if (!this.transport.isConnected()) return;
    if (player.playerId !== this.localPlayerId) return;
    this.transport.send({ type: 'player_state', player });
  }

  sendHelloJoin(player: PlayerNetState): void {
    if (!this.transport.isConnected()) return;
    this.transport.send({ type: 'player_join', player });
  }

  sendChat(text: string, nickname: string): void {
    if (!this.transport.isConnected() || !this.localPlayerId) return;
    const trimmed = text.trim().slice(0, 120);
    if (!trimmed) return;
    const message: NetMessage = {
      type: 'chat_message',
      playerId: this.localPlayerId,
      nickname,
      text: trimmed,
      at: Date.now(),
    };
    this.transport.send(message);
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
      case 'chat_message':
        this.handlers.onChat?.(message);
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

function resolveWsUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_MULTIPLAYER_WS_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/$/, '');
}

function resolvePartyHost(): string | null {
  const host = process.env.NEXT_PUBLIC_PARTYKIT_HOST?.trim();
  if (!host) return null;
  return host.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

/** Factory — WS URL → PartyKit host → explicit unavailable state in production. */
export function createMultiplayerClient(): MultiplayerClient {
  const wsUrl = resolveWsUrl();
  if (wsUrl) {
    return new MultiplayerClient(new WsNetTransport(wsUrl));
  }
  const host = resolvePartyHost();
  if (host) {
    return new MultiplayerClient(new PartyKitTransport(host));
  }
  if (process.env.NODE_ENV === 'production') {
    return new MultiplayerClient(new UnavailableNetTransport());
  }
  return new MultiplayerClient(new StubNetTransport());
}
