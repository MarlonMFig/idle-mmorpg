import { TEAM_SLOT_COUNT } from '@/constants/sealing';
import { STARTERS } from '@/data/starters';
import {
  CHOUJI_CURATED_LOOK_TYPE,
  getCharacterPack,
  HINATA_CURATED_LOOK_TYPE,
  NARUTO_SENNIN_LOOK_TYPE,
  NEJI_CURATED_LOOK_TYPE,
  UCHIHA_ITACHI_LOOK_TYPE,
} from '@/data/character-packs';
import { emitSystemMessage } from '@/lib/system-log';
import { createStore } from '@/stores/create-store';
import type { StarterCharacterId } from '@/types/player-creation';
import type { SealedCharacter, TeamState } from '@/types/team';

function starterMember(starterId: StarterCharacterId): SealedCharacter {
  const starter = STARTERS.find((entry) => entry.id === starterId);
  const pack = getCharacterPack(starterId);
  return {
    id: starterId,
    name: starter?.name ?? starterId,
    lookType: pack.outfit?.lookType ?? 0,
    sourceId: null,
    starterId,
    previewUrl: starter?.previewUrl ?? `/sprites/wonsr/outfits/${pack.outfit?.lookType ?? 0}.png`,
  };
}

function previewForLookType(lookType: number): string {
  // Packs laterais curados (substituem outfit 4-dir no avatar).
  if (lookType === 1426) return '/sprites/player/previews/shikamaru.png';
  if (
    lookType === 489 ||
    lookType === 490 ||
    lookType === 494 ||
    lookType === NEJI_CURATED_LOOK_TYPE
  ) {
    return '/sprites/player/previews/neji.png';
  }
  if (lookType === 1395 || lookType === 41 || lookType === 42 || lookType === 710) {
    return '/sprites/player/previews/gaara.png';
  }
  if (lookType === 1423 || lookType === 350 || lookType === 352) {
    return '/sprites/player/previews/sakura.png';
  }
  if (lookType === CHOUJI_CURATED_LOOK_TYPE) {
    return '/sprites/player/previews/chouji.png';
  }
  if (lookType === HINATA_CURATED_LOOK_TYPE) {
    return '/sprites/player/previews/hinata.png';
  }
  if (lookType === NARUTO_SENNIN_LOOK_TYPE) {
    return '/sprites/player/previews/naruto-sennin.png';
  }
  if (lookType === UCHIHA_ITACHI_LOOK_TYPE) {
    return '/sprites/player/previews/itachi.png';
  }
  return `/sprites/wonsr/outfits/${lookType}.png`;
}

const store = createStore<TeamState>({
  collection: [],
  teamIds: [],
  activeId: null,
  inventoryTab: 'items',
});

function commit(next: TeamState): void {
  store.setState(next);
}

function ownsLookType(collection: SealedCharacter[], lookType: number): boolean {
  return collection.some((entry) => entry.lookType === lookType);
}

/**
 * Coleção de personagens selados + equipe de até 3.
 * Snapshots em `idle-mmorpg:session-v1` via session-persist.
 */
