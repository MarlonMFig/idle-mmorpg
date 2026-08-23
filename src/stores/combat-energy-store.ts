/**
 * Runtime de Energia do combate (Item 41).
 * Estado do combatente ativo (jogador) — HUD + CombatSystem.
 * Companions usam mapa separado no TeamCompanionSystem.
 *
 * currentEnergy pode ser fracionário (regen por delta). UI arredonda só no display.
 */

import { COMBAT_ENERGY, computePassiveEnergyGain } from '@/constants/combat-energy';
import { isDevGameplayOverrideActive, isInfiniteChakra } from '@/config/devConfig';
import { createStore } from '@/stores/create-store';

export interface CombatEnergyState {
  currentEnergy: number;
  maxEnergy: number;
  /** DEV override; null = usar COMBAT_ENERGY.energyRegenPerSecond. */
  regenPerSecondOverride: number | null;
  /** DEV: congela regen passiva (basic hit continua). */
  freezePassiveRegen: boolean;
}

/** Clamp preservando frações (sem Math.floor no valor corrente). */
export function clampEnergy(current: number, max: number): number {
  const safeMax = Math.max(1, Number.isFinite(max) ? max : 1);
  const n = Number.isFinite(current) ? current : 0;
  return Math.max(0, Math.min(safeMax, n));
}

const store = createStore<CombatEnergyState>({
  currentEnergy: COMBAT_ENERGY.maxEnergy,
  maxEnergy: COMBAT_ENERGY.maxEnergy,
  regenPerSecondOverride: null,
  freezePassiveRegen: false,
});

export function isInfiniteEnergy(): boolean {
  return isInfiniteChakra();
}

function effectiveRegenPerSecond(state: CombatEnergyState = store.getSnapshot()): number {
  if (isInfiniteEnergy()) return 0;
  if (isDevGameplayOverrideActive() && state.freezePassiveRegen) return 0;
  if (isDevGameplayOverrideActive() && state.regenPerSecondOverride != null) {
    return Math.max(0, state.regenPerSecondOverride);
  }
  return COMBAT_ENERGY.energyRegenPerSecond;
}

