/** Callback de flush síncrono do save — evita ciclo store ↔ session-persist. */

type FlushFn = () => void;

let flushFn: FlushFn | null = null;

export function setSessionSaveFlusher(fn: FlushFn | null): void {
  flushFn = fn;
}

/** Grava o save imediatamente (claim atômico / reload). */
export function flushSessionSaveNow(): void {
  flushFn?.();
}
