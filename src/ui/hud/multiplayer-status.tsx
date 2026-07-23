'use client';

import { useMultiplayerStore } from '@/hooks/use-multiplayer-store';

const STATUS_LABEL = {
  disconnected: 'Offline',
  connecting: 'Conectando…',
  connected: 'Online (stub)',
  error: 'Erro de rede',
} as const;

/**
 * Indicador de conexão multiplayer (transporte stub por enquanto).
 */
export function MultiplayerStatus() {
  const { status, transportName, remoteCount } = useMultiplayerStore();

  return (
    <div
      className={`hud-net is-${status}`}
      title={`Transporte: ${transportName}`}
      aria-label="Status multiplayer"
    >
      <span className="hud-net__dot" aria-hidden />
      <span className="hud-net__label">{STATUS_LABEL[status]}</span>
      {status === 'connected' ? (
        <span className="hud-net__remotes">{remoteCount} remoto{remoteCount === 1 ? '' : 's'}</span>
      ) : null}
    </div>
  );
}
