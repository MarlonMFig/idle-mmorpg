import { resolveCaptureEnemyTierFromDefinition } from '@/lib/capture-enemy-tier';
import { createStore } from '@/stores/create-store';
import type { CaptureEnemyTier } from '@/constants/capture-system';
import type { EnemyDefinition } from '@/types/enemy';

/** Fila máxima de corpos no chão (FIFO). */
const MAX_CAPTURE_OFFERS = 24;

export interface CaptureOffer {
  id: string;
  enemyId: string;
  name: string;
  level: number;
  lookType: number;
  captureTier: CaptureEnemyTier;
  definition: EnemyDefinition;
}

export interface CaptureState {
  offers: CaptureOffer[];
}

const store = createStore<CaptureState>({
  offers: [],
});

let seq = 0;

function nextId(): string {
  seq += 1;
  return `capture-${seq}`;
}

/**
 * Alvos derrotados aguardando recrutamento manual (Auto Recrutamento desligado).
 */
export const captureStore = {
  subscribe: store.subscribe,
  getSnapshot: store.getSnapshot,

  offer(definition: EnemyDefinition, level: number): void {
    const seal = definition.sealable;
    if (!seal) return;

    const next: CaptureOffer = {
      id: nextId(),
      enemyId: definition.id,
      name: seal.name,
      level,
      lookType: seal.lookType,
      captureTier: resolveCaptureEnemyTierFromDefinition(definition),
      definition,
    };

    const offers = [...store.getSnapshot().offers, next];
    while (offers.length > MAX_CAPTURE_OFFERS) offers.shift();
    store.setState({ offers });
  },

  remove(id: string): void {
    store.setState({
      offers: store.getSnapshot().offers.filter((offer) => offer.id !== id),
    });
  },

  clear(): void {
    if (store.getSnapshot().offers.length === 0) return;
    store.setState({ offers: [] });
  },
};
