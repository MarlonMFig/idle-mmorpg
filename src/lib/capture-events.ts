import type { CharacterQuality } from '@/types/character-meta';
import type { SealedCharacter } from '@/types/team';

export interface CharacterCapturedEvent {
  instanceId: string;
  characterId: string;
  name: string;
  quality: CharacterQuality;
  instance: SealedCharacter;
}

type Listener = (event: CharacterCapturedEvent) => void;

const listeners = new Set<Listener>();

export function onCharacterCaptured(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitCharacterCaptured(event: CharacterCapturedEvent): void {
  for (const listener of listeners) listener(event);
}
