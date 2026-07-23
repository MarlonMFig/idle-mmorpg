import { MULTIPLAYER_REGISTRY_KEY } from '@/constants/multiplayer';
import type { PlayerSession } from '@/types/player-session';
import type { StarterCharacterId } from '@/types/player-creation';

interface RegistryLike {
  get(key: string): unknown;
  set(key: string, value: unknown): unknown;
}

const STARTERS: readonly StarterCharacterId[] = [
  'naruto-classic',
  'sasuke-classic',
  'rock-lee',
];

function isStarterId(value: unknown): value is StarterCharacterId {
  return typeof value === 'string' && (STARTERS as readonly string[]).includes(value);
}

/** Acesso tipado ao registry do Phaser (sem `as` espalhado). */
export function getPlayerSession(registry: RegistryLike): PlayerSession | undefined {
  const value = registry.get(MULTIPLAYER_REGISTRY_KEY);
  if (!value || typeof value !== 'object') return undefined;
  const session = value as Partial<PlayerSession>;
  if (
    typeof session.playerId !== 'string' ||
    typeof session.nickname !== 'string' ||
    typeof session.villageId !== 'string' ||
    !isStarterId(session.starterCharacterId)
  ) {
    return undefined;
  }
  return session as PlayerSession;
}

export function setPlayerSession(registry: RegistryLike, session: PlayerSession): void {
  registry.set(MULTIPLAYER_REGISTRY_KEY, session);
}
