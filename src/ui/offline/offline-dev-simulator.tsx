'use client';

import { useState } from 'react';
import { isDevMode } from '@/config/devConfig';
import { OFFLINE_LIMITS } from '@/constants/offline';
import { useStore } from '@/hooks/use-store';
import { offlineProgressStore } from '@/stores/offline-progress-store';

const SIM_HOURS = [1, 4, 8, 12] as const;

/** Simulador DEV — não altera vipStore nem eficiência de hunt. */
export function OfflineDevSimulator() {
  const open = useStore(offlineProgressStore, (s) => s.simulatorOpen);
  const [asVip, setAsVip] = useState(false);

  if (!isDevMode()) return null;

  return (
    <div className="offline-sim">
      <button
        type="button"
        className="offline-sim__toggle"
        onClick={() => offlineProgressStore.setSimulatorOpen(!open)}
      >
        SIMULAR OFFLINE
      </button>
      {open ? (
        <section className="offline-sim__panel" aria-label="Simular offline">
          <p className="offline-sim__label">Status</p>
          <div className="offline-sim__row">
            <button
              type="button"
              className={!asVip ? 'is-active' : undefined}
              onClick={() => setAsVip(false)}
            >
              Não VIP
            </button>
            <button
              type="button"
              className={asVip ? 'is-active' : undefined}
              onClick={() => setAsVip(true)}
            >
              VIP
            </button>
          </div>
          <p className="offline-sim__label">Tempo</p>
          <div className="offline-sim__row">
            {SIM_HOURS.map((hours) => (
              <button
                key={hours}
                type="button"
                onClick={() => offlineProgressStore.simulateDev({ hours, isVip: asVip })}
              >
                {hours}h
              </button>
            ))}
          </div>
          <p className="offline-sim__hint">
            Teto {asVip ? OFFLINE_LIMITS.vipHours : OFFLINE_LIMITS.nonVipHours}h nesta simulação.
            Não muda o VIP da conta.
          </p>
        </section>
      ) : null}
    </div>
  );
}