export const teamStore = {
  subscribe: store.subscribe,
  getSnapshot: store.getSnapshot,

  reset(starterId: StarterCharacterId = 'naruto-classic'): void {
    const member = starterMember(starterId);
    commit({
      collection: [member],
      teamIds: [member.id],
      activeId: member.id,
      inventoryTab: 'items',
    });
  },

  /**
   * Restaura coleção/equipe. Retorna false se dados inválidos
   * (coleção vazia ou active/team fora da coleção).
   */
  hydrate(partial: {
    collection: SealedCharacter[];
    teamIds: string[];
    activeId: string | null;
  }): boolean {
    const collection = partial.collection.filter(
      (entry) => entry && typeof entry.id === 'string' && typeof entry.lookType === 'number',
    );
    if (collection.length === 0) return false;

    const ids = new Set(collection.map((entry) => entry.id));
    let teamIds = partial.teamIds.filter((id) => ids.has(id));
    if (teamIds.length === 0) {
      teamIds = [collection[0].id];
    }
    teamIds = teamIds.slice(0, TEAM_SLOT_COUNT);

    let activeId = partial.activeId && ids.has(partial.activeId) ? partial.activeId : null;
    if (!activeId || !teamIds.includes(activeId)) {
      activeId = teamIds[0] ?? collection[0].id;
    }
    if (!teamIds.includes(activeId)) {
      teamIds = [activeId, ...teamIds.filter((id) => id !== activeId)].slice(0, TEAM_SLOT_COUNT);
    }

    commit({
      collection,
      teamIds,
      activeId,
      inventoryTab: 'items',
    });
    return true;
  },

  setInventoryTab(tab: TeamState['inventoryTab']): void {
    commit({ ...store.getSnapshot(), inventoryTab: tab });
  },

  getActive(): SealedCharacter | null {
    const state = store.getSnapshot();
    if (!state.activeId) return null;
    return state.collection.find((entry) => entry.id === state.activeId) ?? null;
  },

  hasCharacter(characterId: string): boolean {
    return store.getSnapshot().collection.some((entry) => entry.id === characterId);
  },

  hasLookType(lookType: number): boolean {
    return ownsLookType(store.getSnapshot().collection, lookType);
  },

  /**
   * Registra captura. Não duplica por id nem por lookType.
   * @returns false se já possuído.
   */
  addToCollection(member: Omit<SealedCharacter, 'previewUrl'> & { previewUrl?: string }): boolean {
    const state = store.getSnapshot();
    if (state.collection.some((entry) => entry.id === member.id)) return false;
    if (ownsLookType(state.collection, member.lookType)) return false;

    const sealed: SealedCharacter = {
      ...member,
      previewUrl: member.previewUrl ?? previewForLookType(member.lookType),
    };
    commit({
      ...state,
      collection: [...state.collection, sealed],
    });
    return true;
  },

  addToTeam(characterId: string): boolean {
    const state = store.getSnapshot();
    if (!state.collection.some((entry) => entry.id === characterId)) {
      emitSystemMessage('Personagem não encontrado na coleção.');
      return false;
    }
    if (state.teamIds.includes(characterId)) {
      emitSystemMessage('Esse personagem já está na equipe.');
      return false;
    }
    if (state.teamIds.length >= TEAM_SLOT_COUNT) {
      emitSystemMessage('Equipe cheia (máximo 3). Remova alguém antes.');
      return false;
    }
    commit({ ...state, teamIds: [...state.teamIds, characterId] });
    emitSystemMessage('Personagem adicionado à equipe.');
    return true;
  },

  removeFromTeam(characterId: string): boolean {
    const state = store.getSnapshot();
    if (!state.teamIds.includes(characterId)) return false;
    if (state.activeId === characterId) {
      emitSystemMessage('Não dá para remover o personagem ativo. Torne outro principal primeiro.');
      return false;
    }
    if (state.teamIds.length <= 1) {
      emitSystemMessage('A equipe precisa de ao menos um membro.');
      return false;
    }
    commit({
      ...state,
      teamIds: state.teamIds.filter((id) => id !== characterId),
    });
    emitSystemMessage('Personagem removido da equipe.');
    return true;
  },

  /**
   * Define o lutador ativo. Só membros da equipe.
   * @returns true se trocou (chamador deve reiniciar a cena).
   */
  setActive(characterId: string): boolean {
    const state = store.getSnapshot();
    if (!state.teamIds.includes(characterId)) {
      emitSystemMessage('Só membros da equipe podem ser o principal.');
      return false;
    }
    if (state.activeId === characterId) return false;
    commit({ ...state, activeId: characterId });
    const member = state.collection.find((entry) => entry.id === characterId);
    emitSystemMessage(`Agora lutando com ${member?.name ?? 'personagem'}.`);
    return true;
  },
};
