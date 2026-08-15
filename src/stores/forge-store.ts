import { createStore } from '@/stores/create-store';

interface ForgeUiState {
  isOpen: boolean;
}

const store = createStore<ForgeUiState>({ isOpen: false });

export const forgeStore = {
  subscribe: store.subscribe,
  getSnapshot: store.getSnapshot,

  open(): void {
    store.setState({ isOpen: true });
  },

  close(): void {
    store.setState({ isOpen: false });
  },

  toggleOpen(): void {
    store.setState((state) => ({ isOpen: !state.isOpen }));
  },
};
