import { SKILL_HOTBAR_SIZE } from '@/constants/skill';
import { isSkillCooldownIgnored } from '@/config/devConfig';
import { characterLabStore, isCharacterLabSession } from '@/stores/character-lab-store';
import { listSkillUnlocksFor } from '@/data/skill-unlocks';
import { getCharacterPack } from '@/data/character-packs';
import { getHotbarSkillIdsForStarter, getSkill, STARTER_KNOWN_SKILL_IDS } from '@/data/skills';
import { createStore } from '@/stores/create-store';
import type { StarterCharacterId } from '@/types/player-creation';
import type { HotbarSlot, SkillsState } from '@/types/skill';
import type { VillageId } from '@/types/village';

function emptyHotbar(): HotbarSlot[] {
  return Array.from({ length: SKILL_HOTBAR_SIZE }, () => null);
}

function labIgnoresCooldown(): boolean {
  if (!isCharacterLabSession()) return false;
  const lab = characterLabStore.getSnapshot();
  return lab.ignoreCooldown || lab.infiniteChakra;
}

function buildHotbarForStarter(starterId: StarterCharacterId): HotbarSlot[] {
  return buildHotbarFromIds(getCharacterPack(starterId).hotbarSkillIds);
}

function knownIdsForStarter(starterId: StarterCharacterId): string[] {
  const fromHotbar = getHotbarSkillIdsForStarter(starterId).filter((id) => getSkill(id));
  return [...new Set([...STARTER_KNOWN_SKILL_IDS, ...fromHotbar])];
}

function buildHotbarFromIds(skillIds: readonly (string | null)[]): HotbarSlot[] {
  const hotbar = emptyHotbar();
  skillIds.forEach((id, index) => {
    if (index < SKILL_HOTBAR_SIZE && id && getSkill(id)) {
      hotbar[index] = id;
    }
  });
  return hotbar;
}

const store = createStore<SkillsState>({
  knownIds: knownIdsForStarter('naruto-classic'),
  hotbar: buildHotbarForStarter('naruto-classic'),
  cooldownReadyAt: {},
  pendingCastId: null,
});

/**
 * Skills / jutsus — hotbar, cooldowns e pedidos de cast (React → Phaser).
 */
export const skillsStore = {
  subscribe: store.subscribe,
  getSnapshot: store.getSnapshot,

  reset(starterId: StarterCharacterId = 'naruto-classic'): void {
    store.setState({
      knownIds: knownIdsForStarter(starterId),
      hotbar: buildHotbarForStarter(starterId),
      cooldownReadyAt: {},
      pendingCastId: null,
    });
  },

  /**
   * Troca a hotbar do personagem ativo sem limpar skills conhecidas
   * (progressão do jogador) nem reiniciar a sessão.
   */
  applyCharacterHotbar(skillIds: readonly (string | null)[]): void {
    const state = store.getSnapshot();
    const nextKnown = new Set(state.knownIds);
    for (const id of skillIds) {
      if (id && getSkill(id)) nextKnown.add(id);
    }
    store.setState({
      ...state,
      knownIds: [...nextKnown],
      hotbar: buildHotbarFromIds(skillIds),
      pendingCastId: null,
    });
  },

  learnSkill(skillId: string): boolean {
    const state = store.getSnapshot();
    if (!getSkill(skillId) || state.knownIds.includes(skillId)) return false;
    store.setState({ ...state, knownIds: [...state.knownIds, skillId] });
    return true;
  },

  /**
   * Aprende os jutsus liberados pelo nível e equipa os novos nos slots livres.
   * É idempotente: chamar novamente no mesmo nível não duplica habilidades.
   *
   * @returns ids aprendidos nesta chamada.
   */
  syncLevelUnlocks(villageId: VillageId, level: number): string[] {
    const learned: string[] = [];

    for (const unlock of listSkillUnlocksFor(villageId, level)) {
      if (!this.learnSkill(unlock.skillId)) continue;
      learned.push(unlock.skillId);

      const freeSlot = store.getSnapshot().hotbar.findIndex((slot) => slot == null);
      if (freeSlot >= 0) this.setHotbarSlot(freeSlot, unlock.skillId);
    }

    return learned;
  },

  setHotbarSlot(index: number, skillId: string | null): boolean {
    const state = store.getSnapshot();
    if (index < 0 || index >= SKILL_HOTBAR_SIZE) return false;
    if (skillId != null && (!getSkill(skillId) || !state.knownIds.includes(skillId))) {
      return false;
    }
    const hotbar = [...state.hotbar];
    hotbar[index] = skillId;
    store.setState({ ...state, hotbar });
    return true;
  },

  /** Solicita cast (tecla/hotbar). O SkillSystem consome no update. */
  requestCast(skillId: string): boolean {
    const state = store.getSnapshot();
    if (!getSkill(skillId) || !state.knownIds.includes(skillId)) return false;
    if (!this.isReady(skillId)) return false;
    store.setState({ ...state, pendingCastId: skillId });
    return true;
  },

  requestCastFromHotbar(index: number): boolean {
    const skillId = store.getSnapshot().hotbar[index];
    if (!skillId) return false;
    return this.requestCast(skillId);
  },

  consumePendingCast(): string | null {
    const state = store.getSnapshot();
    const id = state.pendingCastId;
    if (!id) return null;
    store.setState({ ...state, pendingCastId: null });
    return id;
  },

  isReady(skillId: string, now = Date.now()): boolean {
    if (isSkillCooldownIgnored() || labIgnoresCooldown()) return true;
    const readyAt = store.getSnapshot().cooldownReadyAt[skillId] ?? 0;
    return now >= readyAt;
  },

  getCooldownRemainingMs(skillId: string, now = Date.now()): number {
    const readyAt = store.getSnapshot().cooldownReadyAt[skillId] ?? 0;
    return Math.max(0, readyAt - now);
  },

  /** DEV / Lab: zera cooldowns de Skills. Não usar no Médico (Item 42). */
  clearCooldowns(): void {
    store.setState((state) => ({ ...state, cooldownReadyAt: {} }));
  },

  startCooldown(skillId: string, cooldownMs: number, now = Date.now()): void {
    if (isSkillCooldownIgnored() || labIgnoresCooldown()) return;
    const state = store.getSnapshot();
    store.setState({
      ...state,
      cooldownReadyAt: {
        ...state.cooldownReadyAt,
        [skillId]: now + cooldownMs,
      },
    });
  },
};
