import type { GuildActivityType } from '@/types/guild';

type GuildEventHandler = (payload: Record<string, unknown>) => void;

const listeners = new Map<string, Set<GuildEventHandler>>();

function on(event: string, handler: GuildEventHandler): () => void {
  let set = listeners.get(event);
  if (!set) {
    set = new Set();
    listeners.set(event, set);
  }
  set.add(handler);
  return () => set!.delete(handler);
}

function emit(event: string, payload: Record<string, unknown> = {}): void {
  const set = listeners.get(event);
  if (!set) return;
  for (const handler of set) {
    try {
      handler(payload);
    } catch {
      // Guild events never break gameplay
    }
  }
}

export function onGuildCreated(handler: GuildEventHandler): () => void {
  return on('guildCreated', handler);
}
export function onGuildJoined(handler: GuildEventHandler): () => void {
  return on('guildJoined', handler);
}
export function onGuildLeft(handler: GuildEventHandler): () => void {
  return on('guildLeft', handler);
}
export function onGuildLevelUp(handler: GuildEventHandler): () => void {
  return on('guildLevelUp', handler);
}
export function onGuildMemberPromoted(handler: GuildEventHandler): () => void {
  return on('guildMemberPromoted', handler);
}
export function onGuildDissolved(handler: GuildEventHandler): () => void {
  return on('guildDissolved', handler);
}

export function emitGuildEvent(
  type: GuildActivityType | 'guildCreated' | 'guildJoined' | 'guildLeft' | 'guildLevelUp' | 'guildMemberPromoted' | 'guildDissolved',
  payload: Record<string, unknown> = {},
): void {
  emit(type, payload);
}
