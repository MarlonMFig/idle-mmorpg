import { MULTIPLAYER_SIMULATE_PEERS } from '@/constants/multiplayer';
import type { PlayerDirection } from '@/constants/player';
import type {
  NetConnectOptions,
  NetMessage,
  PlayerAnimState,
  PlayerNetState,
} from '@/types/net';
import type { NetMessageHandler, NetStatusHandler, NetTransport } from '@/services/net/transport';

/**
 * Transporte stub — sem servidor definitivo.
 * Mantém a mesma API que um WebSocket usará depois.
 * Opcionalmente simula um peer remoto para exercitar sync.
 */
export class StubNetTransport implements NetTransport {
  readonly name = 'stub';

  private connected = false;
  private options: NetConnectOptions | null = null;
  private readonly messageHandlers = new Set<NetMessageHandler>();
  private readonly statusHandlers = new Set<NetStatusHandler>();
  private simTimer: ReturnType<typeof setInterval> | null = null;
  private simPeer: PlayerNetState | null = null;

  async connect(options: NetConnectOptions): Promise<void> {
    this.disconnect();
    this.options = options;
    this.connected = true;
    this.emitStatus(true);

    this.emit({
      type: 'session_welcome',
      playerId: options.playerId,
      serverTime: Date.now(),
    });

    if (MULTIPLAYER_SIMULATE_PEERS) {
      this.startSimulatedPeer(options);
    }
  }

  disconnect(): void {
    this.stopSimulatedPeer();
    if (!this.connected) return;
    this.connected = false;
    this.options = null;
    this.emitStatus(false);
  }

  send(message: NetMessage): void {
    if (!this.connected) return;
    // Servidor real retransmitiria; o stub só observa (e mantém sim peer independente).
    void message;
  }

  onMessage(handler: NetMessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onStatus(handler: NetStatusHandler): () => void {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  isConnected(): boolean {
    return this.connected;
  }

  private emit(message: NetMessage): void {
    for (const handler of this.messageHandlers) handler(message);
  }

  private emitStatus(connected: boolean): void {
    for (const handler of this.statusHandlers) handler(connected);
  }

  private startSimulatedPeer(options: NetConnectOptions): void {
    const directions: PlayerDirection[] = [
      'down',
      'down-right',
      'right',
      'up-right',
      'up',
      'up-left',
      'left',
      'down-left',
    ];

    this.simPeer = {
      playerId: 'sim-peer-1',
      nickname: 'Shinobi Sombra',
      villageId: options.villageId === 'konoha' ? 'suna' : 'konoha',
      mapKey: options.mapKey,
      x: 340,
      y: 300,
      direction: 'down',
      anim: 'walk',
      updatedAt: Date.now(),
    };

    this.emit({ type: 'player_join', player: { ...this.simPeer } });

    let angle = 0;
    this.simTimer = setInterval(() => {
      if (!this.simPeer || !this.connected) return;
      angle += 0.12;
      const cx = 360;
      const cy = 320;
      const radius = 48;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      const vx = -Math.sin(angle);
      const vy = Math.cos(angle);
      const sector = Math.round(Math.atan2(vx, vy) / (Math.PI / 4));
      const index = ((sector % 8) + 8) % 8;
      const direction = directions[index];
      const anim: PlayerAnimState = 'walk';

      this.simPeer = {
        ...this.simPeer,
        x,
        y,
        direction,
        anim,
        updatedAt: Date.now(),
      };

      this.emit({ type: 'player_state', player: { ...this.simPeer } });
    }, 100);
  }

  private stopSimulatedPeer(): void {
    if (this.simTimer) {
      clearInterval(this.simTimer);
      this.simTimer = null;
    }
    if (this.simPeer) {
      const id = this.simPeer.playerId;
      this.simPeer = null;
      if (this.connected) {
        this.emit({ type: 'player_leave', playerId: id });
      }
    }
  }
}
