import type { GuildBossAttemptEndReason } from '@/types/guild-boss';

type Handler = (payload: Record<string, unknown>) => void;

const listeners = new Map<string, Set<Handler>>();

function on(event: string, handler: Handler): () => void {
  let set = listeners.get(event);
  if (!set) {
    set = new Set();
    listeners.set(event, set);
  }
  set.add(handler);
  return () => set!.delete(handler);
}

function emit(event: string, payload: Record<string, unknown>): void {
  const set = listeners.get(event);
  if (!set) return;
  for (const h of set) {
    try {
      h(payload);
    } catch {
      // never break gameplay
    }
  }
}

export function onGuildBossAttemptFinished(handler: Handler): () => void {
  return on('guildBossAttemptFinished', handler);
}
export function onGuildBossDefeated(handler: Handler): () => void {
  return on('guildBossDefeated', handler);
}
export function onGuildBossMilestoneReached(handler: Handler): () => void {
  return on('guildBossMilestoneReached', handler);
}

export function emitGuildBossAttemptFinished(payload: {
  guildId: string;
  attemptId: string;
  playerId: string;
  validDamage: number;
  endReason: GuildBossAttemptEndReason;
}): void {
  emit('guildBossAttemptFinished', payload);
}

export function emitGuildBossDefeated(payload: {
  guildId: string;
  bossId: string;
  cycleId: string;
}): void {
  emit('guildBossDefeated', payload);
}

export function emitGuildBossMilestoneReached(payload: {
  guildId: string;
  milestoneId: string;
  hpRatio: number;
}): void {
  emit('guildBossMilestoneReached', payload);
}
