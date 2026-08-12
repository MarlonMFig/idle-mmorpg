import { clampStars } from '@/constants/character-progression';
import { STARTERS } from '@/data/starters';
import {
  CHOUJI_CURATED_LOOK_TYPE,
  getCharacterPack,
  GUY_CURATED_LOOK_TYPE,
  HINATA_CURATED_LOOK_TYPE,
  INO_CURATED_LOOK_TYPE,
  JIRAIYA_LOOK_TYPES,
  JIROBO_LOOK_TYPES,
  KAKASHI_CURATED_LOOK_TYPE,
  NARUTO_CLASSIC_LOOK_TYPE,
  NARUTO_SENNIN_LOOK_TYPE,
  NEJI_CURATED_LOOK_TYPE,
  ROCK_LEE_LOOK_TYPE,
  SASUKE_CLASSIC_LOOK_TYPE,
  UCHIHA_ITACHI_LOOK_TYPE,
  KABUTO_CURATED_LOOK_TYPE,
  TSUNADE_CURATED_LOOK_TYPE,
  KIBA_CURATED_LOOK_TYPE,
  KIMIMARO_CURATED_LOOK_TYPE,
  SASUKE_CURSED_CURATED_LOOK_TYPE,
  OROCHIMARU_CURATED_LOOK_TYPE,
  NARUTO_KYUBI_CURATED_LOOK_TYPE,
  KISAME_CURATED_LOOK_TYPE,
  DEIDARA_CURATED_LOOK_TYPE,
  SAKURA_SHIPPUDEN_CURATED_LOOK_TYPE,
  TENTEN_CURATED_LOOK_TYPE,
  TEMARI_CURATED_LOOK_TYPE,
  TAYUYA_CURATED_LOOK_TYPE,
  SHINO_CURATED_LOOK_TYPE,
  MOMO_HINAMORI_CURATED_LOOK_TYPE,
  HITSUGAYA_CURATED_LOOK_TYPE,
  SHISUI_CURATED_LOOK_TYPE,
  SHISUI_LOOK_TYPES,
  NARUTO_SHIPPUDEN_CURATED_LOOK_TYPE,
  NARUTO_SHIPPUDEN_LOOK_TYPES,
  GOKU_CURATED_LOOK_TYPE,
  GOKU_LOOK_TYPES,
  FREEZA_CURATED_LOOK_TYPE,
  FREEZA_LOOK_TYPES,
  GOTENKS_CURATED_LOOK_TYPE,
  GOTENKS_LOOK_TYPES,
  MAJIN_BOO_CURATED_LOOK_TYPE,
  MAJIN_BOO_LOOK_TYPES,
  PICCOLO_CURATED_LOOK_TYPE,
  PICCOLO_LOOK_TYPES,
} from '@/data/character-packs';
import { emitSystemMessage } from '@/lib/system-log';
import { planForgeStar } from '@/systems/forge';
import { createStore } from '@/stores/create-store';
import { TEAM_SLOT_COUNT } from '@/constants/sealing';
import type { StarterCharacterId } from '@/types/player-creation';
import type { SealedCharacter, TeamState } from '@/types/team';
import {
  buildSealedCharacter,
  normalizeSealedCharacter,
} from '@/utils/character-identity';

function starterMember(starterId: StarterCharacterId): SealedCharacter {
  const starter = STARTERS.find((entry) => entry.id === starterId);
  const pack = getCharacterPack(starterId);
  const lookType =
    starterId === 'naruto-classic'
      ? NARUTO_CLASSIC_LOOK_TYPE
      : starterId === 'sasuke-classic'
        ? SASUKE_CLASSIC_LOOK_TYPE
        : starterId === 'rock-lee'
          ? ROCK_LEE_LOOK_TYPE
          : (pack.outfit?.lookType ?? 0);
  const built = buildSealedCharacter({
    // Primeira instância do starter: id estável legível (migrate de saves antigos).
    id: starterId,
    name: starter?.name ?? starterId,
    lookType,
    sourceId: null,
    starterId,
    previewUrl: starter?.previewUrl ?? `/sprites/player/previews/${starterId}.png`,
  });
  return {
    ...built,
    previewUrl: built.previewUrl ?? previewForLookType(lookType),
  };
}

