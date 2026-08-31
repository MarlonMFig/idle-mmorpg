import type { NetMessage, NetConnectOptions } from '@/types/net';
import type { NetMessageHandler, NetStatusHandler, NetTransport } from '@/services/net/transport';

/** Explicit production fallback; it never pretends that multiplayer is online. */
export class UnavailableNetTransport implements NetTransport {
  readonly name = 'unavailable';
  private readonly messageHandlers = new Set<NetMessageHandler>();
  private readonly statusHandlers = new Set<NetStatusHandler>();

  async connect(_options: NetConnectOptions): Promise<void> {
    for (const handler of this.statusHandlers) handler(false);
  }

  disconnect(): void {
    for (const handler of this.statusHandlers) handler(false);
  }

  send(_message: NetMessage): void {}

  onMessage(handler: NetMessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onStatus(handler: NetStatusHandler): () => void {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  isConnected(): boolean {
    return false;
  }
}
