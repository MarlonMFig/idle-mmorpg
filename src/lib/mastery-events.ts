export interface MasteryLevelUpEvent {
  instanceId: string;
  oldLevel: number;
  newLevel: number;
}

type Listener = (event: MasteryLevelUpEvent) => void;

const listeners = new Set<Listener>();

export function onMasteryLevelUp(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitMasteryLevelUp(event: MasteryLevelUpEvent): void {
  for (const listener of listeners) listener(event);
}
