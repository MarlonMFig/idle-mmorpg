import { createStore } from '@/stores/create-store';

export interface HuntUiState {
  open: boolean;
}

const store = createStore<HuntUiState>({ open: false });

export const huntStore = {
  subscribe: store.subscribe,
  getSnapshot: store.getSnapshot,

  open(): void {
    store.setState({ open: true });
  },

  close(): void {
    store.setState({ open: false });
  },

  reset(): void {
    store.setState({ open: false });
  },
};
