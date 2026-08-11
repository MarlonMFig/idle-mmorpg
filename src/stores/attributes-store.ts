import { BASE_ATTRIBUTES } from '@/constants/attributes';
import { createStore } from '@/stores/create-store';
import { teamStore } from '@/stores/team-store';
import { vitalsStore } from '@/stores/vitals-store';
import type {
  AttributeBuff,
  AttributeId,
  AttributeModifiers,
  PlayerAttributes,
} from '@/types/attributes';
import { computePlayerAttributes, emptyModifiers } from '@/utils/attributes';

function activeStars(): number {
  return teamStore.getActive()?.stars ?? 0;
}

function buildState(level: number, stars: number, activeBuffs: AttributeBuff[]): PlayerAttributes {
  return computePlayerAttributes({ level, stars, buffs: activeBuffs });
}

let buffs: AttributeBuff[] = [];

const store = createStore<PlayerAttributes>(buildState(1, 0, buffs));

function syncVitals(fullHeal: boolean): void {
  const { totals } = store.getSnapshot();
  vitalsStore.applyAttributeCaps(totals.hp, fullHeal);
}

/**
 * Atributos do jogador: base×estrelas do principal + nível + buffs.
 * Sem camada de equipamento.
 */
export const attributesStore = {
  subscribe: store.subscribe,
  getSnapshot: store.getSnapshot,

  get(id: AttributeId): number {
    return store.getSnapshot().totals[id];
  },

  getStrength(): number {
    return store.getSnapshot().totals.strength;
  },

  getDefense(): number {
    return store.getSnapshot().totals.defense;
  },

  getSpeed(): number {
    return store.getSnapshot().totals.speed;
  },

  getAccuracy(): number {
    return store.getSnapshot().totals.accuracy;
  },

  getCritical(): number {
    return store.getSnapshot().totals.critical;
  },

  /**
   * Recalcula totais (estrelas do principal ativo + nível + buffs).
   * @param fullHeal restaura HP ao máximo (início de partida).
   */
  recalculate(fullHeal = false): void {
    this.pruneExpiredBuffs();
    store.setState(buildState(vitalsStore.getLevel(), activeStars(), buffs));
    syncVitals(fullHeal);
  },

  /** Chamado após level-up / troca de principal / forja. */
  onLevelChanged(fullHeal = true): void {
    this.recalculate(fullHeal);
  },

  /** Recalcular quando estrelas ou principal mudam. */
  onActiveCharacterChanged(fullHeal = false): void {
    this.recalculate(fullHeal);
  },

  reset(): void {
    buffs = [];
    store.setState(buildState(1, 0, buffs));
    syncVitals(true);
  },

  addBuff(id: string, modifiers: AttributeModifiers, durationMs?: number): void {
    const expiresAt = durationMs != null ? Date.now() + durationMs : undefined;
    buffs = [...buffs.filter((buff) => buff.id !== id), { id, modifiers, expiresAt }];
    store.setState(buildState(vitalsStore.getLevel(), activeStars(), buffs));
    syncVitals(false);
  },

  removeBuff(id: string): void {
    const next = buffs.filter((buff) => buff.id !== id);
    if (next.length === buffs.length) return;
    buffs = next;
    store.setState(buildState(vitalsStore.getLevel(), activeStars(), buffs));
    syncVitals(false);
  },

  clearBuffs(): void {
    if (buffs.length === 0) return;
    buffs = [];
    store.setState(buildState(vitalsStore.getLevel(), activeStars(), buffs));
    syncVitals(false);
  },

  pruneExpiredBuffs(now = Date.now()): void {
    const next = buffs.filter((buff) => buff.expiresAt == null || buff.expiresAt > now);
    if (next.length === buffs.length) return;
    buffs = next;
  },

  getBuffLayer(): AttributeModifiers {
    return store.getSnapshot().buffs ?? emptyModifiers();
  },
};

/** Snapshot estático inicial (SSR / fallback). */
export const INITIAL_ATTRIBUTES: PlayerAttributes = {
  totals: { ...BASE_ATTRIBUTES },
  base: { ...BASE_ATTRIBUTES },
  level: {},
  equipment: {},
  buffs: {},
  activeBuffs: [],
};
