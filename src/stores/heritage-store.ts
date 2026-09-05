import {
  getHeritageOption,
  getHeritageOptionById,
  getHeritageOptionMaxLevel,
  HERITAGE_GATES,
  HERITAGE_SLOTS,
  HERITAGE_RANK_UNLOCK_LABELS,
  SENNIN_ACTIVE_MS,
  SENNIN_CHARGE_MS,
  SENNIN_COOLDOWN_MS,
  clampHeritageOptionLevelFor,
  migrateHeritageClanOptionId,
  type HeritageSlotId,
} from '@/constants/heritage-system';
import { createStore } from '@/stores/create-store';
import { accountStore } from '@/stores/account-store';
import { emitSystemMessage } from '@/lib/system-log';
import { clampOpenGateLevel } from '@/lib/heritage-stats';
import {
  DEFAULT_HERITAGE_LOADOUT,
  DEFAULT_SENNIN_RUNTIME,
  type HeritageLoadout,
  type HeritageOptionLevels,
  type HeritageState,
  type SenninPhase,
  type SenninRuntimeState,
} from '@/types/heritage';

function cloneLoadout(loadout: HeritageLoadout): HeritageLoadout {
  return {
    ...loadout,
    optionLevels: { ...loadout.optionLevels },
  };
}

function normalizeOptionLevels(raw: unknown): HeritageOptionLevels {
  const out: HeritageOptionLevels = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    const migrated = migrateHeritageClanOptionId(id) ?? id;
    const option = getHeritageOptionById(migrated);
    if (!option) continue;
    const level = clampHeritageOptionLevelFor(option, value);
    out[migrated] = Math.max(out[migrated] ?? 1, level);
  }
  return out;
}

function ensureOptionLevel(levels: HeritageOptionLevels, optionId: string): HeritageOptionLevels {
  if (levels[optionId] != null) return levels;
  return { ...levels, [optionId]: 1 };
}

function normalizeLoadout(raw: Partial<HeritageLoadout> | null | undefined): HeritageLoadout {
  const base = { ...DEFAULT_HERITAGE_LOADOUT, ...(raw ?? {}) };
  const legacy = raw as Partial<HeritageLoadout> & { kekkeiId?: string | null };
  const openGateLevel = clampOpenGateLevel(base.openGateLevel);
  const unlockedRaw =
    typeof base.unlockedGateLevel === 'number' && Number.isFinite(base.unlockedGateLevel)
      ? base.unlockedGateLevel
      : openGateLevel;
  const unlockedGateLevel = Math.max(openGateLevel, clampOpenGateLevel(unlockedRaw));
  const pick = (slot: HeritageSlotId, id: string | null): string | null => {
    if (!id) return null;
    const migrated = slot === 'cla' ? migrateHeritageClanOptionId(id) : id;
    return HERITAGE_SLOTS[slot].options.some((row) => row.id === migrated) ? migrated : null;
  };
  const rawClaId = base.claId ?? legacy.kekkeiId ?? null;
  let optionLevels = normalizeOptionLevels(base.optionLevels);
  const equippedIds = [
    pick('cla', rawClaId),
    pick('summon', base.summonId),
    pick('sennin', base.senninId),
    pick('cursedSeal', base.cursedSealId),
  ];
  for (const id of equippedIds) {
    if (id) optionLevels = ensureOptionLevel(optionLevels, id);
  }
  return {
    openGateLevel,
    unlockedGateLevel,
    claId: pick('cla', rawClaId),
    summonId: pick('summon', base.summonId),
    senninId: pick('sennin', base.senninId),
    cursedSealId: pick('cursedSeal', base.cursedSealId),
    optionLevels,
  };
}

function playerRank(): number {
  return accountStore.getActiveRank();
}

function slotKey(slot: HeritageSlotId): keyof HeritageLoadout {
  if (slot === 'cla') return 'claId';
  if (slot === 'summon') return 'summonId';
  if (slot === 'sennin') return 'senninId';
  return 'cursedSealId';
}

const store = createStore<HeritageState>({
  loadout: cloneLoadout(DEFAULT_HERITAGE_LOADOUT),
  sennin: { ...DEFAULT_SENNIN_RUNTIME },
});

function setLoadout(loadout: HeritageLoadout): void {
  store.setState({
    ...store.getSnapshot(),
    loadout: cloneLoadout(loadout),
  });
}

function setSennin(sennin: SenninRuntimeState): void {
  store.setState({
    ...store.getSnapshot(),
    sennin: { ...sennin },
  });
}

function phaseRemainingMs(sennin: SenninRuntimeState, now: number): number {
  const elapsed = Math.max(0, now - (sennin.phaseStartedAt || now));
  if (sennin.phase === 'charging') return Math.max(0, SENNIN_CHARGE_MS - elapsed);
  if (sennin.phase === 'active') return Math.max(0, SENNIN_ACTIVE_MS - elapsed);
  if (sennin.phase === 'cooldown') return Math.max(0, SENNIN_COOLDOWN_MS - elapsed);
  return 0;
}

