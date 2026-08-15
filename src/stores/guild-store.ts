import {
  GUILD_BOSS_MAX_HP,
  GUILD_CHECKIN_COINS,
  GUILD_CHECKIN_EXP,
  GUILD_CREATE_MIN_LEVEL,
  GUILD_DEFAULT_EMBLEM,
  GUILD_DONATE_MIN,
  GUILD_EMBLEMS,
  GUILD_MAX_MEMBERS,
  GUILD_NAME_MAX,
  GUILD_NAME_MIN,
  GUILD_TAG_MAX,
  GUILD_TAG_MIN,
  guildExpForLevel,
} from '@/constants/guild';
import {
  GUILD_MISSION_DEFS,
  GUILD_SHOP_DEFS,
  GUILD_SKILL_DEFS,
} from '@/data/guild-content';
import { SHOP_CURRENCY_ITEM_ID } from '@/constants/sealing';
import { emitSystemMessage } from '@/lib/system-log';
import { createStore } from '@/stores/create-store';
import { inventoryStore } from '@/stores/inventory-store';
import { vitalsStore } from '@/stores/vitals-store';
import type {
  Guild,
  GuildBannerStyle,
  GuildMember,
  GuildMemberRole,
} from '@/types/guild';
import { isLeadershipRole } from '@/types/guild';

const GUILDS_STORAGE_KEY = 'idle-mmorpg:guilds-v2';

export interface GuildPlayerProgress {
  guildCoins: number;
  lastCheckInDay: string | null;
  /** Missões reivindicadas (id → true). */
  claimedMissions: Record<string, boolean>;
  missionProgress: Record<string, number>;
  bossDamage: number;
  bossAttacks: number;
}

export interface GuildState {
  isOpen: boolean;
  playerId: string | null;
  guildId: string | null;
  nickname: string | null;
  registryTick: number;
  progress: GuildPlayerProgress;
}

const emptyProgress = (): GuildPlayerProgress => ({
  guildCoins: 0,
  lastCheckInDay: null,
  claimedMissions: {},
  missionProgress: {},
  bossDamage: 0,
  bossAttacks: 0,
});

const store = createStore<GuildState>({
  isOpen: false,
  playerId: null,
  guildId: null,
  nickname: null,
  registryTick: 0,
  progress: emptyProgress(),
});

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function bump(): void {
  const s = store.getSnapshot();
  store.setState({ ...s, registryTick: s.registryTick + 1 });
}

function patchProgress(partial: Partial<GuildPlayerProgress>): void {
  const s = store.getSnapshot();
  store.setState({
    ...s,
    progress: { ...s.progress, ...partial },
    registryTick: s.registryTick + 1,
  });
}

function loadRegistry(): Record<string, Guild> {
  if (typeof window === 'undefined') return {};
  try {
    const raw =
      window.localStorage.getItem(GUILDS_STORAGE_KEY) ??
      window.localStorage.getItem('idle-mmorpg:guilds-v1');
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Record<string, Guild> = {};
    for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
      const g = normalizeGuild(value);
      if (g) out[id] = g;
    }
    return out;
  } catch {
    return {};
  }
}

function saveRegistry(registry: Record<string, Guild>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(GUILDS_STORAGE_KEY, JSON.stringify(registry));
  } catch {
    // ignore
  }
}

function roleFromRaw(value: unknown): GuildMemberRole {
  if (value === 'leader' || value === 'LÍDER') return 'leader';
  if (value === 'vice' || value === 'VICE-LÍDER') return 'vice';
  if (value === 'officer' || value === 'OFICIAL') return 'officer';
  return 'member';
}

function bannerStyleFromRaw(value: unknown): GuildBannerStyle {
  if (
    value === 'shield' ||
    value === 'standard' ||
    value === 'pennant' ||
    value === 'swallowtail' ||
    value === 'round' ||
    value === 'diamond'
  ) {
    return value;
  }
  return 'shield';
}

function defaultSkillLevels(): Record<string, number> {
  const levels: Record<string, number> = {};
  for (const sk of GUILD_SKILL_DEFS) levels[sk.id] = 0;
  return levels;
}

