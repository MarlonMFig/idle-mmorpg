'use client';

import { useStore } from '@/hooks/use-store';
import { multiplayerStore, type MultiplayerUiState } from '@/stores/multiplayer-store';

export function useMultiplayerStore(): MultiplayerUiState {
  return useStore(multiplayerStore);
}
