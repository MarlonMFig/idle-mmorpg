import { createStore } from '@/stores/create-store';

interface MedicUiState {
  isOpen: boolean;
  /** Marca o último atendimento para a animação de confirmação. */
  healedAt: number;
}

const store = createStore<MedicUiState>({ isOpen: false, healedAt: 0 });

/** Centro de Cura Ninja — recuperação de HP no Hub (Copper). */
export const medicStore = {
  subscribe: store.subscribe,
  getSnapshot: store.getSnapshot,

  open(): void {
    store.setState((state) => ({ ...state, isOpen: true }));
  },

  close(): void {
    store.setState((state) => ({ ...state, isOpen: false }));
  },

  toggleOpen(): void {
    store.setState((state) => ({ ...state, isOpen: !state.isOpen }));
  },

  markHealed(now = Date.now()): void {
    store.setState((state) => ({ ...state, healedAt: now }));
  },
};
