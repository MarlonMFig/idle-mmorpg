import { CLAN_SYSTEM_UNLOCK_LEVEL, CHARACTER_CLAN_LABELS } from '@/constants/character-progression';
import { createStore } from '@/stores/create-store';
import type { CharacterClanId } from '@/types/character-meta';
import { CHARACTER_CLAN_IDS } from '@/types/character-meta';
import { vitalsStore } from '@/stores/vitals-store';
import { emitSystemMessage } from '@/lib/system-log';

export interface AccountMetaState {
  /** Clã escolhido pelo jogador; null = ainda não escolheu. */
  clanId: CharacterClanId | null;
  /** Menu Clãs aberto. */
  isOpen: boolean;
}

const store = createStore<AccountMetaState>({
  clanId: null,
  isOpen: false,
});

function isClanId(value: unknown): value is CharacterClanId {
  return typeof value === 'string' && (CHARACTER_CLAN_IDS as readonly string[]).includes(value);
}

/**
 * Metadados de conta (clã do jogador, etc.).
 * Persistido em session-persist.
 */
export const accountStore = {
  subscribe: store.subscribe,
  getSnapshot: store.getSnapshot,

  reset(): void {
    store.setState({ clanId: null, isOpen: false });
  },

  hydrate(partial: { clanId?: CharacterClanId | null }): void {
    store.setState({
      clanId: isClanId(partial.clanId) ? partial.clanId : null,
      isOpen: false,
    });
  },

  getClanId(): CharacterClanId | null {
    return store.getSnapshot().clanId;
  },

  isClanSystemUnlocked(level = vitalsStore.getLevel()): boolean {
    return level >= CLAN_SYSTEM_UNLOCK_LEVEL;
  },

  toggleOpen(): void {
    const state = store.getSnapshot();
    store.setState({ ...state, isOpen: !state.isOpen });
  },

  setOpen(isOpen: boolean): void {
    store.setState({ ...store.getSnapshot(), isOpen });
  },

  /**
   * Escolha única. Troca / custo / espera — não implementados.
   */
  chooseClan(clanId: CharacterClanId): boolean {
    const state = store.getSnapshot();
    if (state.clanId != null) {
      emitSystemMessage('Clã já escolhido. Troca ainda não está disponível.');
      return false;
    }
    if (!isClanId(clanId)) return false;
    if (!this.isClanSystemUnlocked()) {
      emitSystemMessage(`Clãs liberam no nível ${CLAN_SYSTEM_UNLOCK_LEVEL}.`);
      return false;
    }
    store.setState({ ...state, clanId });
    emitSystemMessage(`Você representa o Clã ${CHARACTER_CLAN_LABELS[clanId]}.`);
    return true;
  },
};