export const combatEnergyStore = {
  subscribe: store.subscribe,
  getSnapshot: store.getSnapshot,

  reset(maxEnergy = COMBAT_ENERGY.maxEnergy): void {
    const max = Math.max(1, Math.floor(maxEnergy));
    const prev = store.getSnapshot();
    store.setState({
      currentEnergy: max,
      maxEnergy: max,
      regenPerSecondOverride: prev.regenPerSecondOverride,
      freezePassiveRegen: prev.freezePassiveRegen,
    });
  },

  setMaxEnergy(maxEnergy: number): void {
    const max = Math.max(1, Math.floor(maxEnergy));
    const state = store.getSnapshot();
    store.setState({
      ...state,
      maxEnergy: max,
      currentEnergy: clampEnergy(state.currentEnergy, max),
    });
  },

  setEnergy(value: number): void {
    const state = store.getSnapshot();
    store.setState({
      ...state,
      currentEnergy: clampEnergy(value, state.maxEnergy),
    });
  },

  fill(): void {
    const state = store.getSnapshot();
    store.setState({ ...state, currentEnergy: state.maxEnergy });
  },

  empty(): void {
    const state = store.getSnapshot();
    store.setState({ ...state, currentEnergy: 0 });
  },

  getCurrent(): number {
    return store.getSnapshot().currentEnergy;
  },

  getMax(): number {
    return store.getSnapshot().maxEnergy;
  },

  /** Valor efetivo de regen/s (respeita freeze/override DEV). */
  getRegenPerSecond(): number {
    return effectiveRegenPerSecond();
  },

  getConfiguredRegenPerSecond(): number {
    return COMBAT_ENERGY.energyRegenPerSecond;
  },

  getRegenOverride(): number | null {
    return store.getSnapshot().regenPerSecondOverride;
  },

  isPassiveRegenFrozen(): boolean {
    return store.getSnapshot().freezePassiveRegen;
  },

  /** DEV: override de regen/s. `null` = config central. */
  setRegenPerSecond(value: number | null): void {
    const state = store.getSnapshot();
    if (value == null || !Number.isFinite(value)) {
      store.setState({ ...state, regenPerSecondOverride: null });
      return;
    }
    store.setState({ ...state, regenPerSecondOverride: Math.max(0, value) });
  },

  setFreezePassiveRegen(frozen: boolean): void {
    const state = store.getSnapshot();
    store.setState({ ...state, freezePassiveRegen: Boolean(frozen) });
  },

  resetRegenSettings(): void {
    const state = store.getSnapshot();
    store.setState({
      ...state,
      regenPerSecondOverride: null,
      freezePassiveRegen: false,
    });
  },

  /** Para Decision Engine — null = custo ignorado (Energia Infinita DEV). */
  getDecisionEnergy(): number | null {
    if (isInfiniteEnergy()) return null;
    return store.getSnapshot().currentEnergy;
  },

  canAfford(cost: number): boolean {
    if (isInfiniteEnergy()) return true;
    const need = Math.max(0, Math.floor(cost));
    if (need <= 0) return true;
    return store.getSnapshot().currentEnergy >= need;
  },

  /**
   * Consome no commit da Skill (uma vez).
   * Retorna false se insuficiente (não altera estado).
   */
  spend(cost: number): boolean {
    if (isInfiniteEnergy()) return true;
    const need = Math.max(0, Math.floor(cost));
    if (need <= 0) return true;
    const state = store.getSnapshot();
    if (state.currentEnergy < need) return false;
    store.setState({
      ...state,
      currentEnergy: clampEnergy(state.currentEnergy - need, state.maxEnergy),
    });
    return true;
  },

  /**
   * Recuperação por hit(s) confirmado(s) de Basic Attack.
   * Retorna o ganho efetivo (após clamp).
   */
  gainFromBasicHit(hitCount = 1): number {
    if (isInfiniteEnergy()) return 0;
    const hits = Math.max(0, Math.floor(hitCount));
    if (hits <= 0) return 0;
    const gain = hits * COMBAT_ENERGY.energyGainPerBasicHit;
    const state = store.getSnapshot();
    const next = clampEnergy(state.currentEnergy + gain, state.maxEnergy);
    const applied = next - state.currentEnergy;
    store.setState({ ...state, currentEnergy: next });
    return applied;
  },

  /**
   * Regeneração passiva baseada em deltaSeconds (tempo de combate).
   * Não depende de FPS — o caller passa o delta acumulado.
   */
  tickPassiveRegen(deltaSeconds: number): number {
    if (isInfiniteEnergy()) return 0;
    const rate = effectiveRegenPerSecond();
    const gain = computePassiveEnergyGain(deltaSeconds, rate);
    if (gain <= 0) return 0;
    const state = store.getSnapshot();
    if (state.currentEnergy >= state.maxEnergy) return 0;
    const next = clampEnergy(state.currentEnergy + gain, state.maxEnergy);
    const applied = next - state.currentEnergy;
    if (applied <= 0) return 0;
    store.setState({ ...state, currentEnergy: next });
    return applied;
  },
};

export type CombatEnergyPool = {
  get current(): number;
  get max(): number;
  setEnergy(n: number): void;
  fill(): void;
  empty(): void;
  canAfford(cost: number): boolean;
  spend(cost: number): boolean;
  gainFromBasicHit(hits?: number): number;
  tickPassiveRegen(deltaSeconds: number, regenPerSecond?: number): number;
};

/** Pool local para companions / testes — mesma regra, sem store global. */
export function createCombatEnergyPool(maxEnergy = COMBAT_ENERGY.maxEnergy): CombatEnergyPool {
  let current: number = maxEnergy;
  const max: number = Math.max(1, Math.floor(maxEnergy));
  return {
    get current() {
      return current;
    },
    get max() {
      return max;
    },
    setEnergy(n: number) {
      current = clampEnergy(n, max);
    },
    fill() {
      current = max;
    },
    empty() {
      current = 0;
    },
    canAfford(cost: number) {
      const need = Math.max(0, Math.floor(cost));
      return need <= 0 || current >= need;
    },
    spend(cost: number) {
      const need = Math.max(0, Math.floor(cost));
      if (need <= 0) return true;
      if (current < need) return false;
      current = clampEnergy(current - need, max);
      return true;
    },
    gainFromBasicHit(hits = 1) {
      const n = Math.max(0, Math.floor(hits));
      if (n <= 0) return 0;
      const gain = n * COMBAT_ENERGY.energyGainPerBasicHit;
      const next = clampEnergy(current + gain, max);
      const applied = next - current;
      current = next;
      return applied;
    },
    tickPassiveRegen(deltaSeconds: number, regenPerSecond = COMBAT_ENERGY.energyRegenPerSecond) {
      const gain = computePassiveEnergyGain(deltaSeconds, regenPerSecond);
      if (gain <= 0) return 0;
      if (current >= max) return 0;
      const next = clampEnergy(current + gain, max);
      const applied = next - current;
      current = next;
      return applied;
    },
  };
}
