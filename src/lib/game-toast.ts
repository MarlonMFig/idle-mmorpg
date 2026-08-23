type GameToastKind = 'achievement' | 'mission';

export interface GameToastPayload {
  kind: GameToastKind;
  id: string;
  name: string;
}

type GameToastListener = (payload: GameToastPayload) => void;

const listeners = new Set<GameToastListener>();
const queue: GameToastPayload[] = [];
let draining = false;

export function onGameToast(listener: GameToastListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function enqueueGameToast(payload: GameToastPayload): void {
  if (typeof window === 'undefined') return;
  queue.push(payload);
  drain();
}

function drain(): void {
  if (draining) return;
  draining = true;
  const tick = () => {
    const next = queue.shift();
    if (!next) {
      draining = false;
      return;
    }
    for (const listener of listeners) listener(next);
    window.setTimeout(tick, 2200);
  };
  tick();
}

export function enqueueAchievementUnlockToast(achievementId: string, name: string): void {
  enqueueGameToast({ kind: 'achievement', id: achievementId, name });
}

export function enqueueMissionCompleteToast(missionId: string, name: string): void {
  enqueueGameToast({ kind: 'mission', id: missionId, name });
}
