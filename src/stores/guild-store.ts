import { GUILD_CREATE_MIN_LEVEL, GUILD_CREATE_COST } from '@/constants/guild';
import { emitSystemMessage } from '@/lib/system-log';
import { getGuildProvider, getGuildProviderId } from '@/lib/guild-provider';
import { resolveSocialProviderMode } from '@/config/social-backend';
import { getAuthPlayerId } from '@/lib/auth/player-identity';
import {
  isValidGuildName,
  isValidGuildTag,
  normalizeGuildName,
  normalizeGuildTag,
} from '@/lib/guild-xp';
import { createStore } from '@/stores/create-store';
import { vitalsStore } from '@/stores/vitals-store';
import type { Guild, GuildJoinMode, GuildMemberRole, GuildUiTabId } from '@/types/guild';

export { isValidGuildName, isValidGuildTag, normalizeGuildName, normalizeGuildTag };

/** Progresso pessoal legado (session-persist). Item 28 não usa Guild Coin. */
export interface GuildPlayerProgress {
  guildCoins: number;
  lastCheckInDay: string | null;
  claimedMissions: Record<string, boolean>;
  missionProgress: Record<string, number>;
  bossDamage: number;
  bossAttacks: number;
  fragmentShopDay: string | null;
  fragmentShopPurchases: number;
}

export interface GuildState {
  isOpen: boolean;
  playerId: string | null;
  guildId: string | null;
  nickname: string | null;
  registryTick: number;
  progress: GuildPlayerProgress;
  uiTab: GuildUiTabId;
  lobbyMode: 'home' | 'create' | 'search';
  error: string | null;
  providerId: string;
}

const emptyProgress = (): GuildPlayerProgress => ({
  guildCoins: 0,
  lastCheckInDay: null,
  claimedMissions: {},
  missionProgress: {},
  bossDamage: 0,
  bossAttacks: 0,
  fragmentShopDay: null,
  fragmentShopPurchases: 0,
});

const store = createStore<GuildState>({
  isOpen: false,
  playerId: null,
  guildId: null,
  nickname: null,
  registryTick: 0,
  progress: emptyProgress(),
  uiTab: 'overview',
  lobbyMode: 'home',
  error: null,
  providerId: getGuildProviderId(),
});

function bump(): void {
  const s = store.getSnapshot();
  store.setState({ ...s, registryTick: s.registryTick + 1 });
}

function newPlayerId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `p-${crypto.randomUUID()}`;
  }
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function provider() {
  return getGuildProvider();
}

/** Local DEV only — not on GuildProvider interface. */
function localListAll(): Guild[] | null {
  const p = provider() as { listAll?: () => Guild[] };
  return typeof p.listAll === 'function' ? p.listAll() : null;
}

let myGuildCache: Guild | null = null;
let pendingOnlineKills = 0;
let pendingOnlineKillSource: 'online' | 'offline' | 'dev' = 'online';
let onlineKillFlushTimer: ReturnType<typeof setTimeout> | null = null;
const ONLINE_KILL_FLUSH_MS = 2_000;

async function refreshMyGuildCache(): Promise<void> {
  const { guildId } = store.getSnapshot();
  if (guildId) {
    myGuildCache = await provider().getGuild(guildId);
  } else {
    myGuildCache = null;
  }
  bump();
}

async function flushPendingOnlineKills(): Promise<void> {
  onlineKillFlushTimer = null;
  const count = pendingOnlineKills;
  const source = pendingOnlineKillSource;
  pendingOnlineKills = 0;
  if (count <= 0) return;
  const state = store.getSnapshot();
  if (!state.guildId || !state.playerId) return;
  try {
    for (let i = 0; i < count; i += 1) {
      await provider().grantOnlineKillProgress(state.guildId, state.playerId, { source });
    }
    await refreshMyGuildCache();
  } catch {
    // ignore
  }
}

let providerBound = false;

