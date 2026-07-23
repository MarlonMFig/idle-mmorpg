import type { NetConnectOptions, NetMessage } from '@/types/net';

export type NetMessageHandler = (message: NetMessage) => void;
export type NetStatusHandler = (connected: boolean) => void;

/**
 * Contrato de transporte em tempo real.
 * Implementações futuras: WebSocket, WebRTC data channel, etc.
 */
export interface NetTransport {
  readonly name: string;
  connect(options: NetConnectOptions): Promise<void>;
  disconnect(): void;
  send(message: NetMessage): void;
  onMessage(handler: NetMessageHandler): () => void;
  onStatus(handler: NetStatusHandler): () => void;
  isConnected(): boolean;
}
