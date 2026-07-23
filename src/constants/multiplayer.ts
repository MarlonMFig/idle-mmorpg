/** Intervalo de envio do estado local (ms). */
export const MULTIPLAYER_SEND_INTERVAL_MS = 100;

/** Interpolação de remotes. */
export const MULTIPLAYER_INTERPOLATION = 0.22;

/**
 * Stub: simula 1 peer fantasma para validar o pipeline de sync.
 * Trocar `StubNetTransport` por WebSocket real depois — a API permanece.
 */
export const MULTIPLAYER_SIMULATE_PEERS = false;

export const MULTIPLAYER_REGISTRY_KEY = 'playerSession';
