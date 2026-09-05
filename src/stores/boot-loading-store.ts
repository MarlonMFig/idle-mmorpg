import { createStore } from '@/stores/create-store';

export type BootLoadingPhase = 'booting' | 'preload' | 'buildingWorld' | 'ready';

export interface BootLoadingState {
  ready: boolean;
  phase: BootLoadingPhase;
  /** 0–1 durante preload; nas outras fases é aproximado. */
  progress: number;
}

const INITIAL: BootLoadingState = {
  ready: false,
  phase: 'booting',
  progress: 0,
};

const store = createStore<BootLoadingState>({ ...INITIAL });

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

/**
 * Estado do overlay de boot (React) — Phaser emite fases até o hub ficar pronto.
 */
export const bootLoadingStore = {
  subscribe: store.subscribe,
  getSnapshot: store.getSnapshot,

  reset(): void {
    store.setState({ ...INITIAL });
  },

  setPhase(phase: BootLoadingPhase): void {
    const prev = store.getSnapshot();
    if (prev.ready && phase !== 'ready') return;
    if (prev.phase === phase) return;
    const progress =
      phase === 'booting' ? 0.02 : phase === 'preload' ? Math.max(prev.progress, 0.05) : phase === 'buildingWorld' ? Math.max(prev.progress, 0.85) : 1;
    store.setState({
      ...prev,
      phase,
      progress,
      ready: phase === 'ready' ? true : prev.ready,
    });
  },

  setProgress(progress: number): void {
    const prev = store.getSnapshot();
    if (prev.ready) return;
    const next = clamp01(progress);
    if (Math.abs(prev.progress - next) < 0.005) return;
    store.setState({ ...prev, progress: next });
  },

  setReady(ready = true): void {
    const prev = store.getSnapshot();
    if (prev.ready === ready && (!ready || prev.phase === 'ready')) return;
    store.setState({
      ready,
      phase: ready ? 'ready' : prev.phase === 'ready' ? 'booting' : prev.phase,
      progress: ready ? 1 : prev.progress,
    });
  },
};
