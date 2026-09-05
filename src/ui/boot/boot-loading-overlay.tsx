'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/hooks/use-store';
import {
  bootLoadingStore,
  type BootLoadingPhase,
} from '@/stores/boot-loading-store';
import './boot-loading-overlay.css';

const PHASE_COPY: Record<Exclude<BootLoadingPhase, 'ready'>, string> = {
  booting: 'Iniciando motor…',
  preload: 'Carregando mapas e sprites…',
  buildingWorld: 'Montando o hub…',
};

const FADE_MS = 320;
const SAFETY_TIMEOUT_MS = 15_000;

/**
 * Overlay full-screen até o hub Phaser ficar pronto.
 * Cobre HUD + canvas; some com fade curto após `ready`.
 */
export function BootLoadingOverlay() {
  const ready = useStore(bootLoadingStore, (s) => s.ready);
  const phase = useStore(bootLoadingStore, (s) => s.phase);
  const progress = useStore(bootLoadingStore, (s) => s.progress);
  const [visible, setVisible] = useState(() => !bootLoadingStore.getSnapshot().ready);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (!ready) {
      setVisible(true);
      setFading(false);
      return;
    }
    setFading(true);
    const id = window.setTimeout(() => setVisible(false), FADE_MS);
    return () => window.clearTimeout(id);
  }, [ready]);

  useEffect(() => {
    if (ready) return;
    const id = window.setTimeout(() => {
      if (bootLoadingStore.getSnapshot().ready) return;
      console.warn('[BootLoading] timeout de segurança — liberando overlay');
      bootLoadingStore.setReady(true);
    }, SAFETY_TIMEOUT_MS);
    return () => window.clearTimeout(id);
  }, [ready]);

  if (!visible) return null;

  const label =
    phase === 'ready' ? 'Pronto' : PHASE_COPY[phase] ?? 'Carregando…';
  const pct = Math.round(Math.max(0, Math.min(1, progress)) * 100);

  return (
    <div
      className={`boot-loading${fading ? ' is-fading' : ''}`}
      role="status"
      aria-live="polite"
      aria-busy={!ready}
    >
      <div className="boot-loading__panel">
        <p className="boot-loading__title">Carregando…</p>
        <p className="boot-loading__phase">{label}</p>
        <div
          className="boot-loading__bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
        >
          <span
            className="boot-loading__bar-fill"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="boot-loading__pct">{pct}%</p>
      </div>
    </div>
  );
}
