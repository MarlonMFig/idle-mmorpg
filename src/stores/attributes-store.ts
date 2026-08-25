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
import { resolveQualityStatMultiplier } from '@/constants/character-quality-stats';
import type { CharacterPotential, CharacterQuality } from '@/types/character-meta';
import { computePlayerAttributes, emptyModifiers } from '@/utils/attributes';
import { resolveAwakeningRuntime } from '@/lib/awakening-runtime';

function activeStars(): number {
  return teamStore.getActive()?.stars ?? 0;
}

function activeQuality(): CharacterQuality {
  return teamStore.getActive()?.quality ?? 'D';
}

function activeQualityStatMultiplier(): number {
  const active = teamStore.getActive();
  return resolveQualityStatMultiplier(active?.quality, active?.qualityStatMultiplier, active?.potential);
}

function activeCharacterLevel(): number {
  return Math.max(1, teamStore.getActive()?.level || 1);
}

function buildState(
  level: number,
  stars: number,
  activeBuffs: AttributeBuff[],
  awakening?: { characterId: string | null; awakeningLevel: number },
  quality: CharacterQuality = 'D',
  qualityStatMultiplier?: number,
  potential?: CharacterPotential | null,
): PlayerAttributes {
  const runtime = awakening ?? resolveAwakeningRuntime();
  return computePlayerAttributes({
    level,
    stars,
    quality,
    qualityStatMultiplier,
    potential,
    buffs: activeBuffs,
    characterId: runtime.characterId,
    awakeningLevel: runtime.awakeningLevel,
  });
}

let buffs: AttributeBuff[] = [];

function liveState(): PlayerAttributes {
  return buildState(
    activeCharacterLevel(),
    activeStars(),
    buffs,
    undefined,
    activeQuality(),
    activeQualityStatMultiplier(),
    teamStore.getActive()?.potential,
  );
}

const store = createStore<PlayerAttributes>(
  buildState(1, 0, buffs, { characterId: null, awakeningLevel: 0 }),
);

function syncVitals(fullHeal: boolean): void {
  const { totals } = store.getSnapshot();
  vitalsStore.applyAttributeCaps(totals.hp, fullHeal);
}

/**
 * Atributos do jogador: base×estrelas do principal + nível + quality + buffs.
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
   * Recalcula totais (estrelas do principal ativo + nível + qualidade + buffs).
   * @param fullHeal restaura HP ao máximo (início de partida).
   */
  recalculate(fullHeal = false): void {
    this.pruneExpiredBuffs();
    store.setState(liveState());
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
    store.setState(liveState());
    syncVitals(false);
  },

  removeBuff(id: string): void {
    const next = buffs.filter((buff) => buff.id !== id);
    if (next.length === buffs.length) return;
    buffs = next;
    store.setState(liveState());
    syncVitals(false);
  },

  clearBuffs(): void {
    if (buffs.length === 0) return;
    buffs = [];
    store.setState(liveState());
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
  awakening: {},
  lineage: {},
  buffs: {},
  activeBuffs: [],
};
