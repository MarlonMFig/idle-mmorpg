import { DEFAULT_VITALS } from '@/constants/hud';
import { xpRequiredForLevel } from '@/data/xp-stages';
import { createStore } from '@/stores/create-store';
import type { VitalsState } from '@/types/hud';

const store = createStore<VitalsState>({ ...DEFAULT_VITALS });

/**
 * Vitals do jogador — HP atual + XP.
 * Cap de HP vem de `attributesStore` via `applyAttributeCaps`.
 * Curva de XP usa estágios WONSR (`xp-stages`).
 * Level/XP entram no snapshot `idle-mmorpg:session-v1`.
 */
export const vitalsStore = {
  subscribe: store.subscribe,
  getSnapshot: store.getSnapshot,

  getLevel(): number {
    return store.getSnapshot().level;
  },

  reset(initial: VitalsState = DEFAULT_VITALS): void {
    const level = initial.level || 1;
    store.setState({
      ...initial,
      xpMax: initial.xpMax || xpRequiredForLevel(level),
    });
  },

  applyAttributeCaps(hpMax: number, fullHeal = false): void {
    const state = store.getSnapshot();
    const hp = fullHeal ? hpMax : Math.min(state.hp, hpMax);
    store.setState({ ...state, hp, hpMax });
  },

  healFull(): void {
    const state = store.getSnapshot();
    store.setState({ ...state, hp: state.hpMax });
  },

  addXp(amount: number): boolean {
    if (amount <= 0) return false;

    const state = store.getSnapshot();
    let { xp, xpMax, level } = state;
    const { hp, hpMax } = state;
    xp += amount;
    let leveled = false;

    while (xp >= xpMax) {
      xp -= xpMax;
      level += 1;
      xpMax = xpRequiredForLevel(level);
      leveled = true;
    }

    store.setState({ hp, hpMax, xp, xpMax, level });
    return leveled;
  },
};
