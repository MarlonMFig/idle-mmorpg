import { SEALING_SCROLL_PRICE, SHOP_CURRENCY_ITEM_ID } from '@/constants/sealing';
import { isTestAnalyzerSession } from '@/config/devConfig';
import { getItemSellValue } from '@/data/shop';
import { createStore } from '@/stores/create-store';

export interface HuntDropEntry {
  itemId: string;
  quantity: number;
  /** Valor NPC unitário (1 para cobre). */
  unitValue: number;
  /** unitValue × quantity. */
  totalValue: number;
}

export interface HuntAnalyzerState {
  isOpen: boolean;
  /** Caça associada à sessão atual (zerada ao trocar). */
  huntId: string | null;
  /** Timestamp do início da sessão de contagem. */
  sessionStartedAt: number | null;
  /** True quando DEV MODE está ativo — não usar em ranking oficial. */
  isTestSession: boolean;
  kills: number;
  sealed: number;
  captureAttempts: number;
  xpGained: number;
  masteryXpGained: number;
  lootCopper: number;
  lootItems: number;
  /** Custo estimado em cobre dos pergaminhos consumidos. */
  supplyCopper: number;
  scrollsUsed: number;
  /** itemId → quantidade nesta sessão. */
  drops: Record<string, number>;
  sealLogs: string[];
  qualityKills: Record<string, number>;
  qualityCaptures: Record<string, number>;
  qualityFails: Record<string, number>;
}

const MAX_SEAL_LOGS = 48;

/** Preço de reposição estimado por tier de pergaminho (loja). */
const SCROLL_COST: Record<string, number> = {
  'item-sealing-scroll': SEALING_SCROLL_PRICE,
  'item-sealing-scroll-rare': SEALING_SCROLL_PRICE * 3,
};

const emptySession = (): Omit<HuntAnalyzerState, 'isOpen'> => ({
  huntId: null,
  sessionStartedAt: null,
  isTestSession: isTestAnalyzerSession(),
  kills: 0,
  sealed: 0,
  captureAttempts: 0,
  xpGained: 0,
  masteryXpGained: 0,
  lootCopper: 0,
  lootItems: 0,
  supplyCopper: 0,
  scrollsUsed: 0,
  drops: {},
  sealLogs: [],
  qualityKills: {},
  qualityCaptures: {},
  qualityFails: {},
});

const store = createStore<HuntAnalyzerState>({
  isOpen: false,
  ...emptySession(),
});

function ensureSession(now = Date.now()): void {
  const state = store.getSnapshot();
  if (state.sessionStartedAt == null) {
    store.setState({ ...state, sessionStartedAt: now });
  }
}

function elapsedMs(state: HuntAnalyzerState, now = Date.now()): number {
  if (state.sessionStartedAt == null) return 0;
  return Math.max(0, now - state.sessionStartedAt);
}

function perHour(value: number, ms: number): number {
  if (ms <= 0 || value === 0) return 0;
  return Math.round((value / ms) * 3_600_000);
}

/** Valor unitário em cobre (NPC). Cobre = 1. */
export function huntItemNpcValue(itemId: string): number {
  if (itemId === SHOP_CURRENCY_ITEM_ID) return 1;
  return getItemSellValue(itemId);
}

/** Valor total dos drops da sessão (cobre + materiais na tabela de venda). */
export function sumLootNpcValue(drops: Record<string, number>): number {
  let total = 0;
  for (const [itemId, quantity] of Object.entries(drops)) {
    if (quantity <= 0) continue;
    total += huntItemNpcValue(itemId) * quantity;
  }
  return total;
}

/**
 * Estatísticas da sessão de caça (estilo Hunt Analyzer).
 * Zera ao trocar de caça (`onHuntChanged`) ou via `resetSession`.
 */
