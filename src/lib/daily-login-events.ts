export interface DailyRewardClaimedEvent {
  day: number;
  cycleId: string;
  totalClaims: number;
}

type Listener = (event: DailyRewardClaimedEvent) => void;

const listeners = new Set<Listener>();

/** Reservado para Achievements futuros. Item 25 não cria conquistas novas. */
export function onDailyRewardClaimed(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitDailyRewardClaimed(event: DailyRewardClaimedEvent): void {
  for (const listener of listeners) listener(event);
}
