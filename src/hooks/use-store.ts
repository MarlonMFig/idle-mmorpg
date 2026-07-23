'use client';

import { useSyncExternalStore } from 'react';
import type { ReadableStore } from '@/stores/create-store';

/**
 * Hook genérico com seletor — reduz re-renders desnecessários.
 * O seletor deve retornar valor estável (primitivo ou ref memoizável).
 */
export function useStore<T, Selected = T>(
  store: ReadableStore<T>,
  selector: (state: T) => Selected = (state) => state as unknown as Selected,
): Selected {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getSnapshot()),
    () => selector(store.getSnapshot()),
  );
}