function previewForLookType(lookType: number): string {
  if (lookType === NARUTO_CLASSIC_LOOK_TYPE) return '/sprites/player/previews/naruto.png';
  if (lookType === SASUKE_CLASSIC_LOOK_TYPE) return '/sprites/player/previews/sasuke.png';
  if (lookType === ROCK_LEE_LOOK_TYPE) return '/sprites/player/previews/rock-lee.png';
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
  if (lookType === GUY_CURATED_LOOK_TYPE) {
    return '/sprites/player/previews/guy.png';
  }
  if (lookType === INO_CURATED_LOOK_TYPE || lookType === 1169) {
    return '/sprites/player/previews/ino.png';
  }
  if (lookType === KAKASHI_CURATED_LOOK_TYPE) {
    return '/sprites/player/previews/kakashi.png';
  }
  if (lookType === NARUTO_SENNIN_LOOK_TYPE) {
    return '/sprites/player/previews/naruto-sennin.png';
  }
  if (lookType === UCHIHA_ITACHI_LOOK_TYPE) {
    return '/sprites/player/previews/itachi.png';
  }
  if (
    lookType === SHISUI_CURATED_LOOK_TYPE ||
    (SHISUI_LOOK_TYPES as readonly number[]).includes(lookType)
  ) {
    return '/sprites/player/previews/shisui.png';
  }
  if (
    lookType === NARUTO_SHIPPUDEN_CURATED_LOOK_TYPE ||
    (NARUTO_SHIPPUDEN_LOOK_TYPES as readonly number[]).includes(lookType)
  ) {
    return '/sprites/player/previews/naruto-shippuden.png';
  }
  if (
    lookType === GOKU_CURATED_LOOK_TYPE ||
    (GOKU_LOOK_TYPES as readonly number[]).includes(lookType)
  ) {
    return '/sprites/player/previews/goku.png';
  }
  if (
    lookType === FREEZA_CURATED_LOOK_TYPE ||
    (FREEZA_LOOK_TYPES as readonly number[]).includes(lookType)
  ) {
    return '/sprites/player/previews/freeza.png';
  }
  if (
    lookType === GOTENKS_CURATED_LOOK_TYPE ||
    (GOTENKS_LOOK_TYPES as readonly number[]).includes(lookType)
  ) {
    return '/sprites/player/previews/gotenks.png';
  }
  if (
    lookType === MAJIN_BOO_CURATED_LOOK_TYPE ||
    (MAJIN_BOO_LOOK_TYPES as readonly number[]).includes(lookType)
  ) {
    return '/sprites/player/previews/majin-boo.png';
  }
  if (
    lookType === PICCOLO_CURATED_LOOK_TYPE ||
    (PICCOLO_LOOK_TYPES as readonly number[]).includes(lookType)
  ) {
    return '/sprites/player/previews/piccolo.png';
  }
  if ((JIRAIYA_LOOK_TYPES as readonly number[]).includes(lookType)) {
    return '/sprites/player/previews/jiraiya.png';
  }
  if ((JIROBO_LOOK_TYPES as readonly number[]).includes(lookType)) {
    return '/sprites/player/previews/jirobo.png';
  }
  if (lookType === KABUTO_CURATED_LOOK_TYPE) {
    return '/sprites/player/previews/kabuto.png';
  }
  if (lookType === TSUNADE_CURATED_LOOK_TYPE) {
    return '/sprites/player/previews/tsunade.png';
  }
  if (lookType === KIBA_CURATED_LOOK_TYPE) {
    return '/sprites/player/previews/kiba.png';
  }
  if (lookType === KIMIMARO_CURATED_LOOK_TYPE) {
    return '/sprites/player/previews/kimimaro.png';
  }
  if (lookType === SASUKE_CURSED_CURATED_LOOK_TYPE) {
    return '/sprites/player/previews/sasuke-cursed.png';
  }
  if (lookType === OROCHIMARU_CURATED_LOOK_TYPE) {
    return '/sprites/player/previews/orochimaru.png';
  }
  if (lookType === NARUTO_KYUBI_CURATED_LOOK_TYPE) {
    return '/sprites/player/previews/naruto-kyubi.png';
  }
  if (lookType === KISAME_CURATED_LOOK_TYPE) {
    return '/sprites/player/previews/kisame.png';
  }
  if (lookType === DEIDARA_CURATED_LOOK_TYPE) {
    return '/sprites/player/previews/deidara.png';
  }
  if (lookType === SAKURA_SHIPPUDEN_CURATED_LOOK_TYPE) {
    return '/sprites/player/previews/sakura-shippuden.png';
  }
  if (lookType === TENTEN_CURATED_LOOK_TYPE) {
    return '/sprites/player/previews/tenten.png';
  }
  if (lookType === TEMARI_CURATED_LOOK_TYPE) {
    return '/sprites/player/previews/temari.png';
  }
  if (lookType === TAYUYA_CURATED_LOOK_TYPE) {
    return '/sprites/player/previews/tayuya.png';
  }
  if (lookType === SHINO_CURATED_LOOK_TYPE) {
    return '/sprites/player/previews/shino.png';
  }
  if (lookType === MOMO_HINAMORI_CURATED_LOOK_TYPE) {
    return '/sprites/player/previews/momo-hinamori.png';
  }
  if (lookType === HITSUGAYA_CURATED_LOOK_TYPE) {
    return '/sprites/player/previews/hitsugaya.png';
  }
  return `/sprites/wonsr/outfits/${lookType}.png`;
}