function notifyHeritageAttributes(): void {
  void import('@/stores/attributes-store').then((m) => m.attributesStore.onActiveCharacterChanged(false));
}

/**
 * Estado e ações do sistema Herança (hub).
 */
export const heritageStore = {
  subscribe: store.subscribe,
  getSnapshot: store.getSnapshot,

  reset(): void {
    store.setState({
      loadout: cloneLoadout(DEFAULT_HERITAGE_LOADOUT),
      sennin: { ...DEFAULT_SENNIN_RUNTIME },
    });
  },

  hydrate(partial?: { loadout?: Partial<HeritageLoadout> | null } | null): void {
    store.setState({
      loadout: normalizeLoadout(partial?.loadout),
      sennin: { ...DEFAULT_SENNIN_RUNTIME },
    });
  },

  getLoadout(): HeritageLoadout {
    return cloneLoadout(store.getSnapshot().loadout);
  },

  getOptionLevel(optionId: string): number {
    const option = getHeritageOptionById(optionId);
    if (!option) return 1;
    return clampHeritageOptionLevelFor(
      option,
      store.getSnapshot().loadout.optionLevels[optionId] ?? 1,
    );
  },

  /**
   * Define o portão ativo (0 = fechado).
   * Pode ativar qualquer nível já desbloqueado, ou o próximo a desbloquear.
   */
  setOpenGateLevel(level: number): boolean {
    const next = clampOpenGateLevel(level);
    const current = store.getSnapshot().loadout;
    if (next > 0 && next > current.unlockedGateLevel + 1) {
      emitSystemMessage('Desbloqueie os portões em ordem.');
      return false;
    }
    if (next > 0 && next > current.unlockedGateLevel && next !== current.unlockedGateLevel + 1) {
      emitSystemMessage('Desbloqueie os portões em ordem.');
      return false;
    }
    const unlockedGateLevel = Math.max(current.unlockedGateLevel, next);
    if (current.openGateLevel === next && current.unlockedGateLevel === unlockedGateLevel) {
      return true;
    }
    setLoadout({ ...current, openGateLevel: next, unlockedGateLevel });
    notifyHeritageAttributes();
    return true;
  },

  /**
   * Ativa o portão N, ou fecha se já estiver ativo.
   * Desbloqueio sequencial: só libera N se N−1 já foi desbloqueado.
   */
  toggleGate(level: number): boolean {
    const gate = HERITAGE_GATES.find((row) => row.level === level);
    if (!gate) return false;
    const current = store.getSnapshot().loadout;
    if (level === current.openGateLevel) {
      return heritageStore.setOpenGateLevel(0);
    }
    if (level <= current.unlockedGateLevel || level === current.unlockedGateLevel + 1) {
      return heritageStore.setOpenGateLevel(level);
    }
    emitSystemMessage('Desbloqueie os portões em ordem.');
    return false;
  },

  equipSlot(slot: HeritageSlotId, optionId: string | null): boolean {
    const meta = HERITAGE_SLOTS[slot];
    const rank = playerRank();
    if (rank < meta.requiredRank) {
      emitSystemMessage(
        `${meta.name} libera no rank ${HERITAGE_RANK_UNLOCK_LABELS[meta.requiredRank]}.`,
      );
      return false;
    }
    if (optionId) {
      const option = getHeritageOption(slot, optionId);
      if (!option || !('levels' in option)) {
        emitSystemMessage('Opção de Herança inválida.');
        return false;
      }
      if (rank < option.requiredRank) {
        emitSystemMessage(
          `${option.name} exige rank ${HERITAGE_RANK_UNLOCK_LABELS[option.requiredRank as 1 | 2 | 3 | 4]}.`,
        );
        return false;
      }
    }
    const current = store.getSnapshot().loadout;
    const key = slotKey(slot);
    if (slot === 'cla' && optionId && current.claId && current.claId !== optionId) {
      emitSystemMessage('Você já escolheu um clã. Remova a seleção para trocar.');
      return false;
    }
    if (current[key] === optionId) return true;
    let optionLevels = { ...current.optionLevels };
    if (optionId) optionLevels = ensureOptionLevel(optionLevels, optionId);
    setLoadout({ ...current, [key]: optionId, optionLevels });
    if (slot === 'sennin') {
      setSennin({ ...DEFAULT_SENNIN_RUNTIME });
    }
    notifyHeritageAttributes();
    return true;
  },

  clearSlot(slot: HeritageSlotId): boolean {
    return heritageStore.equipSlot(slot, null);
  },

  /**
   * Define o nível ativo de uma opção (1–max da opção).
   * Para Clã: só funciona na opção equipada.
   */
  setOptionLevel(optionId: string, level: number): boolean {
    const option = getHeritageOptionById(optionId);
    if (!option) {
      emitSystemMessage('Opção de Herança inválida.');
      return false;
    }
    const slot = (Object.keys(HERITAGE_SLOTS) as HeritageSlotId[]).find((id) =>
      HERITAGE_SLOTS[id].options.some((row) => row.id === optionId),
    );
    if (!slot) return false;
    if (playerRank() < HERITAGE_SLOTS[slot].requiredRank) {
      emitSystemMessage(
        `${HERITAGE_SLOTS[slot].name} libera no rank ${HERITAGE_RANK_UNLOCK_LABELS[HERITAGE_SLOTS[slot].requiredRank]}.`,
      );
      return false;
    }
    if (slot === 'cla') {
      const equipped = store.getSnapshot().loadout.claId;
      if (equipped !== optionId) {
        emitSystemMessage('Equipe o clã antes de escolher o nível da técnica.');
        return false;
      }
    }
    const nextLevel = clampHeritageOptionLevelFor(option, level);
    const current = store.getSnapshot().loadout;
    if (clampHeritageOptionLevelFor(option, current.optionLevels[optionId] ?? 1) === nextLevel) {
      return true;
    }
    setLoadout({
      ...current,
      optionLevels: { ...current.optionLevels, [optionId]: nextLevel },
    });
    notifyHeritageAttributes();
    return true;
  },

  /**
   * Evolui o nível de uma opção até o máximo dela. Progresso persiste mesmo se unequipada.
   * Custo de evolução ainda não definido — avanço livre por enquanto.
   */
  upgradeOption(optionId: string): boolean {
    const option = getHeritageOptionById(optionId);
    if (!option) {
      emitSystemMessage('Opção de Herança inválida.');
      return false;
    }
    const current = store.getSnapshot().loadout;
    const maxLevel = getHeritageOptionMaxLevel(option);
    const level = clampHeritageOptionLevelFor(option, current.optionLevels[optionId] ?? 1);
    if (level >= maxLevel) {
      emitSystemMessage(`${option.name} já está no nível máximo.`);
      return false;
    }
    const ok = heritageStore.setOptionLevel(optionId, level + 1);
    if (ok) {
      emitSystemMessage(`${option.name} evoluiu para Nv${level + 1}.`);
    }
    return ok;
  },

  isSenninActive(now = Date.now()): boolean {
    heritageStore.tickSennin(now, false);
    return store.getSnapshot().sennin.phase === 'active';
  },

  getSenninStatus(now = Date.now()): {
    phase: SenninPhase;
    remainingMs: number;
    equipped: boolean;
  } {
    heritageStore.tickSennin(now, false);
    const snap = store.getSnapshot();
    return {
      phase: snap.sennin.phase,
      remainingMs: phaseRemainingMs(snap.sennin, now),
      equipped: Boolean(snap.loadout.senninId),
    };
  },

  /** Inicia carga se equipado e em idle. */
  startSenninCharge(now = Date.now()): boolean {
    const snap = store.getSnapshot();
    if (!snap.loadout.senninId) {
      emitSystemMessage('Equipe um Modo Sennin primeiro.');
      return false;
    }
    if (playerRank() < HERITAGE_SLOTS.sennin.requiredRank) {
      emitSystemMessage('Modo Sennin libera no rank Jounin.');
      return false;
    }
    if (snap.sennin.phase !== 'idle') return false;
    setSennin({ phase: 'charging', phaseStartedAt: now, chargeInterrupted: false });
    return true;
  },

  /** Atualiza ciclo Sennin. `isAttacking` interrompe a carga. */
  tickSennin(now = Date.now(), isAttacking = false): SenninRuntimeState {
    const snap = store.getSnapshot();
    let sennin = { ...snap.sennin };
    if (!snap.loadout.senninId) {
      if (sennin.phase !== 'idle') {
        sennin = { ...DEFAULT_SENNIN_RUNTIME };
        setSennin(sennin);
        notifyHeritageAttributes();
      }
      return sennin;
    }

    if (sennin.phase === 'charging' && isAttacking) {
      sennin = { phase: 'idle', phaseStartedAt: 0, chargeInterrupted: true };
      setSennin(sennin);
      return sennin;
    }

    const elapsed = Math.max(0, now - (sennin.phaseStartedAt || now));
    if (sennin.phase === 'charging' && elapsed >= SENNIN_CHARGE_MS) {
      sennin = { phase: 'active', phaseStartedAt: now, chargeInterrupted: false };
      setSennin(sennin);
      notifyHeritageAttributes();
      return sennin;
    }
    if (sennin.phase === 'active' && elapsed >= SENNIN_ACTIVE_MS) {
      sennin = { phase: 'cooldown', phaseStartedAt: now, chargeInterrupted: false };
      setSennin(sennin);
      notifyHeritageAttributes();
      return sennin;
    }
    if (sennin.phase === 'cooldown' && elapsed >= SENNIN_COOLDOWN_MS) {
      sennin = { phase: 'idle', phaseStartedAt: 0, chargeInterrupted: false };
      setSennin(sennin);
      return sennin;
    }
    return sennin;
  },

  /** Snapshot persistível. */
  toPersisted(): { loadout: HeritageLoadout } {
    return { loadout: heritageStore.getLoadout() };
  },
};