function defaultShopStock(): Record<string, number> {
  const stock: Record<string, number> = {};
  for (const item of GUILD_SHOP_DEFS) stock[item.id] = item.maxStock;
  return stock;
}

/** Estandartes descontinuados caem no padrão para não virarem imagem quebrada. */
function normalizeEmblemIcon(value: unknown): string {
  if (typeof value !== 'string' || !value) return GUILD_DEFAULT_EMBLEM;
  if (!value.startsWith('/')) return value;
  return GUILD_EMBLEMS.some((em) => em.icon === value) ? value : GUILD_DEFAULT_EMBLEM;
}

function normalizeGuild(raw: unknown): Guild | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  if (typeof data.id !== 'string' || !data.id) return null;
  if (typeof data.name !== 'string' || !data.name.trim()) return null;
  if (typeof data.tag !== 'string' || !data.tag.trim()) return null;
  if (typeof data.leaderId !== 'string' || !data.leaderId) return null;
  if (!Array.isArray(data.members) || data.members.length === 0) return null;

  const members: GuildMember[] = [];
  for (const entry of data.members) {
    if (!entry || typeof entry !== 'object') continue;
    const m = entry as Record<string, unknown>;
    if (typeof m.playerId !== 'string' || typeof m.nickname !== 'string') continue;
    members.push({
      playerId: m.playerId,
      nickname: m.nickname.trim() || 'Jogador',
      role: roleFromRaw(m.role),
      joinedAt:
        typeof m.joinedAt === 'number' && Number.isFinite(m.joinedAt) ? m.joinedAt : Date.now(),
      coinsDonated:
        typeof m.coinsDonated === 'number' && Number.isFinite(m.coinsDonated)
          ? Math.max(0, Math.floor(m.coinsDonated))
          : 0,
      expContributed:
        typeof m.expContributed === 'number' && Number.isFinite(m.expContributed)
          ? Math.max(0, Math.floor(m.expContributed))
          : 0,
    });
  }
  if (members.length === 0) return null;

  const maxMembers =
    typeof data.maxMembers === 'number' && data.maxMembers > 0
      ? Math.min(GUILD_MAX_MEMBERS, Math.floor(data.maxMembers))
      : GUILD_MAX_MEMBERS;

  const level =
    typeof data.level === 'number' && data.level >= 1 ? Math.floor(data.level) : 1;
  const exp =
    typeof data.exp === 'number' && data.exp >= 0 ? Math.floor(data.exp) : 0;
  const funds =
    typeof data.funds === 'number' && data.funds >= 0 ? Math.floor(data.funds) : 0;
  const bossMaxHp =
    typeof data.bossMaxHp === 'number' && data.bossMaxHp > 0
      ? Math.floor(data.bossMaxHp)
      : GUILD_BOSS_MAX_HP;
  const bossHp =
    typeof data.bossHp === 'number' && data.bossHp >= 0
      ? Math.min(bossMaxHp, Math.floor(data.bossHp))
      : bossMaxHp;

  const skillLevels = {
    ...defaultSkillLevels(),
    ...(data.skillLevels && typeof data.skillLevels === 'object'
      ? (data.skillLevels as Record<string, number>)
      : {}),
  };
  const shopStock = {
    ...defaultShopStock(),
    ...(data.shopStock && typeof data.shopStock === 'object'
      ? (data.shopStock as Record<string, number>)
      : {}),
  };

  return {
    id: data.id,
    name: data.name.trim().slice(0, GUILD_NAME_MAX),
    tag: data.tag.trim().toUpperCase().slice(0, GUILD_TAG_MAX),
    leaderId: data.leaderId,
    members: members.slice(0, maxMembers),
    maxMembers,
    createdAt:
      typeof data.createdAt === 'number' && Number.isFinite(data.createdAt)
        ? data.createdAt
        : Date.now(),
    level,
    exp,
    funds,
    notice:
      typeof data.notice === 'string' && data.notice.trim()
        ? data.notice.trim().slice(0, 280)
        : 'Bem-vindos à guild! Marquem presença e doem para fortalecer a equipe.',
    emblemIcon: normalizeEmblemIcon(data.emblemIcon),
    emblemBg:
      typeof data.emblemBg === 'string' && data.emblemBg ? data.emblemBg : '#7f1d1d',
    bannerStyle: bannerStyleFromRaw(data.bannerStyle),
    bossHp,
    bossMaxHp,
    skillLevels,
    shopStock,
  };
}

