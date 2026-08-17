import {
  ACHIEVEMENT_DEFS,
  DAILY_LOGIN_GEMS,
  GEM_PACKAGES,
} from '@/constants/aiw-gems';
import {
  REFINEMENT_CRYSTAL_GEM_PRICE,
  REFINEMENT_CRYSTAL_ITEM_ID,
  REFINEMENT_CRYSTAL_WEEKLY_LIMIT_F2P,
  REFINEMENT_CRYSTAL_WEEKLY_LIMIT_VIP,
} from '@/constants/aiw-potential';
import { emitSystemMessage } from '@/lib/system-log';
import { createStore } from '@/stores/create-store';
import { inventoryStore } from '@/stores/inventory-store';
import { vipStore } from '@/stores/vip-store';

export interface GemState {
  isOpen: boolean;
  balance: number;
  lastLoginDay: string | null;
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

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function weekKey(): string {
  const d = new Date();
  const oneJan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - oneJan.getTime()) / 86400000 + oneJan.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${week}`;
}

function ensureWeeklyCrystal(): void {
  const state = store.getSnapshot();
  const wk = weekKey();
  if (state.weeklyCrystalWeek === wk) return;
  store.setState({ ...state, weeklyCrystalWeek: wk, weeklyCrystalPurchases: 0 });
}

export const gemStore = {
  subscribe(listener: () => void): () => void {
    return store.subscribe(listener);
  },

  getSnapshot(): GemState {
    return store.getSnapshot();
  },

  hydrate(partial: Partial<GemState>): void {
    const state = store.getSnapshot();
    store.setState({
      ...state,
      balance: typeof partial.balance === 'number' ? partial.balance : state.balance,
      lastLoginDay:
        typeof partial.lastLoginDay === 'string' ? partial.lastLoginDay : state.lastLoginDay,
      claimedAchievements: partial.claimedAchievements ?? state.claimedAchievements,
      totalKills: typeof partial.totalKills === 'number' ? partial.totalKills : state.totalKills,
      weeklyCrystalWeek: partial.weeklyCrystalWeek ?? state.weeklyCrystalWeek,
      weeklyCrystalPurchases:
        typeof partial.weeklyCrystalPurchases === 'number'
          ? partial.weeklyCrystalPurchases
          : state.weeklyCrystalPurchases,
    });
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

  /** Login diário: 5 gemas (F2P e VIP). */
  claimDailyLogin(): boolean {
    const today = todayKey();
    const state = store.getSnapshot();
    if (state.lastLoginDay === today) return false;
    store.setState({
      ...state,
      lastLoginDay: today,
      balance: state.balance + DAILY_LOGIN_GEMS,
    });
    emitSystemMessage(`Login diário: +${DAILY_LOGIN_GEMS} Gemas.`);
    return true;
  },

  recordKill(): void {
    const state = store.getSnapshot();
    store.setState({ ...state, totalKills: state.totalKills + 1 });
    achievementStore.checkKillMilestones(state.totalKills + 1);
  },

  weeklyCrystalLimit(): number {
    ensureWeeklyCrystal();
    return vipStore.isActive()
      ? REFINEMENT_CRYSTAL_WEEKLY_LIMIT_VIP
      : REFINEMENT_CRYSTAL_WEEKLY_LIMIT_F2P;
  },

  weeklyCrystalRemaining(): number {
    ensureWeeklyCrystal();
    const state = store.getSnapshot();
    return Math.max(0, this.weeklyCrystalLimit() - state.weeklyCrystalPurchases);
  },

  buyWeeklyRefinementCrystal(): boolean {
    ensureWeeklyCrystal();
    const state = store.getSnapshot();
    if (state.weeklyCrystalPurchases >= this.weeklyCrystalLimit()) {
      emitSystemMessage('Limite semanal de Cristais de Refinamento atingido.');
      return false;
    }
    if (!this.spendGems(REFINEMENT_CRYSTAL_GEM_PRICE)) {
      emitSystemMessage('Gemas insuficientes.');
      return false;
    }
    if (!inventoryStore.addItem(REFINEMENT_CRYSTAL_ITEM_ID, 1)) {
      this.addGems(REFINEMENT_CRYSTAL_GEM_PRICE);
      emitSystemMessage('Inventário cheio.');
      return false;
    }
    store.setState({
      ...store.getSnapshot(),
      weeklyCrystalPurchases: state.weeklyCrystalPurchases + 1,
    });
    emitSystemMessage('Cristal de Refinamento comprado na loja semanal.');
    achievementStore.unlock('ach-first-refine');
    return true;
  },

  /** Dev: simula pacote (sem PIX). */
  grantDevPackage(packageId: string): boolean {
    const pack = GEM_PACKAGES.find((entry) => entry.id === packageId);
    if (!pack) return false;
    const bonus = Math.floor((pack.gems * pack.bonusPercent) / 100);
    this.addGems(pack.gems + bonus, pack.name);
    return true;
  },

  listAchievements(): typeof ACHIEVEMENT_DEFS {
    return ACHIEVEMENT_DEFS;
  },
};

/** Conquistas — recompensa em gemas, uma vez. */
export const achievementStore = {
  unlock(id: string): void {
    const def = ACHIEVEMENT_DEFS.find((entry) => entry.id === id);
    if (!def) return;
    const state = gemStore.getSnapshot();
    if (state.claimedAchievements[id]) return;
    gemStore.hydrate({
      claimedAchievements: { ...state.claimedAchievements, [id]: true },
      balance: state.balance + def.gems,
    });
    emitSystemMessage(`Conquista: ${def.title} (+${def.gems} Gemas)`);
  },

  checkKillMilestones(kills: number): void {
    if (kills >= 100) this.unlock('ach-kills-100');
    if (kills >= 1000) this.unlock('ach-kills-1000');
    if (kills >= 10000) this.unlock('ach-kills-10000');
  },

  checkAccountLevel(level: number): void {
    if (level >= 10) this.unlock('ach-level-10');
    if (level >= 25) this.unlock('ach-level-25');
    if (level >= 50) this.unlock('ach-level-50');
    if (level >= 100) this.unlock('ach-level-100');
  },

  checkPotentialGrade(grade: string): void {
    if (grade === 'S') this.unlock('ach-potential-s');
    if (grade === 'SS') this.unlock('ach-potential-ss');
    if (grade === 'SSS') this.unlock('ach-potential-sss');
  },
};
