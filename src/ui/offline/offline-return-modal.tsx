'use client';

import { useEffect } from 'react';
import {
  formatOfflineDuration,
  formatOfflineHoursLabel,
  getMaxOfflineHours,
} from '@/constants/offline';
import { useStore } from '@/hooks/use-store';
import { getItem } from '@/data/items';
import { formatCopper } from '@/data/shop';
import { offlineProgressStore } from '@/stores/offline-progress-store';

/**
 * Relatório de retorno. Usa o snapshot gravado (VIP/limite daquele cálculo).
 */
export function OfflineReturnModal() {
  const pending = useStore(offlineProgressStore, (s) => s.pending);

  useEffect(() => {
    return offlineProgressStore.startPresenceTracking();
  }, []);

  if (!pending) return null;

  const limitHours = getMaxOfflineHours(pending.vipStatusUsed);
  const limitLabel = pending.vipStatusUsed ? 'Limite VIP' : 'Limite atual';

  return (
    <div className="offline-report" role="dialog" aria-modal="true" aria-label="Progresso offline">
      <header className="offline-report__head">
        <h2 className="offline-report__title">PROGRESSO OFFLINE</h2>
        <button
          type="button"
          className="offline-report__close"
          aria-label="Fechar progresso offline"
          onClick={() => offlineProgressStore.dismissPending()}
        >
          ×
        </button>
      </header>
      <dl className="offline-report__stats">
        <div>
          <dt>Tempo fora</dt>
          <dd>{formatOfflineDuration(pending.actualOfflineDuration)}</dd>
        </div>
        <div>
          <dt>Tempo contabilizado</dt>
          <dd>{formatOfflineDuration(pending.effectiveOfflineDuration)}</dd>
        </div>
        <div>
          <dt>{limitLabel}</dt>
          <dd>{formatOfflineHoursLabel(limitHours)}</dd>
        </div>
      </dl>
      <p className="offline-report__hint">
        Limite de progresso offline: {formatOfflineHoursLabel(limitHours)}
      </p>
      <p className="offline-report__hint">
        {pending.killsSimulated} kills · {formatCopper(pending.reward.copper)} cobre
      </p>
      {pending.reward.items.length > 0 ? (
        <ul className="offline-report__hint">
          {pending.reward.items.slice(0, 8).map((item) => (
            <li key={item.itemId}>
              {getItem(item.itemId)?.name ?? item.itemId} ×{item.quantity}
            </li>
          ))}
        </ul>
      ) : null}
      {pending.applied ? (
        <p className="offline-report__hint">Inventário cheio — itens restantes pendentes.</p>
      ) : null}
      <button type="button" className="offline-report__ok" onClick={() => offlineProgressStore.collectPending()}>
        Continuar
      </button>
    </div>
  );
}
