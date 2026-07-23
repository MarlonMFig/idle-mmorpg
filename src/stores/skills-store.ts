import { SKILL_HOTBAR_SIZE } from '@/constants/skill';
import { getHotbarSkillIdsForStarter, getSkill, STARTER_KNOWN_SKILL_IDS } from '@/data/skills';
import { createStore } from '@/stores/create-store';
import type { StarterCharacterId } from '@/types/player-creation';
import type { HotbarSlot, SkillsState } from '@/types/skill';

function emptyHotbar(): HotbarSlot[] {
  return Array.from({ length: SKILL_HOTBAR_SIZE }, () => null);
}

function buildHotbarForStarter(starterId: StarterCharacterId): HotbarSlot[] {
  const hotbar = emptyHotbar();
  getHotbarSkillIdsForStarter(starterId).forEach((id, index) => {
    if (index < SKILL_HOTBAR_SIZE && getSkill(id)) {
      hotbar[index] = id;
    }
  });
  return hotbar;
}

const store = createStore<SkillsState>({
  knownIds: [...STARTER_KNOWN_SKILL_IDS],
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
      knownIds: [...STARTER_KNOWN_SKILL_IDS],
      hotbar: buildHotbarForStarter(starterId),
      cooldownReadyAt: {},
      pendingCastId: null,
    });
  },

  learnSkill(skillId: string): boolean {
    const state = store.getSnapshot();
    if (!getSkill(skillId) || state.knownIds.includes(skillId)) return false;
    store.setState({ ...state, knownIds: [...state.knownIds, skillId] });
    return true;
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
    const readyAt = store.getSnapshot().cooldownReadyAt[skillId] ?? 0;
    return now >= readyAt;
  },

  getCooldownRemainingMs(skillId: string, now = Date.now()): number {
    const readyAt = store.getSnapshot().cooldownReadyAt[skillId] ?? 0;
    return Math.max(0, readyAt - now);
  },

  startCooldown(skillId: string, cooldownMs: number, now = Date.now()): void {
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
