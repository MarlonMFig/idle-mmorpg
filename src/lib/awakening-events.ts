export interface CharacterAwakenedEvent {
  instanceId: string;
  oldAwakening: number;
  newAwakening: number;
}

type Listener = (event: CharacterAwakenedEvent) => void;

const listeners = new Set<Listener>();

export function onCharacterAwakened(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitCharacterAwakened(event: CharacterAwakenedEvent): void {
  for (const listener of listeners) listener(event);
}
