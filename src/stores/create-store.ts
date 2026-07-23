/**
 * Factory de stores pub/sub — base única para o projeto.
 * Evita boilerplate Listener/emit/setState em cada módulo.
 */

export type StoreListener = () => void;

export interface ReadableStore<T> {
  subscribe(listener: StoreListener): () => void;
  getSnapshot(): T;
}

export interface WritableStore<T> extends ReadableStore<T> {
  /** Substitui o estado e notifica assinantes. */
  setState(next: T | ((prev: T) => T)): void;
}

export function createStore<T>(initialState: T): WritableStore<T> {
  let state = initialState;
  const listeners = new Set<StoreListener>();

  return {
    subscribe(listener: StoreListener): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    getSnapshot(): T {
      return state;
    },

    setState(next: T | ((prev: T) => T)): void {
      const value = typeof next === 'function' ? (next as (prev: T) => T)(state) : next;
      state = value;
      for (const listener of listeners) listener();
    },
  };
}
