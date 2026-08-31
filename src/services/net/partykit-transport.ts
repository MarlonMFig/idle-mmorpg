import PartySocket from 'partysocket';
import { getMultiplayerAuthToken } from '@/services/net/multiplayer-auth';
import type { NetConnectOptions, NetMessage } from '@/types/net';
import type { NetMessageHandler, NetStatusHandler, NetTransport } from '@/services/net/transport';

/**
 * Transporte PartyKit — sala = mapKey.
 * Host via NEXT_PUBLIC_PARTYKIT_HOST (ex.: idle-mmorpg-world.user.partykit.dev).
 */
export class PartyKitTransport implements NetTransport {
  readonly name = 'partykit';

  private socket: PartySocket | null = null;
  private connected = false;
  private readonly messageHandlers = new Set<NetMessageHandler>();
  private readonly statusHandlers = new Set<NetStatusHandler>();

  constructor(private readonly host: string) {}

  async connect(options: NetConnectOptions): Promise<void> {
    this.disconnect();

    const token = await getMultiplayerAuthToken();
    const room = encodeURIComponent(options.mapKey || 'default');
    const socket = new PartySocket({
      host: this.host,
      room,
      query: {
        token,
      },
    });

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
        reject(new Error('PartyKit connection failed'));
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
    if (!this.socket || this.socket.readyState !== this.socket.OPEN) return;
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
