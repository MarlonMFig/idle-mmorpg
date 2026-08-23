export interface BossAttemptStartedEvent {
  bossId: string;
  instanceId: string;
}

export interface BossDefeatedEvent {
  bossId: string;
  instanceId: string;
  damageDealt: number;
  durationMs: number;
  firstClear: boolean;
}

export interface BossFailedEvent {
  bossId: string;
  instanceId: string;
  reason: 'player-death' | 'timeout' | 'abandon';
  damageDealt: number;
}

type StartedListener = (event: BossAttemptStartedEvent) => void;
type DefeatedListener = (event: BossDefeatedEvent) => void;
type FailedListener = (event: BossFailedEvent) => void;

const started = new Set<StartedListener>();
const defeated = new Set<DefeatedListener>();
const failed = new Set<FailedListener>();

export function onBossAttemptStarted(listener: StartedListener): () => void {
  started.add(listener);
  return () => started.delete(listener);
}

export function onBossDefeated(listener: DefeatedListener): () => void {
  defeated.add(listener);
  return () => defeated.delete(listener);
}

export function onBossFailed(listener: FailedListener): () => void {
  failed.add(listener);
  return () => failed.delete(listener);
}

export function emitBossAttemptStarted(event: BossAttemptStartedEvent): void {
  for (const listener of started) listener(event);
}

export function emitBossDefeated(event: BossDefeatedEvent): void {
  for (const listener of defeated) listener(event);
}

export function emitBossFailed(event: BossFailedEvent): void {
  for (const listener of failed) listener(event);
}
