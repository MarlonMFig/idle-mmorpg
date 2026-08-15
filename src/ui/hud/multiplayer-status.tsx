'use client';

import { useMultiplayerStore } from '@/hooks/use-multiplayer-store';

const STATUS_LABEL = {
  disconnected: 'Offline',
  connecting: 'Conectando…',
  connected: 'Online',
  error: 'Erro de rede',
} as const;

/**
 * Indicador de conexão multiplayer.
 */
export function MultiplayerStatus() {
  const { status, transportName, remoteCount } = useMultiplayerStore();
  const label =
    status === 'connected' && transportName === 'stub'
      ? 'Online (local)'
      : STATUS_LABEL[status];

  return (
    <div
      className={`hud-net is-${status}`}
      title={`Transporte: ${transportName}`}
      aria-label="Status multiplayer"
    >
      <span className="hud-net__dot" aria-hidden />
      <span className="hud-net__label">{label}</span>
      {status === 'connected' ? (
        <span className="hud-net__remotes">{remoteCount} remoto{remoteCount === 1 ? '' : 's'}</span>
      ) : null}
    </div>
  );
}
