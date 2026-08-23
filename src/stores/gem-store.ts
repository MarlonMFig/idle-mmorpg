import {
  GEM_PACKAGES,
} from '@/constants/aiw-gems';
import { getDailyCycleId } from '@/lib/mission-cycle';
import { emitSystemMessage } from '@/lib/system-log';
import { achievementsStore } from '@/stores/achievements-store';
import { createStore } from '@/stores/create-store';

export interface GemState {
  isOpen: boolean;
  balance: number;
  /**
   * @deprecated Item 34 — Daily Login unificado em dailyLoginStore.
   * Mantido só para ler saves antigos; migration zera após consumir.
   */
  lastLoginDay: string | null;
  /**
   * @deprecated Item 38 — Achievements unificados em achievementsStore.
   * Lido só na migration; após aplicar, limpo e não reescrito com dados novos.
   */
  claimedAchievements: Record<string, boolean>;
  totalKills: number;
  weeklyCrystalWeek: string | null;
  weeklyCrystalPurchases: number;
}

const store = createStore<GemState>({
  isOpen: false,
  balance: 0,
  lastLoginDay: null,
  claimedAchievements: {},
  totalKills: 0,
  weeklyCrystalWeek: null,
  weeklyCrystalPurchases: 0,
});

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Normaliza lastLoginDay legado para cycleId YYYY-MM-DD (America/Sao_Paulo).
 * Usado pela migration Item 34 — não concede reward.
 */
export function normalizeLegacyGemLoginDay(raw: string | null | undefined): string | null {
  if (raw == null || raw === '') return null;
  if (YMD_RE.test(raw)) return raw;
  const parsed = Date.parse(raw);
  if (Number.isFinite(parsed)) return getDailyCycleId(parsed);
  return getDailyCycleId();
}

/**
 * Economia de Gemas / Anime Coins premium.
 * Achievements NÃO vivem aqui (Item 38 → achievementsStore).
 */
export const gemStore = {
  subscribe(listener: () => void): () => void {
    return store.subscribe(listener);
  },

  getSnapshot(): GemState {
    return store.getSnapshot();
  },

  hydrate(partial: Partial<GemState>): void {
    const state = store.getSnapshot();
    const rawLogin =
      typeof partial.lastLoginDay === 'string' || partial.lastLoginDay === null
        ? partial.lastLoginDay
        : state.lastLoginDay;
    store.setState({
      ...state,
      balance: typeof partial.balance === 'number' ? partial.balance : state.balance,
      lastLoginDay: normalizeLegacyGemLoginDay(rawLogin),
      claimedAchievements:
        partial.claimedAchievements && typeof partial.claimedAchievements === 'object'
          ? { ...partial.claimedAchievements }
          : state.claimedAchievements,
      totalKills: typeof partial.totalKills === 'number' ? partial.totalKills : state.totalKills,
      weeklyCrystalWeek:
        typeof partial.weeklyCrystalWeek === 'string' || partial.weeklyCrystalWeek === null
          ? partial.weeklyCrystalWeek
          : state.weeklyCrystalWeek,
      weeklyCrystalPurchases:
        typeof partial.weeklyCrystalPurchases === 'number'
          ? partial.weeklyCrystalPurchases
          : state.weeklyCrystalPurchases,
    });
  },

  /** Limpa campo legado Daily Login após migration (não toca balance). */
  clearLegacyDailyLoginField(): void {
    const state = store.getSnapshot();
    if (state.lastLoginDay == null) return;
    store.setState({ ...state, lastLoginDay: null });
  },

  /** Item 38 — zera mapa legado após migration (não concede/remove gems). */
  clearLegacyAchievementClaims(): void {
    const state = store.getSnapshot();
    if (Object.keys(state.claimedAchievements).length === 0) return;
    store.setState({ ...state, claimedAchievements: {} });
  },

  open(): void {
    store.setState({ ...store.getSnapshot(), isOpen: true });
  },

  close(): void {
    store.setState({ ...store.getSnapshot(), isOpen: false });
  },

  toggleOpen(): void {
    const state = store.getSnapshot();
    store.setState({ ...state, isOpen: !state.isOpen });
  },

  addGems(amount: number, reason?: string): void {
    if (amount <= 0) return;
    const state = store.getSnapshot();
    store.setState({ ...state, balance: state.balance + amount });
    if (reason) emitSystemMessage(`+${amount} Gemas — ${reason}`);
  },

  spendGems(amount: number): boolean {
    const state = store.getSnapshot();
    if (amount <= 0 || state.balance < amount) return false;
    store.setState({ ...state, balance: state.balance - amount });
    return true;
  },

  recordKill(): void {
    const state = store.getSnapshot();
    store.setState({ ...state, totalKills: state.totalKills + 1 });
    achievementsStore.evaluate('onlineKills');
  },

  /** Dev: simula pacote (sem PIX). */
  grantDevPackage(packageId: string): boolean {
    const pack = GEM_PACKAGES.find((entry) => entry.id === packageId);
    if (!pack) return false;
    const bonus = Math.floor((pack.gems * pack.bonusPercent) / 100);
    this.addGems(pack.gems + bonus, pack.name);
    return true;
  },
};