function bindProvider(): void {
  if (providerBound || typeof window === 'undefined') return;
  providerBound = true;
  const p = provider();
  if (typeof p.onChange === 'function') {
    p.onChange(() => {
      void refreshMyGuildCache();
    });
  }
}

async function syncGuildIdFromProvider(): Promise<void> {
  const state = store.getSnapshot();
  if (!state.playerId) return;
  const find = provider().findGuildIdByPlayer;
  if (!find) return;
  const found = await find.call(provider(), state.playerId);
  if (found !== state.guildId) {
    store.setState({ ...store.getSnapshot(), guildId: found });
  }
}

/**
 * Facade UI + sessão do jogador.
 * Dados de Guild via GuildProvider (local DEV ou backend PROD). Mock local NÃO migra para produção.
 */
export const guildStore = {
  subscribe: store.subscribe,
  getSnapshot: store.getSnapshot,

  reset(): void {
    myGuildCache = null;
    store.setState({
      isOpen: false,
      playerId: null,
      guildId: null,
      nickname: null,
      registryTick: 0,
      progress: emptyProgress(),
      uiTab: 'overview',
      lobbyMode: 'home',
      error: null,
      providerId: getGuildProviderId(),
    });
  },

  hydrate(partial: {
    playerId?: string | null;
    guildId?: string | null;
    nickname?: string | null;
    progress?: Partial<GuildPlayerProgress> | null;
  }): void {
    bindProvider();
    const mode = resolveSocialProviderMode();
    const authPlayerId = getAuthPlayerId();

    let playerId =
      typeof partial.playerId === 'string' && partial.playerId.trim()
        ? partial.playerId.trim()
        : null;

    if (mode === 'backend') {
      if (authPlayerId) playerId = authPlayerId;
      else if (!playerId) playerId = newPlayerId();
    } else if (!playerId) {
      playerId = newPlayerId();
    }

    let guildId =
      typeof partial.guildId === 'string' && partial.guildId.trim() ? partial.guildId.trim() : null;
    const nickname =
      typeof partial.nickname === 'string' && partial.nickname.trim()
        ? partial.nickname.trim()
        : null;

    if (mode === 'backend') {
      // Mock local NÃO migra para produção — descartar guildId de sessão mock.
      guildId = null;
    } else {
      const p = provider() as {
        findGuildIdByPlayer?: (id: string) => string | null | Promise<string | null>;
        listAll?: () => Guild[];
      };
      const foundSync = p.findGuildIdByPlayer?.(playerId);
      if (typeof foundSync === 'string' && foundSync) {
        guildId = foundSync;
      } else if (foundSync == null && guildId && typeof p.listAll === 'function') {
        const g = p.listAll().find((row) => row.id === guildId);
        if (!g || !g.members.some((m) => m.playerId === playerId)) guildId = null;
      }
    }

    const base = emptyProgress();
    const progressPartial = partial.progress;
    store.setState({
      isOpen: false,
      playerId,
      guildId,
      nickname,
      registryTick: 0,
      uiTab: 'overview',
      lobbyMode: 'home',
      error: null,
      providerId: getGuildProviderId(),
      progress: {
        guildCoins:
          typeof progressPartial?.guildCoins === 'number' && progressPartial.guildCoins >= 0
            ? Math.floor(progressPartial.guildCoins)
            : base.guildCoins,
        lastCheckInDay:
          typeof progressPartial?.lastCheckInDay === 'string'
            ? progressPartial.lastCheckInDay
            : null,
        claimedMissions:
          progressPartial?.claimedMissions && typeof progressPartial.claimedMissions === 'object'
            ? { ...progressPartial.claimedMissions }
            : {},
        missionProgress:
          progressPartial?.missionProgress && typeof progressPartial.missionProgress === 'object'
            ? { ...progressPartial.missionProgress }
            : {},
        bossDamage:
          typeof progressPartial?.bossDamage === 'number' && progressPartial.bossDamage >= 0
            ? Math.floor(progressPartial.bossDamage)
            : 0,
        bossAttacks:
          typeof progressPartial?.bossAttacks === 'number' && progressPartial.bossAttacks >= 0
            ? Math.floor(progressPartial.bossAttacks)
            : 0,
        fragmentShopDay:
          typeof progressPartial?.fragmentShopDay === 'string'
            ? progressPartial.fragmentShopDay
            : null,
        fragmentShopPurchases:
          typeof progressPartial?.fragmentShopPurchases === 'number' &&
          progressPartial.fragmentShopPurchases >= 0
            ? Math.floor(progressPartial.fragmentShopPurchases)
            : 0,
      },
    });

    if (mode === 'backend') {
      void syncGuildIdFromProvider().then(() => refreshMyGuildCache());
    } else {
      void refreshMyGuildCache();
    }
  },

  ensurePlayerId(): string {
    bindProvider();
    const state = store.getSnapshot();
    if (state.playerId) return state.playerId;

    let playerId: string | null = null;
    if (resolveSocialProviderMode() === 'backend') {
      playerId = getAuthPlayerId();
    }
    if (!playerId) playerId = newPlayerId();

    store.setState({ ...state, playerId });
    return playerId;
  },

  setNickname(nickname: string): void {
    const state = store.getSnapshot();
    store.setState({ ...state, nickname: nickname.trim() || null });
  },

  toggleOpen(): void {
    this.setOpen(!store.getSnapshot().isOpen);
  },

  setOpen(isOpen: boolean): void {
    bindProvider();
    void syncGuildIdFromProvider();
    void refreshMyGuildCache();
    store.setState({
      ...store.getSnapshot(),
      isOpen,
      uiTab: 'overview',
      error: null,
    });
  },

  setUiTab(tab: GuildUiTabId): void {
    store.setState({ ...store.getSnapshot(), uiTab: tab });
  },

  setLobbyMode(mode: GuildState['lobbyMode']): void {
    store.setState({ ...store.getSnapshot(), lobbyMode: mode });
  },

  isJoinUnlocked(level = vitalsStore.getLevel()): boolean {
    return level >= GUILD_CREATE_MIN_LEVEL;
  },

  isCreateUnlocked(level = vitalsStore.getLevel()): boolean {
    return this.isJoinUnlocked(level);
  },

  getCreateCost(): typeof GUILD_CREATE_COST {
    return GUILD_CREATE_COST;
  },

  getMyGuild(): Guild | null {
    void store.getSnapshot().registryTick;
    if (myGuildCache) return myGuildCache;
    const { guildId } = store.getSnapshot();
    if (!guildId) return null;
    const list = localListAll();
    if (list) {
      myGuildCache = list.find((g) => g.id === guildId) ?? null;
      return myGuildCache;
    }
    return null;
  },

  getMyRole(): GuildMemberRole | null {
    const guild = this.getMyGuild();
    const { playerId } = store.getSnapshot();
    if (!guild || !playerId) return null;
    return guild.members.find((m) => m.playerId === playerId)?.role ?? null;
  },

  listGuilds(): Guild[] {
    void store.getSnapshot().registryTick;
    const list = localListAll();
    if (list) {
      return [...list].sort((a, b) => b.level - a.level || a.name.localeCompare(b.name, 'pt-BR'));
    }
    return myGuildCache ? [myGuildCache] : [];
  },

  async searchGuilds(query: string, page = 0) {
    try {
      return await provider().searchGuilds({ query, page, pageSize: 20 });
    } catch (error) {
      store.setState({
        ...store.getSnapshot(),
        error: error instanceof Error ? error.message : 'Falha ao buscar Guilds.',
      });
      return { guilds: [], total: 0, page: 0, pageSize: 20 };
    }
  },

  async createGuild(params: {
    name: string;
    tag: string;
    description?: string;
    joinMode?: GuildJoinMode;
    emblemIcon?: string;
    emblemBg?: string;
  }): Promise<boolean> {
    const state = store.getSnapshot();
    if (state.guildId) {
      emitSystemMessage('Você já está em uma Guild.');
      return false;
    }
    if (!this.isCreateUnlocked()) {
      emitSystemMessage(`Guilds liberam no nível ${GUILD_CREATE_MIN_LEVEL}.`);
      return false;
    }
    void GUILD_CREATE_COST;

    try {
      const playerId = this.ensurePlayerId();
      const guild = await provider().createGuild(
        {
          name: params.name,
          tag: params.tag,
          description: params.description,
          joinMode: params.joinMode,
          emblemIcon: params.emblemIcon,
          emblemBg: params.emblemBg,
        },
        {
          playerId,
          nickname: state.nickname?.trim() || 'Jogador',
          playerLevel: vitalsStore.getLevel(),
        },
      );
      myGuildCache = guild;
      store.setState({
        ...store.getSnapshot(),
        playerId,
        guildId: guild.id,
        lobbyMode: 'home',
        uiTab: 'overview',
        error: null,
        registryTick: store.getSnapshot().registryTick + 1,
      });
      emitSystemMessage(`Guild [${guild.tag}] ${guild.name} criada.`);
      void import('@/lib/achievement-listeners').then((m) => m.notifyAchievementGuild());
      return true;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Não foi possível criar a Guild.';
      emitSystemMessage(msg);
      store.setState({ ...store.getSnapshot(), error: msg });
      return false;
    }
  },

  async joinGuild(guildId: string): Promise<boolean> {
    const state = store.getSnapshot();
    if (state.guildId) {
      emitSystemMessage('Você já está em uma Guild.');
      return false;
    }
    if (!this.isJoinUnlocked()) {
      emitSystemMessage(`Guilds liberam no nível ${GUILD_CREATE_MIN_LEVEL}.`);
      return false;
    }
    const playerId = this.ensurePlayerId();
    const result = await provider().joinGuild(guildId, {
      playerId,
      nickname: state.nickname?.trim() || 'Jogador',
      playerLevel: vitalsStore.getLevel(),
    });
    if (!result.ok) {
      emitSystemMessage(result.error ?? 'Não foi possível entrar.');
      return false;
    }
    if (result.pending) {
      emitSystemMessage('Solicitação enviada. Aguarde aprovação.');
      bump();
      return true;
    }
    store.setState({
      ...store.getSnapshot(),
      playerId,
      guildId,
      lobbyMode: 'home',
      error: null,
      registryTick: store.getSnapshot().registryTick + 1,
    });
    await refreshMyGuildCache();
    emitSystemMessage('Você entrou na Guild.');
    void import('@/lib/achievement-listeners').then((m) => m.notifyAchievementGuild());
    return true;
  },

  async leaveGuild(): Promise<boolean> {
    const state = store.getSnapshot();
    if (!state.guildId || !state.playerId) {
      emitSystemMessage('Você não está em uma Guild.');
      return false;
    }
    const result = await provider().leaveGuild(state.guildId, state.playerId);
    if (!result.ok) {
      emitSystemMessage(result.error ?? 'Não foi possível sair.');
      return false;
    }
    myGuildCache = null;
    store.setState({
      ...store.getSnapshot(),
      guildId: null,
      lobbyMode: 'home',
      registryTick: store.getSnapshot().registryTick + 1,
    });
    emitSystemMessage('Você saiu da Guild.');
    return true;
  },

  async dissolveGuild(): Promise<boolean> {
    const state = store.getSnapshot();
    if (!state.guildId || !state.playerId) return false;
    const result = await provider().dissolveGuild(state.guildId, state.playerId);
    if (!result.ok) {
      emitSystemMessage(result.error ?? 'Não foi possível dissolver.');
      return false;
    }
    myGuildCache = null;
    store.setState({
      ...store.getSnapshot(),
      guildId: null,
      lobbyMode: 'home',
      registryTick: store.getSnapshot().registryTick + 1,
    });
    emitSystemMessage('Guild dissolvida.');
    return true;
  },

  async transferLeadership(newLeaderId: string): Promise<boolean> {
    const state = store.getSnapshot();
    if (!state.guildId || !state.playerId) return false;
    const result = await provider().transferLeadership(state.guildId, state.playerId, newLeaderId);
    if (!result.ok) {
      emitSystemMessage(result.error ?? 'Transferência falhou.');
      return false;
    }
    await refreshMyGuildCache();
    emitSystemMessage('Liderança transferida.');
    return true;
  },

  async kickMember(targetId: string): Promise<boolean> {
    const state = store.getSnapshot();
    if (!state.guildId || !state.playerId) return false;
    const result = await provider().kickMember(state.guildId, state.playerId, targetId);
    if (!result.ok) {
      emitSystemMessage(result.error ?? 'Expulsão bloqueada.');
      return false;
    }
    await refreshMyGuildCache();
    return true;
  },

  async setMemberRole(targetId: string, role: GuildMemberRole): Promise<boolean> {
    const state = store.getSnapshot();
    if (!state.guildId || !state.playerId) return false;
    const result = await provider().updateMemberRole(state.guildId, state.playerId, targetId, role);
    if (!result.ok) {
      emitSystemMessage(result.error ?? 'Alteração de cargo bloqueada.');
      return false;
    }
    await refreshMyGuildCache();
    return true;
  },

  async editGuild(patch: {
    name?: string;
    description?: string;
    joinMode?: GuildJoinMode;
    emblemIcon?: string;
    emblemBg?: string;
  }): Promise<boolean> {
    const state = store.getSnapshot();
    if (!state.guildId || !state.playerId) return false;
    const result = await provider().editGuild(state.guildId, state.playerId, patch);
    if (!result.ok) {
      emitSystemMessage(result.error ?? 'Edição bloqueada.');
      return false;
    }
    await refreshMyGuildCache();
    return true;
  },

  async approveApplication(applicantId: string): Promise<boolean> {
    const state = store.getSnapshot();
    if (!state.guildId || !state.playerId) return false;
    const result = await provider().approveApplication(state.guildId, state.playerId, applicantId);
    if (!result.ok) {
      emitSystemMessage(result.error ?? 'Aprovação falhou.');
      return false;
    }
    await refreshMyGuildCache();
    return true;
  },

  async rejectApplication(applicantId: string): Promise<boolean> {
    const state = store.getSnapshot();
    if (!state.guildId || !state.playerId) return false;
    const result = await provider().rejectApplication(state.guildId, state.playerId, applicantId);
    if (!result.ok) {
      emitSystemMessage(result.error ?? 'Rejeição falhou.');
      return false;
    }
    await refreshMyGuildCache();
    return true;
  },

  notifyOnlineKill(opts?: { source?: 'online' | 'offline' | 'dev' }): void {
    const state = store.getSnapshot();
    if (!state.guildId || !state.playerId) return;
    pendingOnlineKills += 1;
    pendingOnlineKillSource = opts?.source ?? 'online';
    if (onlineKillFlushTimer) return;
    onlineKillFlushTimer = setTimeout(() => {
      void flushPendingOnlineKills();
    }, ONLINE_KILL_FLUSH_MS);
  },

  async devAddGuildXp(amount: number): Promise<void> {
    const g = this.getMyGuild();
    if (!g) return;
    const updated = await provider().addGuildXp(g.id, amount);
    if (updated) myGuildCache = updated;
    else await refreshMyGuildCache();
  },

  async devSeedMock(): Promise<void> {
    await provider().seedMockGuild?.({ memberCount: 10 });
    await refreshMyGuildCache();
  },

  async devResetGuildData(): Promise<void> {
    await provider().resetAll?.();
    myGuildCache = null;
    store.setState({
      ...store.getSnapshot(),
      guildId: null,
      registryTick: store.getSnapshot().registryTick + 1,
    });
  },

  async devForceFail(fail: boolean): Promise<void> {
    provider().setForceFail?.(fail);
  },

  getProviderId(): string {
    return getGuildProviderId();
  },
};
