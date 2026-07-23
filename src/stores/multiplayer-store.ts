import { createStore } from '@/stores/create-store';
import type { NetConnectionStatus } from '@/types/net';

export interface MultiplayerUiState {
  status: NetConnectionStatus;
  transportName: string;
  localPlayerId: string | null;
  remoteCount: number;
}

const initialState: MultiplayerUiState = {
  status: 'disconnected',
  transportName: 'stub',
  localPlayerId: null,
  remoteCount: 0,
};

const store = createStore<MultiplayerUiState>(initialState);

/** Estado de conexão multiplayer para a HUD (React). */
export const multiplayerStore = {
  subscribe: store.subscribe,
  getSnapshot: store.getSnapshot,

  reset(): void {
    store.setState({ ...initialState });
  },

  setConnecting(transportName: string): void {
    store.setState({ ...store.getSnapshot(), status: 'connecting', transportName });
  },

  setConnected(localPlayerId: string, transportName: string): void {
    store.setState({
      ...store.getSnapshot(),
      status: 'connected',
      localPlayerId,
      transportName,
    });
  },

  setDisconnected(): void {
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
};
