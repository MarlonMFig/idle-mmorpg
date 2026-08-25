import { DEFAULT_VITALS } from '@/constants/hud';
import { Decimal, d, floorNonNeg, parseDecimal, type Decimal as DecimalValue } from '@/lib/decimal';
import { addExperience, getXpRequiredForLevel } from '@/lib/player-progression';
import { isPlayerInvincible } from '@/config/devConfig';
import { characterLabStore, isCharacterLabSession } from '@/stores/character-lab-store';
import { createStore } from '@/stores/create-store';
import type { VitalsState } from '@/types/hud';

const store = createStore<VitalsState>({ ...DEFAULT_VITALS });

/**
 * Vitals do jogador — HP atual + XP.
 * Cap de HP vem de `attributesStore` via `applyAttributeCaps`.
 * Curva de XP: `@/lib/player-progression` (`LEVEL_RULES`).
 * Level/XP entram no snapshot `idle-mmorpg:session-v1`.
 */
export const vitalsStore = {
  subscribe: store.subscribe,
  getSnapshot: store.getSnapshot,

  getLevel(): number {
    return store.getSnapshot().level;
  },

  reset(initial: {
    hp: number | DecimalValue;
    hpMax: number | DecimalValue;
    xp: number | DecimalValue;
    xpMax: number | DecimalValue;
    level: number;
  } = DEFAULT_VITALS): void {
    const level = initial.level || 1;
    store.setState({
      hp: parseDecimal(initial.hp),
      hpMax: Decimal.max(d(1), parseDecimal(initial.hpMax)),
      xp: parseDecimal(initial.xp),
      xpMax: getXpRequiredForLevel(level),
      level,
    });
  },

  applyAttributeCaps(hpMax: number | DecimalValue, fullHeal = false): void {
    const cap = Decimal.max(d(1), floorNonNeg(hpMax));
    const state = store.getSnapshot();
    const hp = fullHeal ? cap : Decimal.min(state.hp, cap);
    store.setState({ ...state, hp, hpMax: cap });
  },

  healFull(): void {
    const state = store.getSnapshot();
    store.setState({ ...state, hp: state.hpMax });
  },

  /** Cura HP (clamp em hpMax). Retorna o valor efetivamente curado. */
  heal(amount: number | DecimalValue): DecimalValue {
    const gain = floorNonNeg(amount);
    if (gain.lte(0)) return d(0);
    const state = store.getSnapshot();
    if (state.hp.lte(0) || state.hp.gte(state.hpMax)) return d(0);
    const next = Decimal.min(state.hpMax, state.hp.add(gain));
    const healed = next.sub(state.hp);
    if (healed.lte(0)) return d(0);
    store.setState({ ...state, hp: next });
    return healed;
  },

  /**
   * Aplica dano ao HP. Defesa reduz o golpe (mínimo 1).
   * Retorna o dano efetivo e se o jogador morreu.
   */
  applyDamage(rawAmount: number | DecimalValue, defense: number | DecimalValue = 0): { damage: DecimalValue; died: boolean } {
    if (
      isPlayerInvincible() ||
      (isCharacterLabSession() && characterLabStore.getSnapshot().playerInvincible)
    ) {
      return { damage: d(0), died: false };
    }
    const raw = d(rawAmount);
    if (raw.lte(0)) return { damage: d(0), died: false };
    const state = store.getSnapshot();
    if (state.hp.lte(0)) return { damage: d(0), died: true };

    const mitigated = Decimal.max(d(1), raw.sub(d(defense).mul(0.35)).floor());
    const hp = Decimal.max(d(0), state.hp.sub(mitigated));
    store.setState({ ...state, hp });
    return { damage: mitigated, died: hp.lte(0) };
  },

  /** HP já mitigado (defesa + elemento). Não reaplica defesa. 0 permanece 0. */
  applyHpLoss(amount: number | DecimalValue): { damage: DecimalValue; died: boolean } {
    if (
      isPlayerInvincible() ||
      (isCharacterLabSession() && characterLabStore.getSnapshot().playerInvincible)
    ) {
      return { damage: d(0), died: false };
    }
    const loss = floorNonNeg(amount);
    if (loss.lte(0)) return { damage: d(0), died: false };
    const state = store.getSnapshot();
    if (state.hp.lte(0)) return { damage: d(0), died: true };
    const hp = Decimal.max(d(0), state.hp.sub(loss));
    store.setState({ ...state, hp });
    return { damage: loss, died: hp.lte(0) };
  },

  isDead(): boolean {
    return store.getSnapshot().hp.lte(0);
  },

  addXp(amount: number | DecimalValue): boolean {
    const gain = parseDecimal(amount);
    if (gain.lte(0)) return false;

    const state = store.getSnapshot();
    const next = addExperience(state.level, state.xp, gain);
    store.setState({
      hp: state.hp,
      hpMax: state.hpMax,
      xp: next.xp,
      xpMax: next.xpMax,
      level: next.level,
    });
    return next.leveled;
  },
};