/** Prefer preview curado (`/previews/`) sobre URL legada quebrada (outfit WONSR 90xx). */
function resolvePreviewUrl(lookType: number, stored?: string | null): string {
  const fromLook = previewForLookType(lookType);
  if (fromLook.includes('/sprites/player/previews/')) return fromLook;
  if (stored && stored.includes('/sprites/player/previews/')) return stored;
  if (stored && stored.length > 0 && !stored.includes('/sprites/wonsr/outfits/')) return stored;
  return fromLook;
}

const store = createStore<TeamState>({
  collection: [],
  teamIds: [],
  activeId: null,
  inventoryTab: 'items',
  isOpen: false,
});

function commit(next: TeamState): void {
  store.setState(next);
}

/**
 * Coleção de personagens selados + equipe de até 3.
 * Duplicatas permitidas (forja). Snapshots via session-persist.
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
      isOpen: false,
    });
  },

  hydrate(partial: {
    collection: SealedCharacter[];
    teamIds: string[];
    activeId: string | null;
  }): boolean {
    const collection = partial.collection
      .map((entry) => normalizeSealedCharacter(entry))
      .filter((entry): entry is SealedCharacter => entry != null)
      .map((entry) => ({
        ...entry,
        previewUrl: resolvePreviewUrl(entry.lookType, entry.previewUrl),
      }));
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
      teamIds = [activeId, ...teamIds.filter((id) => id !== activeId)].slice(
        0,
        TEAM_SLOT_COUNT,
      );
    }

    commit({
      collection,
      teamIds,
      activeId,
      inventoryTab: 'items',
      isOpen: false,
    });
    return true;
  },

  setInventoryTab(tab: TeamState['inventoryTab']): void {
    commit({ ...store.getSnapshot(), inventoryTab: tab });
  },

  toggleOpen(): void {
    const state = store.getSnapshot();
    commit({ ...state, isOpen: !state.isOpen });
  },

  setOpen(isOpen: boolean): void {
    commit({ ...store.getSnapshot(), isOpen });
  },

  /** Reaplica previews curados (corrige saves com lookType 90xx → outfit WONSR inexistente). */
  refreshPreviews(): void {
    const state = store.getSnapshot();
    let changed = false;
    const collection = state.collection.map((entry) => {
      const next = resolvePreviewUrl(entry.lookType, entry.previewUrl);
      if (next === entry.previewUrl) return entry;
      changed = true;
      return { ...entry, previewUrl: next };
    });
    if (changed) commit({ ...state, collection });
  },

  getActive(): SealedCharacter | null {
    const state = store.getSnapshot();
    if (!state.activeId) return null;
    return state.collection.find((entry) => entry.id === state.activeId) ?? null;
  },

  /** Contagem de instâncias com o mesmo characterKey. */
  countByCharacterKey(characterKey: string): number {
    return store
      .getSnapshot()
      .collection.filter((entry) => entry.characterKey === characterKey).length;
  },

  hasInstance(instanceId: string): boolean {
    return store.getSnapshot().collection.some((entry) => entry.id === instanceId);
  },

  /**
   * Adiciona instância à coleção. Duplicatas do mesmo lookType/characterKey ok.
   * Rejeita só se o `id` de instância já existir.
   */
  addToCollection(
    member: Partial<SealedCharacter> &
      Pick<SealedCharacter, 'id' | 'name' | 'lookType'> & {
        sourceId?: string | null;
        starterId?: StarterCharacterId | null;
        previewUrl?: string;
      },
  ): boolean {
    const state = store.getSnapshot();
    if (state.collection.some((entry) => entry.id === member.id)) return false;

    const built = buildSealedCharacter({
      id: member.id,
      name: member.name,
      lookType: member.lookType,
      sourceId: member.sourceId ?? null,
      starterId: member.starterId ?? null,
      previewUrl: member.previewUrl,
      characterKey: member.characterKey,
      quality: member.quality,
      stars: member.stars,
      clanId: member.clanId,
      isFavorite: member.isFavorite,
      isLocked: member.isLocked,
    });

    const sealed: SealedCharacter = {
      ...built,
      previewUrl: resolvePreviewUrl(member.lookType, built.previewUrl ?? member.previewUrl),
    };
    commit({
      ...state,
      collection: [...state.collection, sealed],
    });
    return true;
  },

  setFavorite(instanceId: string, isFavorite: boolean): boolean {
    const state = store.getSnapshot();
    let found = false;
    const collection = state.collection.map((entry) => {
      if (entry.id !== instanceId) return entry;
      found = true;
      return { ...entry, isFavorite };
    });
    if (!found) return false;
    commit({ ...state, collection });
    return true;
  },

  setLocked(instanceId: string, isLocked: boolean): boolean {
    const state = store.getSnapshot();
    let found = false;
    const collection = state.collection.map((entry) => {
      if (entry.id !== instanceId) return entry;
      found = true;
      return { ...entry, isLocked };
    });
    if (!found) return false;
    commit({ ...state, collection });
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

  /**
   * Forja +1 estrela no alvo consumindo materiais confirmados.
   * UI deve listar `plan.materialIds` antes de chamar.
   */
  forgeStar(targetId: string, confirmedMaterialIds: readonly string[]): boolean {
    const state = store.getSnapshot();
    const plan = planForgeStar({
      targetId,
      collection: state.collection,
      teamIds: state.teamIds,
      preferredMaterialIds: confirmedMaterialIds,
    });

    if (plan.reason === 'target-missing') {
      emitSystemMessage('Alvo da forja não encontrado.');
      return false;
    }
    if (plan.reason === 'quality-not-configured') {
      emitSystemMessage('Forja para este rank ainda não está disponível.');
      return false;
    }
    if (plan.reason === 'max-stars') {
      emitSystemMessage('Este personagem já está no máximo de estrelas.');
      return false;
    }
    if (plan.reason !== 'ok' || !plan.target) {
      emitSystemMessage(
        `Materiais insuficientes (precisa de ${plan.cost} cópias iguais elegíveis).`,
      );
      return false;
    }

    // Confirmar que o conjunto bate exatamente com o planejado.
    if (
      confirmedMaterialIds.length !== plan.materialIds.length ||
      !plan.materialIds.every((id) => confirmedMaterialIds.includes(id))
    ) {
      emitSystemMessage('Lista de materiais inválida. Confirme novamente.');
      return false;
    }

    const removeSet = new Set(plan.materialIds);
    if (removeSet.has(targetId)) {
      emitSystemMessage('O alvo não pode ser consumido como material.');
      return false;
    }

    const collection = state.collection
      .filter((entry) => !removeSet.has(entry.id))
      .map((entry) => {
        if (entry.id !== targetId) return entry;
        return { ...entry, stars: clampStars(entry.stars + 1) };
      });

    if (collection.length !== state.collection.length - plan.cost) {
      emitSystemMessage('Falha ao consumir materiais.');
      return false;
    }

    // Materiais não deveriam estar na equipe (elegibilidade), mas limpa por segurança.
    const teamIds = state.teamIds.filter((id) => !removeSet.has(id));
    commit({ ...state, collection, teamIds });

    const next = collection.find((entry) => entry.id === targetId);
    emitSystemMessage(
      `Forja concluída: ${next?.name ?? 'personagem'} agora com ${next?.stars ?? '?'}★.`,
    );
    return true;
  },
};

// re-export preview helper for tests/tools if needed
export { previewForLookType };
