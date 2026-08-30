import type {
  NetConnectOptions,
  NetMessage,
} from '@/types/net';
import type { NetMessageHandler, NetStatusHandler, NetTransport } from '@/services/net/transport';

/**
 * Transporte WebSocket nativo — URL base via NEXT_PUBLIC_MULTIPLAYER_WS_URL
 * (ex.: ws://127.0.0.1:8787 ou wss://idle-mmorpg-mp.up.railway.app).
 * Sala = query mapKey.
 */
export class WsNetTransport implements NetTransport {
  readonly name = 'websocket';

  private socket: WebSocket | null = null;
  private connected = false;
  private readonly messageHandlers = new Set<NetMessageHandler>();
  private readonly statusHandlers = new Set<NetStatusHandler>();

  constructor(private readonly baseUrl: string) {}

  async connect(options: NetConnectOptions): Promise<void> {
    this.disconnect();

    const url = new URL(this.baseUrl);
    url.searchParams.set('mapKey', options.mapKey || 'default');
    url.searchParams.set('playerId', options.playerId);
    url.searchParams.set('nickname', options.nickname);

    const socket = new WebSocket(url.toString());
    this.socket = socket;

    const onMessage = (event: MessageEvent) => {
      if (typeof event.data !== 'string') return;
      try {
        const message = JSON.parse(event.data) as NetMessage;
        for (const handler of this.messageHandlers) handler(message);
      } catch {
        // ignore malformed
      }
    };
    const onClose = () => {
      if (this.socket !== socket) return;
      this.connected = false;
      this.emitStatus(false);
    };
    socket.addEventListener('message', onMessage);
    socket.addEventListener('close', onClose);

    await new Promise<void>((resolve, reject) => {
      const onOpen = () => {
        cleanup();
        this.connected = true;
        this.emitStatus(true);
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error('WebSocket connection failed'));
      };
      const cleanup = () => {
        socket.removeEventListener('open', onOpen);
        socket.removeEventListener('error', onError);
      };
      socket.addEventListener('open', onOpen);
      socket.addEventListener('error', onError);
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    if (this.connected) {
      this.connected = false;
      this.emitStatus(false);
    }
  }

  send(message: NetMessage): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify(message));
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

  private emitStatus(connected: boolean): void {
    for (const handler of this.statusHandlers) handler(connected);
  }
}
