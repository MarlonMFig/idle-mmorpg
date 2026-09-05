import { formatMaxStarsReachedMessage, getMaxStarsForRarity } from '@/config/gameConfig';
import { clampStars } from '@/constants/character-progression';
import { getCharacterPack, NARUTO_CLASSIC_LOOK_TYPE, ROCK_LEE_LOOK_TYPE, SASUKE_CLASSIC_LOOK_TYPE } from '@/data/character-packs';
import { narutoSignatureItemIds, narutoFragmentItemId } from '@/data/naruto-loot-tiers';
import { inventoryStore } from '@/stores/inventory-store';
import { addExperience } from '@/lib/player-progression';
import { d, parseDecimal, type Decimal } from '@/lib/decimal';
import { clampMasteryLevel, clampMasteryXp } from '@/constants/character-mastery';
import { clampAwakeningLevel } from '@/constants/character-awakening';
import { isMaxMastery } from '@/lib/character-mastery';
import { STARTERS } from '@/data/starters';
import { getCharacterPreviewUrl } from '@/data/curated-map-sprites';
import { emitSystemMessage } from '@/lib/system-log';
import { createStore } from '@/stores/create-store';
import { TEAM_SLOT_COUNT } from '@/constants/sealing';
import type { StarterCharacterId } from '@/types/player-creation';
import type { SealedCharacter, TeamState } from '@/types/team';
import { canUpgradeCharacterStar } from '@/lib/character-star-upgrade';
import {
  buildSealedCharacter,
  createCharacterInstanceId,
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
  return getCharacterPreviewUrl(lookType);
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

    const seenIds = new Set<string>();
    const reminted = collection.map((entry) => {
      if (!seenIds.has(entry.id)) {
        seenIds.add(entry.id);
        return entry;
      }
      const nextId = createCharacterInstanceId();
      seenIds.add(nextId);
      return { ...entry, id: nextId };
    });

    const ids = new Set(reminted.map((entry) => entry.id));
    let teamIds = partial.teamIds.filter((id) => ids.has(id));
    if (teamIds.length === 0) {
      teamIds = [reminted[0].id];
    }
    teamIds = teamIds.slice(0, TEAM_SLOT_COUNT);

    let activeId = partial.activeId && ids.has(partial.activeId) ? partial.activeId : null;
    if (!activeId || !teamIds.includes(activeId)) {
      activeId = teamIds[0] ?? reminted[0].id;
    }
    if (!teamIds.includes(activeId)) {
      teamIds = [activeId, ...teamIds.filter((id) => id !== activeId)].slice(0, TEAM_SLOT_COUNT);
    }

    commit({
      collection: reminted,
      teamIds,
      activeId,
      isOpen: false,
    });
    return true;
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

  /** Grava nível/XP do personagem (selamento, XP de caça, troca de ativo). */
  setCharacterProgress(instanceId: string, progress: { level: number; xp: number | Decimal }): boolean {
    const state = store.getSnapshot();
    const level = Math.max(1, Math.floor(progress.level));
    const xp = parseDecimal(progress.xp);
    let found = false;
    const collection = state.collection.map((entry) => {
      if (entry.id !== instanceId) return entry;
      found = true;
      if (entry.level === level && entry.xp.eq(xp)) return entry;
      return { ...entry, level, xp };
    });
    if (!found) return false;
    commit({ ...state, collection });
    return true;
  },

  setCharacterMastery(instanceId: string, progress: { masteryLevel: number; masteryXp: number }): boolean {
    const state = store.getSnapshot();
    const masteryLevel = clampMasteryLevel(progress.masteryLevel);
    const masteryXp = isMaxMastery(masteryLevel) ? 0 : clampMasteryXp(progress.masteryXp);
    let found = false;
    const collection = state.collection.map((entry) => {
      if (entry.id !== instanceId) return entry;
      found = true;
      if (entry.masteryLevel === masteryLevel && entry.masteryXp === masteryXp) {
        return entry;
      }
      return { ...entry, masteryLevel, masteryXp };
    });
    if (!found) return false;
    commit({ ...state, collection });
    return true;
  },

  setCharacterAwakening(instanceId: string, awakeningLevel: number): boolean {
    const state = store.getSnapshot();
    const nextLevel = clampAwakeningLevel(awakeningLevel);
    let found = false;
    const collection = state.collection.map((entry) => {
      if (entry.id !== instanceId) return entry;
      found = true;
      if (entry.awakeningLevel === nextLevel) return entry;
      return { ...entry, awakeningLevel: nextLevel };
    });
    if (!found) return false;
    commit({ ...state, collection });
    return true;
  },

  /**
   * Saves antigos sem nível por personagem.
   * Starter recupera o progresso da conta (era o único nível).
   * Cópias seladas entram no Nv.1 — não herdam caça nem conta.
   */
  migrateMissingLevels(accountLevel: number, accountXp: number | Decimal): void {
    const state = store.getSnapshot();
    const accountLv = Math.max(1, Math.floor(accountLevel));
    const accountXpClamped = parseDecimal(accountXp);
    let changed = false;
    const collection = state.collection.map((entry) => {
      if (entry.level >= 1) return entry;
      changed = true;
      if (entry.starterId) {
        return { ...entry, level: accountLv, xp: accountXpClamped };
      }
      return { ...entry, level: 1, xp: d(0) };
    });
    if (!changed) return;
    commit({ ...state, collection });
  },

  /** XP próprio do personagem (independente da conta). @returns se subiu de nível. */
  addCharacterXp(instanceId: string, amount: number | Decimal): boolean {
    const gain = parseDecimal(amount);
    if (gain.lte(0)) return false;
    const state = store.getSnapshot();
    let leveled = false;
    const collection = state.collection.map((entry) => {
      if (entry.id !== instanceId) return entry;
      const next = addExperience(Math.max(1, entry.level), entry.xp, gain);
      if (next.leveled) leveled = true;
      return { ...entry, level: next.level, xp: next.xp };
    });
    commit({ ...state, collection });
    return leveled;
  },

  /** Contagem de instâncias com o mesmo characterKey. */
  countByCharacterKey(characterKey: string): number {
    return store.getSnapshot().collection.filter((entry) => entry.characterKey === characterKey)
      .length;
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
      characterId: member.characterId,
      obtainedAt: member.obtainedAt,
      quality: member.quality,
      potential: member.potential,
      potentialTotal: member.potentialTotal,
      grade: member.grade,
      qualityStatMultiplier: member.qualityStatMultiplier,
      stars: member.stars,
      lineageId: member.lineageId,
      clanId: member.lineageId,
      level: member.level,
      xp: member.xp,
      masteryLevel: member.masteryLevel,
      masteryXp: member.masteryXp,
      awakeningLevel: member.awakeningLevel,
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

  addCharacterInstance(
    member: Partial<SealedCharacter> &
      Pick<SealedCharacter, 'id' | 'name' | 'lookType'> & {
        sourceId?: string | null;
        starterId?: StarterCharacterId | null;
        previewUrl?: string;
      },
  ): boolean {
    return this.addToCollection(member);
  },

  getCharacterInstance(instanceId: string): SealedCharacter | null {
    return store.getSnapshot().collection.find((entry) => entry.id === instanceId) ?? null;
  },

  countCopies(characterId: string): number {
    return store
      .getSnapshot()
      .collection.filter((entry) => entry.characterId === characterId).length;
  },

  countCopiesByCharacterAndQuality(characterId: string, quality: SealedCharacter['quality']): number {
    return store
      .getSnapshot()
      .collection.filter((entry) => entry.characterId === characterId && entry.quality === quality).length;
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

  addToTeam(instanceId: string): boolean {
    const state = store.getSnapshot();
    if (!state.collection.some((entry) => entry.id === instanceId)) {
      emitSystemMessage('Personagem não encontrado na coleção.');
      return false;
    }
    if (state.teamIds.includes(instanceId)) {
      emitSystemMessage('Esse personagem já está na equipe.');
      return false;
    }
    if (state.teamIds.length >= TEAM_SLOT_COUNT) {
      emitSystemMessage('Equipe cheia (máximo 3). Remova alguém antes.');
      return false;
    }
    commit({ ...state, teamIds: [...state.teamIds, instanceId] });
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

  setActive(instanceId: string): boolean {
    const state = store.getSnapshot();
    if (!state.teamIds.includes(instanceId)) {
      emitSystemMessage('Só membros da equipe podem ser o principal.');
      return false;
    }
    if (state.activeId === instanceId) return false;
    commit({ ...state, activeId: instanceId });
    const member = state.collection.find((entry) => entry.id === instanceId);
    emitSystemMessage(`Agora lutando com ${member?.name ?? 'personagem'}.`);
    return true;
  },

  /**
   * Troca atômica da formação (Item 43 — presets).
   * Um único commit: evita estados intermediários de gameplay.
   */
  applyFormation(teamIds: readonly string[], activeId: string): boolean {
    const state = store.getSnapshot();
    const collectionIds = new Set(state.collection.map((entry) => entry.id));
    const unique: string[] = [];
    const seen = new Set<string>();
    for (const id of teamIds) {
      if (typeof id !== 'string' || !id) continue;
      if (!collectionIds.has(id)) continue;
      if (seen.has(id)) continue;
      seen.add(id);
      unique.push(id);
      if (unique.length >= TEAM_SLOT_COUNT) break;
    }
    if (unique.length === 0) return false;
    const nextActive = unique.includes(activeId) ? activeId : unique[0]!;
    commit({
      ...state,
      teamIds: unique,
      activeId: nextActive,
    });
    return true;
  },

  /**
   * Forja +1 estrela — delega ao fluxo oficial de evolução por estrelas.
   */
  forgeStar(targetInstanceId: string): boolean {
    return teamStore.upgradeStar(targetInstanceId);
  },

  upgradeStar(targetId: string): boolean {
    const state = store.getSnapshot();
    const target = state.collection.find((entry) => entry.id === targetId);
    if (!target) {
      emitSystemMessage('Personagem não encontrado.');
      return false;
    }
    if (target.stars >= getMaxStarsForRarity(target.quality)) {
      emitSystemMessage(formatMaxStarsReachedMessage(target.quality));
      return false;
    }
    const check = canUpgradeCharacterStar(target, state.collection);
    if (!check.cost) {
      emitSystemMessage(formatMaxStarsReachedMessage(target.quality));
      return false;
    }
    if (!check.canUpgrade) {
      const label: Record<'copies' | 'fragments' | 'signature', string> = {
        copies: 'cópias',
        fragments: 'fragmentos',
        signature: 'assinatura',
      };
      emitSystemMessage(`Faltam recursos: ${check.missing.map((key) => label[key]).join(', ')}.`);
      return false;
    }

    const materialIds = state.collection
      .filter(
        (entry) =>
          entry.id !== target.id &&
          entry.characterId === target.characterId &&
          entry.quality === target.quality,
      )
      .slice(0, check.cost.copies)
      .map((entry) => entry.id);
    if (materialIds.length < check.cost.copies) {
      emitSystemMessage('Cópias insuficientes para a evolução.');
      return false;
    }

    const fragmentItemId = narutoFragmentItemId(target.characterId);
    const signatureItemIds = narutoSignatureItemIds(target.characterId);
    const signatureCounts = signatureItemIds.map((itemId) => ({
      itemId,
      quantity: inventoryStore.countItem(itemId),
    }));

    if (inventoryStore.countItem(fragmentItemId) < check.cost.fragments) return false;
    if (signatureCounts.reduce((sum, row) => sum + row.quantity, 0) < check.cost.signature) return false;

    if (!inventoryStore.removeItem(fragmentItemId, check.cost.fragments)) return false;

    let signatureRemaining = check.cost.signature;
    const removedSignature: Array<{ itemId: string; quantity: number }> = [];
    for (const row of signatureCounts) {
      if (signatureRemaining <= 0) break;
      const take = Math.min(signatureRemaining, row.quantity);
      if (take <= 0) continue;
      if (!inventoryStore.removeItem(row.itemId, take)) {
        inventoryStore.addItem(fragmentItemId, check.cost.fragments);
        for (const undo of removedSignature) inventoryStore.addItem(undo.itemId, undo.quantity);
        return false;
      }
      removedSignature.push({ itemId: row.itemId, quantity: take });
      signatureRemaining -= take;
    }
    if (signatureRemaining > 0) {
      inventoryStore.addItem(fragmentItemId, check.cost.fragments);
      for (const undo of removedSignature) inventoryStore.addItem(undo.itemId, undo.quantity);
      return false;
    }

    const removeSet = new Set(materialIds);
    const collection = state.collection.map((entry) =>
      entry.id === targetId
        ? { ...entry, stars: clampStars(entry.stars + 1, entry.quality) }
        : entry,
    ).filter((entry) => !removeSet.has(entry.id));
    const teamIds = state.teamIds.filter((id) => !removeSet.has(id));
    commit({ ...state, collection, teamIds });
    const next = collection.find((entry) => entry.id === targetId);
    emitSystemMessage(`${next?.name ?? 'Personagem'} evoluiu para ${next?.stars}★.`);
    void import('@/lib/achievement-listeners').then((m) => m.notifyAchievementStarsChanged());
    void import('@/stores/missions-store').then((m) => m.missionsStore.syncStateMissions());
    return true;
  },
};

// re-export preview helper for tests/tools if needed
export { previewForLookType };
