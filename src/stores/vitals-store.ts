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

  /** Cura HP (clamp em hpMax). Retorna o valor efetivamente curado. */
  heal(amount: number): number {
    if (amount <= 0) return 0;
    const state = store.getSnapshot();
    if (state.hp <= 0 || state.hp >= state.hpMax) return 0;
    const next = Math.min(state.hpMax, state.hp + Math.floor(amount));
    const healed = next - state.hp;
    if (healed <= 0) return 0;
    store.setState({ ...state, hp: next });
    return healed;
  },

  /**
   * Aplica dano ao HP. Defesa reduz o golpe (mínimo 1).
   * Retorna o dano efetivo e se o jogador morreu.
   */
  applyDamage(rawAmount: number, defense = 0): { damage: number; died: boolean } {
    if (rawAmount <= 0) return { damage: 0, died: false };
    const state = store.getSnapshot();
    if (state.hp <= 0) return { damage: 0, died: true };

    const mitigated = Math.max(1, Math.floor(rawAmount - defense * 0.35));
    const hp = Math.max(0, state.hp - mitigated);
    store.setState({ ...state, hp });
    return { damage: mitigated, died: hp <= 0 };
  },

  isDead(): boolean {
    return store.getSnapshot().hp <= 0;
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