function newPlayerId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `p-${crypto.randomUUID()}`;
  }
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function newGuildId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `g-${crypto.randomUUID()}`;
  }
  return `g-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function addGuildExp(guild: Guild, amount: number): Guild {
  let { level, exp } = guild;
  exp += Math.max(0, Math.floor(amount));
  let need = guildExpForLevel(level);
  while (exp >= need && level < 99) {
    exp -= need;
    level += 1;
    need = guildExpForLevel(level);
  }
  return { ...guild, level, exp };
}

function updateGuild(guildId: string, updater: (g: Guild) => Guild): Guild | null {
  const registry = loadRegistry();
  const current = registry[guildId];
  if (!current) return null;
  const next = updater(current);
  registry[guildId] = next;
  saveRegistry(registry);
  bump();
  return next;
}

export function normalizeGuildName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, GUILD_NAME_MAX);
}

export function normalizeGuildTag(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, GUILD_TAG_MAX);
}

export function isValidGuildName(name: string): boolean {
  const n = normalizeGuildName(name);
  return n.length >= GUILD_NAME_MIN && n.length <= GUILD_NAME_MAX;
}

export function isValidGuildTag(tag: string): boolean {
  const t = normalizeGuildTag(tag);
  return t.length >= GUILD_TAG_MIN && t.length <= GUILD_TAG_MAX;
}

/**
 * Sistema de guild (criar/entrar + economia local da janela).
 * Registro: `idle-mmorpg:guilds-v2`.
 */
export const guildStore = {
  subscribe: store.subscribe,
  getSnapshot: store.getSnapshot,

  reset(): void {
    store.setState({
      isOpen: false,
      playerId: null,
      guildId: null,
      nickname: null,
      registryTick: 0,
      progress: emptyProgress(),
    });
  },

  hydrate(partial: {
    playerId?: string | null;
    guildId?: string | null;
    nickname?: string | null;
    progress?: Partial<GuildPlayerProgress> | null;
  }): void {
    let playerId =
      typeof partial.playerId === 'string' && partial.playerId.trim()
        ? partial.playerId.trim()
        : null;
    if (!playerId) playerId = newPlayerId();

    let guildId =
      typeof partial.guildId === 'string' && partial.guildId.trim()
        ? partial.guildId.trim()
        : null;

    const nickname =
      typeof partial.nickname === 'string' && partial.nickname.trim()
        ? partial.nickname.trim()
        : null;

    if (guildId) {
      const registry = loadRegistry();
      const guild = registry[guildId];
      if (!guild || !guild.members.some((m) => m.playerId === playerId)) {
        guildId = null;
      } else if (nickname) {
        guild.members = guild.members.map((m) =>
          m.playerId === playerId ? { ...m, nickname } : m,
        );
        registry[guildId] = guild;
        saveRegistry(registry);
      }
    }

    const base = emptyProgress();
    const p = partial.progress;
    store.setState({
      isOpen: false,
      playerId,
      guildId,
      nickname,
      registryTick: 0,
      progress: {
        guildCoins:
          typeof p?.guildCoins === 'number' && p.guildCoins >= 0
            ? Math.floor(p.guildCoins)
            : base.guildCoins,
        lastCheckInDay:
          typeof p?.lastCheckInDay === 'string' ? p.lastCheckInDay : null,
        claimedMissions:
          p?.claimedMissions && typeof p.claimedMissions === 'object'
            ? { ...p.claimedMissions }
            : {},
        missionProgress:
          p?.missionProgress && typeof p.missionProgress === 'object'
            ? { ...p.missionProgress }
            : {},
        bossDamage:
          typeof p?.bossDamage === 'number' && p.bossDamage >= 0
            ? Math.floor(p.bossDamage)
            : 0,
        bossAttacks:
          typeof p?.bossAttacks === 'number' && p.bossAttacks >= 0
            ? Math.floor(p.bossAttacks)
            : 0,
      },
    });
  },

  ensurePlayerId(): string {
    const state = store.getSnapshot();
    if (state.playerId) return state.playerId;
    const playerId = newPlayerId();
    store.setState({ ...state, playerId });
    return playerId;
  },

  setNickname(nickname: string): void {
    const state = store.getSnapshot();
    const next = nickname.trim() || null;
    store.setState({ ...state, nickname: next });
    if (state.guildId && state.playerId && next) {
      updateGuild(state.guildId, (g) => ({
        ...g,
        members: g.members.map((m) =>
          m.playerId === state.playerId ? { ...m, nickname: next } : m,
        ),
      }));
    }
  },

  toggleOpen(): void {
    const state = store.getSnapshot();
    store.setState({ ...state, isOpen: !state.isOpen });
  },

  setOpen(isOpen: boolean): void {
    store.setState({ ...store.getSnapshot(), isOpen });
  },

  isCreateUnlocked(level = vitalsStore.getLevel()): boolean {
    return level >= GUILD_CREATE_MIN_LEVEL;
  },

  isCheckedInToday(): boolean {
    return store.getSnapshot().progress.lastCheckInDay === todayKey();
  },

  getMyGuild(): Guild | null {
    const { guildId } = store.getSnapshot();
    if (!guildId) return null;
    return loadRegistry()[guildId] ?? null;
  },

  getMyRole(): GuildMemberRole | null {
    const { guildId, playerId } = store.getSnapshot();
    if (!guildId || !playerId) return null;
    const guild = loadRegistry()[guildId];
    return guild?.members.find((m) => m.playerId === playerId)?.role ?? null;
  },

  listGuilds(): Guild[] {
    void store.getSnapshot().registryTick;
    return Object.values(loadRegistry()).sort((a, b) => {
      if (b.level !== a.level) return b.level - a.level;
      if (b.funds !== a.funds) return b.funds - a.funds;
      return a.name.localeCompare(b.name, 'pt-BR');
    });
  },

  serverRank(guildId: string): number {
    const list = this.listGuilds();
    const idx = list.findIndex((g) => g.id === guildId);
    return idx >= 0 ? idx + 1 : list.length + 1;
  },

  createGuild(params: {
    name: string;
    tag: string;
    emblemIcon?: string;
    emblemBg?: string;
    bannerStyle?: GuildBannerStyle;
  }): boolean {
    const state = store.getSnapshot();
    if (state.guildId) {
      emitSystemMessage('Você já está em uma guild.');
      return false;
    }
    if (!this.isCreateUnlocked()) {
      emitSystemMessage(`Guilds liberam no nível ${GUILD_CREATE_MIN_LEVEL}.`);
      return false;
    }

    const name = normalizeGuildName(params.name);
    const tag = normalizeGuildTag(params.tag);
    if (!isValidGuildName(name) || !isValidGuildTag(tag)) {
      emitSystemMessage('Nome ou tag inválidos.');
      return false;
    }

    const registry = loadRegistry();
    if (Object.values(registry).some((g) => g.name.toLowerCase() === name.toLowerCase())) {
      emitSystemMessage('Já existe uma guild com esse nome.');
      return false;
    }
    if (Object.values(registry).some((g) => g.tag === tag)) {
      emitSystemMessage('Essa tag já está em uso.');
      return false;
    }

    const playerId = this.ensurePlayerId();
    const nickname = state.nickname?.trim() || 'Shinobi';
    const id = newGuildId();
    const now = Date.now();
    const guild: Guild = {
      id,
      name,
      tag,
      leaderId: playerId,
      members: [
        {
          playerId,
          nickname,
          role: 'leader',
          joinedAt: now,
          coinsDonated: 0,
          expContributed: 0,
        },
      ],
      maxMembers: GUILD_MAX_MEMBERS,
      createdAt: now,
      level: 1,
      exp: 0,
      funds: 0,
      notice:
        '⚡ [AVISO]: Marquem presença diária e doem cobre para subir as habilidades da guilda!',
      emblemIcon: normalizeEmblemIcon(params.emblemIcon),
      emblemBg: params.emblemBg || '#7f1d1d',
      bannerStyle: params.bannerStyle ?? 'shield',
      bossHp: GUILD_BOSS_MAX_HP,
      bossMaxHp: GUILD_BOSS_MAX_HP,
      skillLevels: defaultSkillLevels(),
      shopStock: defaultShopStock(),
    };

    registry[id] = guild;
    saveRegistry(registry);
    store.setState({
      ...store.getSnapshot(),
      playerId,
      guildId: id,
      registryTick: store.getSnapshot().registryTick + 1,
    });
    emitSystemMessage(`Guild [${tag}] ${name} criada (${GUILD_MAX_MEMBERS} vagas).`);
    return true;
  },

  joinGuild(guildId: string): boolean {
    const state = store.getSnapshot();
    if (state.guildId) {
      emitSystemMessage('Você já está em uma guild.');
      return false;
    }
    if (!this.isCreateUnlocked()) {
      emitSystemMessage(`Guilds liberam no nível ${GUILD_CREATE_MIN_LEVEL}.`);
      return false;
    }

    const registry = loadRegistry();
    const guild = registry[guildId];
    if (!guild) {
      emitSystemMessage('Guild não encontrada.');
      return false;
    }
    if (guild.members.length >= guild.maxMembers) {
      emitSystemMessage('A guild está cheia.');
      return false;
    }

    const playerId = this.ensurePlayerId();
    if (guild.members.some((m) => m.playerId === playerId)) {
      store.setState({ ...state, guildId: guild.id });
      return true;
    }

    const nickname = state.nickname?.trim() || 'Shinobi';
    guild.members = [
      ...guild.members,
      {
        playerId,
        nickname,
        role: 'member',
        joinedAt: Date.now(),
        coinsDonated: 0,
        expContributed: 0,
      },
    ];
    registry[guildId] = guild;
    saveRegistry(registry);
    store.setState({
      ...store.getSnapshot(),
      playerId,
      guildId,
      registryTick: store.getSnapshot().registryTick + 1,
    });
    emitSystemMessage(`Você entrou em [${guild.tag}] ${guild.name}.`);
    return true;
  },

  leaveGuild(): boolean {
    const state = store.getSnapshot();
    if (!state.guildId || !state.playerId) {
      emitSystemMessage('Você não está em uma guild.');
      return false;
    }

    const registry = loadRegistry();
    const guild = registry[state.guildId];
    if (!guild) {
      store.setState({ ...state, guildId: null });
      return true;
    }

    const remaining = guild.members.filter((m) => m.playerId !== state.playerId);
    if (remaining.length === 0) {
      delete registry[guild.id];
      saveRegistry(registry);
      store.setState({
        ...store.getSnapshot(),
        guildId: null,
        registryTick: store.getSnapshot().registryTick + 1,
      });
      emitSystemMessage(`Guild [${guild.tag}] ${guild.name} dissolvida.`);
      return true;
    }

    let next: Guild = { ...guild, members: remaining };
    if (guild.leaderId === state.playerId) {
      const sorted = [...remaining].sort((a, b) => a.joinedAt - b.joinedAt);
      const newLeader = sorted[0];
      next = {
        ...next,
        leaderId: newLeader.playerId,
        members: remaining.map((m) =>
          m.playerId === newLeader.playerId
            ? { ...m, role: 'leader' as const }
            : m.role === 'leader'
              ? { ...m, role: 'member' as const }
              : m,
        ),
      };
      emitSystemMessage(`Você saiu. ${newLeader.nickname} agora é o líder.`);
    } else {
      emitSystemMessage(`Você saiu de [${guild.tag}] ${guild.name}.`);
    }

    registry[guild.id] = next;
    saveRegistry(registry);
    store.setState({
      ...store.getSnapshot(),
      guildId: null,
      registryTick: store.getSnapshot().registryTick + 1,
    });
    return true;
  },

  checkIn(): boolean {
    const state = store.getSnapshot();
    if (!state.guildId) return false;
    if (this.isCheckedInToday()) {
      emitSystemMessage('Presença de hoje já marcada.');
      return false;
    }
    updateGuild(state.guildId, (g) => addGuildExp(g, GUILD_CHECKIN_EXP));
    const coins = state.progress.guildCoins + GUILD_CHECKIN_COINS;
    const missionProgress = {
      ...state.progress.missionProgress,
      'm-checkin': 1,
    };
    store.setState({
      ...store.getSnapshot(),
      progress: {
        ...store.getSnapshot().progress,
        guildCoins: coins,
        lastCheckInDay: todayKey(),
        missionProgress,
      },
      registryTick: store.getSnapshot().registryTick + 1,
    });
    emitSystemMessage(
      `Presença marcada! +${GUILD_CHECKIN_COINS} moedas de guilda, +${GUILD_CHECKIN_EXP} EXP.`,
    );
    return true;
  },

  /** Doa cobre do inventário → fundos da guild. */
  donate(amount: number): boolean {
    const state = store.getSnapshot();
    if (!state.guildId || !state.playerId) return false;
    const value = Math.floor(amount);
    if (value < GUILD_DONATE_MIN) {
      emitSystemMessage(`Doação mínima: ${GUILD_DONATE_MIN} cobre.`);
      return false;
    }
    if (!inventoryStore.removeItem(SHOP_CURRENCY_ITEM_ID, value)) {
      emitSystemMessage('Cobre insuficiente no inventário.');
      return false;
    }

    const personalCoins = Math.floor(value * 0.1);
    const guildExp = value * 2;

    updateGuild(state.guildId, (g) => {
      const withExp = addGuildExp(
        { ...g, funds: g.funds + value },
        guildExp,
      );
      return {
        ...withExp,
        members: withExp.members.map((m) =>
          m.playerId === state.playerId
            ? {
                ...m,
                coinsDonated: m.coinsDonated + value,
                expContributed: m.expContributed + guildExp,
              }
            : m,
        ),
      };
    });

    const prevDonate = state.progress.missionProgress['m-donation'] ?? 0;
    patchProgress({
      guildCoins: state.progress.guildCoins + personalCoins,
      missionProgress: {
        ...state.progress.missionProgress,
        'm-donation': prevDonate + value,
      },
    });
    emitSystemMessage(
      `Você doou ${value.toLocaleString('pt-BR')} cobre (+${personalCoins} moedas de guilda).`,
    );
    return true;
  },

  claimMission(missionId: string): boolean {
    const state = store.getSnapshot();
    if (!state.guildId) return false;
    const def = GUILD_MISSION_DEFS.find((m) => m.id === missionId);
    if (!def) return false;
    if (state.progress.claimedMissions[missionId]) {
      emitSystemMessage('Recompensa já resgatada.');
      return false;
    }
    const progress = state.progress.missionProgress[missionId] ?? 0;
    if (progress < def.target) {
      emitSystemMessage('Missão ainda incompleta.');
      return false;
    }
    updateGuild(state.guildId, (g) => addGuildExp(g, def.rewardExp));
    patchProgress({
      guildCoins: state.progress.guildCoins + def.rewardCoins,
      claimedMissions: { ...state.progress.claimedMissions, [missionId]: true },
    });
    emitSystemMessage(`Missão concluída: +${def.rewardCoins} moedas, +${def.rewardExp} EXP.`);
    return true;
  },

  claimAllMissions(): number {
    let n = 0;
    for (const def of GUILD_MISSION_DEFS) {
      if (this.claimMission(def.id)) n += 1;
    }
    return n;
  },

  attackBoss(): boolean {
    const state = store.getSnapshot();
    if (!state.guildId || !state.playerId) return false;
    const guild = this.getMyGuild();
    if (!guild || guild.bossHp <= 0) {
      emitSystemMessage('Boss já foi derrotado. Aguardando nova wave.');
      return false;
    }

    const dmg = Math.floor(800_000 + Math.random() * 1_700_000);
    const crit = Math.random() < 0.25;
    const finalDmg = crit ? Math.floor(dmg * 2.2) : dmg;

    updateGuild(state.guildId, (g) => ({
      ...g,
      bossHp: Math.max(0, g.bossHp - finalDmg),
    }));

    patchProgress({
      guildCoins: state.progress.guildCoins + 50,
      bossDamage: state.progress.bossDamage + finalDmg,
      bossAttacks: state.progress.bossAttacks + 1,
      missionProgress: {
        ...state.progress.missionProgress,
        'm-boss': 1,
      },
    });

    const left = Math.max(0, (guild.bossHp - finalDmg));
    emitSystemMessage(
      `Boss: ${finalDmg.toLocaleString('pt-BR')} de dano${crit ? ' (CRÍTICO!)' : ''}. HP restante: ${left.toLocaleString('pt-BR')}.`,
    );
    if (left <= 0) {
      updateGuild(state.guildId, (g) => addGuildExp(g, 5_000));
      patchProgress({
        guildCoins: store.getSnapshot().progress.guildCoins + 200,
      });
      emitSystemMessage('Boss derrotado! A guilda ganhou recompensas extras.');
    }
    return true;
  },

  upgradeSkill(skillId: string): boolean {
    const state = store.getSnapshot();
    const role = this.getMyRole();
    if (!state.guildId || !role || !isLeadershipRole(role)) {
      emitSystemMessage('Apenas Líder/Vice pode aprimorar habilidades.');
      return false;
    }
    const def = GUILD_SKILL_DEFS.find((s) => s.id === skillId);
    if (!def) return false;

    const guild = this.getMyGuild();
    if (!guild) return false;
    const level = guild.skillLevels[skillId] ?? 0;
    if (level >= def.maxLevel) {
      emitSystemMessage('Habilidade no nível máximo.');
      return false;
    }

    const costFunds = Math.floor(def.baseFunds * Math.pow(1.25, level));
    const costCoins = Math.floor(def.baseCoins * Math.pow(1.2, level));
    if (guild.funds < costFunds) {
      emitSystemMessage('Fundos da guilda insuficientes.');
      return false;
    }
    if (state.progress.guildCoins < costCoins) {
      emitSystemMessage('Moedas de guilda insuficientes.');
      return false;
    }

    updateGuild(state.guildId, (g) => ({
      ...g,
      funds: g.funds - costFunds,
      skillLevels: { ...g.skillLevels, [skillId]: level + 1 },
    }));
    patchProgress({ guildCoins: state.progress.guildCoins - costCoins });
    emitSystemMessage(`${def.name} → nível ${level + 1}.`);
    return true;
  },

  buyShopItem(itemId: string): boolean {
    const state = store.getSnapshot();
    if (!state.guildId) return false;
    const def = GUILD_SHOP_DEFS.find((i) => i.id === itemId);
    if (!def) return false;
    const guild = this.getMyGuild();
    if (!guild) return false;
    if (guild.level < def.reqGuildLevel) {
      emitSystemMessage(`Requer guilda nível ${def.reqGuildLevel}.`);
      return false;
    }
    const stock = guild.shopStock[itemId] ?? 0;
    if (stock <= 0) {
      emitSystemMessage('Item sem estoque.');
      return false;
    }
    if (state.progress.guildCoins < def.priceCoins) {
      emitSystemMessage('Moedas de guilda insuficientes.');
      return false;
    }

    updateGuild(state.guildId, (g) => ({
      ...g,
      shopStock: { ...g.shopStock, [itemId]: stock - 1 },
    }));
    patchProgress({
      guildCoins: state.progress.guildCoins - def.priceCoins,
      missionProgress: {
        ...state.progress.missionProgress,
        'm-shop': 1,
      },
    });

    if (def.copperReward > 0) {
      inventoryStore.addItem(SHOP_CURRENCY_ITEM_ID, def.copperReward);
      emitSystemMessage(
        `Comprou ${def.name}. +${def.copperReward} cobre no inventário.`,
      );
    } else {
      emitSystemMessage(`Comprou ${def.name}.`);
    }
    return true;
  },

  updateNotice(notice: string): boolean {
    const state = store.getSnapshot();
    const role = this.getMyRole();
    if (!state.guildId || !role || !isLeadershipRole(role)) return false;
    updateGuild(state.guildId, (g) => ({
      ...g,
      notice: notice.trim().slice(0, 280) || g.notice,
    }));
    emitSystemMessage('Mural oficial atualizado.');
    return true;
  },

  updateEmblem(icon: string, bg: string, bannerStyle?: GuildBannerStyle): boolean {
    const state = store.getSnapshot();
    const role = this.getMyRole();
    if (!state.guildId || !role || !isLeadershipRole(role)) return false;
    updateGuild(state.guildId, (g) => ({
      ...g,
      emblemIcon: icon,
      emblemBg: bg,
      bannerStyle: bannerStyle ?? g.bannerStyle,
    }));
    return true;
  },
};
