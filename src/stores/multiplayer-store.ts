import { createStore } from '@/stores/create-store';
import type { NetConnectionStatus } from '@/types/net';

export interface MultiplayerUiState {
  status: NetConnectionStatus;
  transportName: string;
  localPlayerId: string | null;
  remoteCount: number;
  nickname: string;
}

const initialState: MultiplayerUiState = {
  status: 'disconnected',
  transportName: 'stub',
  localPlayerId: null,
  remoteCount: 0,
  nickname: 'Shinobi',
};

type ChatSender = (text: string) => void;

let chatSender: ChatSender | null = null;

const store = createStore<MultiplayerUiState>(initialState);

/** Estado de conexão multiplayer para a HUD (React). */
export const multiplayerStore = {
  subscribe: store.subscribe,
  getSnapshot: store.getSnapshot,

  reset(): void {
    chatSender = null;
    store.setState({ ...initialState });
  },

  setConnecting(transportName: string): void {
    store.setState({ ...store.getSnapshot(), status: 'connecting', transportName });
  },

  setConnected(localPlayerId: string, transportName: string, nickname?: string): void {
    store.setState({
      ...store.getSnapshot(),
      status: 'connected',
      localPlayerId,
      transportName,
      nickname: nickname?.trim() || store.getSnapshot().nickname,
    });
  },

  setDisconnected(): void {
    chatSender = null;
    store.setState({
      ...store.getSnapshot(),
      status: 'disconnected',
      localPlayerId: null,
      remoteCount: 0,
    });
  },

  setError(): void {
    store.setState({ ...store.getSnapshot(), status: 'error' });
  },

  setRemoteCount(remoteCount: number): void {
    store.setState({ ...store.getSnapshot(), remoteCount });
  },

  /** GameScene registra o envio de chat via MultiplayerClient. */
  registerChatSender(sender: ChatSender | null): void {
    chatSender = sender;
  },

  sendChat(text: string): boolean {
    if (!chatSender) return false;
    const trimmed = text.trim();
    if (!trimmed) return false;
    chatSender(trimmed);
    return true;
  },

  canChat(): boolean {
    return chatSender != null && store.getSnapshot().status === 'connected';
  },
};