export const huntAnalyzerStore = {
  subscribe: store.subscribe,
  getSnapshot: store.getSnapshot,

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

  setOpen(isOpen: boolean): void {
    store.setState({ ...store.getSnapshot(), isOpen });
  },

  resetSession(): void {
    const { isOpen, huntId } = store.getSnapshot();
    store.setState({ isOpen, ...emptySession(), huntId });
  },

  /**
   * Troca de caça / entra em combate: zera contadores se o id mudou.
   * Mantém o painel aberto.
   */
  onHuntChanged(huntId: string | null): void {
    const state = store.getSnapshot();
    // Mesma caça (incl. ambos null): mantém a sessão.
    if (state.huntId === huntId) return;
    store.setState({
      isOpen: state.isOpen,
      ...emptySession(),
      huntId,
    });
  },

  recordKill(params: { xp: number; copper: number; masteryXp?: number; quality?: string }): void {
    ensureSession();
    const state = store.getSnapshot();
    const copper = Math.max(0, params.copper);
    const masteryXp = Math.max(0, params.masteryXp ?? 0);
    const drops = { ...state.drops };
    if (copper > 0) {
      drops[SHOP_CURRENCY_ITEM_ID] = (drops[SHOP_CURRENCY_ITEM_ID] ?? 0) + copper;
    }
    const qualityKills = params.quality
      ? { ...state.qualityKills, [params.quality]: (state.qualityKills[params.quality] ?? 0) + 1 }
      : state.qualityKills;
    store.setState({
      ...state,
      kills: state.kills + 1,
      xpGained: state.xpGained + Math.max(0, params.xp),
      masteryXpGained: state.masteryXpGained + masteryXp,
      lootCopper: state.lootCopper + copper,
      drops,
      qualityKills,
    });
  },

  /** Materiais / itens de drop (exceto moedas já contadas em recordKill). */
  recordLootItems(itemId: string, quantity: number): void {
    if (quantity <= 0 || !itemId) return;
    if (itemId === SHOP_CURRENCY_ITEM_ID) return;
    ensureSession();
    const state = store.getSnapshot();
    const drops = {
      ...state.drops,
      [itemId]: (state.drops[itemId] ?? 0) + quantity,
    };
    store.setState({
      ...state,
      lootItems: state.lootItems + quantity,
      drops,
    });
  },

  recordSealAttempt(params: { scrollId: string; quality?: string; success?: boolean }): void {
    ensureSession();
    const cost = SCROLL_COST[params.scrollId] ?? SEALING_SCROLL_PRICE;
    const state = store.getSnapshot();
    const qualityFails =
      params.quality && params.success === false
        ? { ...state.qualityFails, [params.quality]: (state.qualityFails[params.quality] ?? 0) + 1 }
        : state.qualityFails;
    store.setState({
      ...state,
      captureAttempts: state.captureAttempts + 1,
      scrollsUsed: state.scrollsUsed + 1,
      supplyCopper: state.supplyCopper + cost,
      qualityFails,
    });
  },

  recordSealSuccess(name: string, quality?: string): void {
    ensureSession();
    const state = store.getSnapshot();
    const line = quality ? `${name} selado (${quality})` : `${name} selado`;
    const qualityCaptures = quality
      ? { ...state.qualityCaptures, [quality]: (state.qualityCaptures[quality] ?? 0) + 1 }
      : state.qualityCaptures;
    store.setState({
      ...state,
      sealed: state.sealed + 1,
      sealLogs: [...state.sealLogs, line].slice(-MAX_SEAL_LOGS),
      qualityCaptures,
    });
  },

  /** Drops da sessão com valor NPC (ordenados por valor total, depois qty). */
  listDrops(): HuntDropEntry[] {
    const { drops } = store.getSnapshot();
    return Object.entries(drops)
      .map(([itemId, quantity]) => {
        const unitValue = huntItemNpcValue(itemId);
        return {
          itemId,
          quantity,
          unitValue,
          totalValue: unitValue * quantity,
        };
      })
      .filter((entry) => entry.quantity > 0)
      .sort(
        (a, b) =>
          b.totalValue - a.totalValue ||
          b.quantity - a.quantity ||
          a.itemId.localeCompare(b.itemId),
      );
  },

  /** Métricas derivadas para a UI (tick a cada segundo). */
  getRates(now = Date.now()) {
    const state = store.getSnapshot();
    const ms = elapsedMs(state, now);
    const lootValue = sumLootNpcValue(state.drops);
    const materialValue = Math.max(0, lootValue - state.lootCopper);
    const balance = lootValue - state.supplyCopper;
    return {
      elapsedMs: ms,
      lootValue,
      materialValue,
      copperPerHour: perHour(state.lootCopper, ms),
      lootPerHour: perHour(lootValue, ms),
      balancePerHour: perHour(balance, ms),
      xpPerHour: perHour(state.xpGained, ms),
      masteryXpPerHour: perHour(state.masteryXpGained, ms),
      killsPerHour: perHour(state.kills, ms),
      balance,
      supplyCopper: state.supplyCopper,
    };
  },
};

export function formatHuntDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function formatCopper(value: number): string {
  return value.toLocaleString('pt-BR');
}
