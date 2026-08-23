type Handler = (payload: Record<string, unknown>) => void;

const listeners = new Set<Handler>();

export function onRewardGranted(handler: Handler): () => void {
  listeners.add(handler);
  return () => listeners.delete(handler);
}

export function emitRewardGranted(payload: {
  source: string;
  sourceId?: string;
  transactionId?: string;
  rewards: Record<string, unknown>;
}): void {
  for (const h of listeners) {
    try {
      h(payload);
    } catch {
      // never break gameplay
    }
  }
}
