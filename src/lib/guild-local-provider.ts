import {
  GUILD_ACTIVITY_LIMIT,
  GUILD_CONTRIBUTION_PER_ONLINE_KILL,
  GUILD_DEFAULT_EMBLEM,
  GUILD_MEMBER_LIMIT,
  GUILD_NAME_MAX,
  GUILD_TAG_MAX,
  GUILD_XP_PER_ONLINE_KILL,
} from '@/constants/guild';
import { emitGuildEvent } from '@/lib/guild-events';
import {
  canDemoteMember,
  canDissolveGuild,
  canKickMember,
  canLeaveGuild,
  canPromoteMember,
  canTransferLeadership,
  canGuildMemberPerform,
} from '@/lib/guild-permissions';
import { applyGuildXp, isValidGuildName, isValidGuildTag, normalizeGuildName, normalizeGuildTag } from '@/lib/guild-xp';
import type {
  CreateGuildInput,
  Guild,
  GuildActivity,
  GuildApplication,
  GuildMember,
  GuildMemberRole,
  GuildProvider,
  GuildPublicSummary,
  GuildSearchQuery,
  GuildSearchResult,
} from '@/types/guild';

const STORAGE_KEY = 'idle-mmorpg:guilds-v3';
const LEGACY_KEYS = ['idle-mmorpg:guilds-v2', 'idle-mmorpg:guilds-v1'] as const;

function newId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function defaultBenefits(): Guild['benefits'] {
  return { extraMemberSlots: 0, guildBossUnlocked: false };
}

function pushActivity(
  guild: Guild,
  entry: Omit<GuildActivity, 'id' | 'timestamp'> & { timestamp?: number },
): Guild {
  const activity: GuildActivity = {
    id: newId('ga'),
    timestamp: entry.timestamp ?? Date.now(),
    type: entry.type,
    actorId: entry.actorId,
    targetId: entry.targetId,
    message: entry.message,
  };
  const next = [activity, ...guild.activity].slice(0, GUILD_ACTIVITY_LIMIT);
  return { ...guild, activity: next };
}

function roleFromRaw(value: unknown): GuildMemberRole {
  if (value === 'leader' || value === 'LÍDER') return 'leader';
  if (value === 'officer' || value === 'OFICIAL' || value === 'vice' || value === 'VICE-LÍDER') {
    return 'officer';
  }
  return 'member';
}

function normalizeMember(raw: unknown): GuildMember | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Record<string, unknown>;
  if (typeof m.playerId !== 'string' || typeof m.nickname !== 'string') return null;
  const contribution =
    typeof m.contribution === 'number' && Number.isFinite(m.contribution)
      ? Math.max(0, Math.floor(m.contribution))
      : typeof m.expContributed === 'number' && Number.isFinite(m.expContributed)
        ? Math.max(0, Math.floor(m.expContributed))
        : 0;
  const joinedAt =
    typeof m.joinedAt === 'number' && Number.isFinite(m.joinedAt) ? m.joinedAt : Date.now();
  return {
    playerId: m.playerId,
    nickname: m.nickname.trim() || 'Jogador',
    role: roleFromRaw(m.role),
    contribution,
    joinedAt,
    lastActiveAt:
      typeof m.lastActiveAt === 'number' && Number.isFinite(m.lastActiveAt)
        ? m.lastActiveAt
        : joinedAt,
    playerLevel:
      typeof m.playerLevel === 'number' && m.playerLevel >= 1 ? Math.floor(m.playerLevel) : 1,
  };
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
    const m = normalizeMember(entry);
    if (m) members.push(m);
  }
  if (members.length === 0) return null;

  // Exactly one leader
  let leaderId = data.leaderId;
  const leaders = members.filter((m) => m.role === 'leader');
  if (leaders.length !== 1 || leaders[0].playerId !== leaderId) {
    const preferred = members.find((m) => m.playerId === leaderId) ?? members[0];
    leaderId = preferred.playerId;
    for (const m of members) {
      m.role = m.playerId === leaderId ? 'leader' : m.role === 'leader' ? 'member' : m.role;
    }
  }

  const maxMembers =
    typeof data.maxMembers === 'number' && data.maxMembers > 0
      ? Math.min(GUILD_MEMBER_LIMIT, Math.floor(data.maxMembers))
      : GUILD_MEMBER_LIMIT;

  const xp =
    typeof data.xp === 'number' && data.xp >= 0
      ? Math.floor(data.xp)
      : typeof data.exp === 'number' && data.exp >= 0
        ? Math.floor(data.exp)
        : 0;

  const applications: GuildApplication[] = [];
  if (Array.isArray(data.applications)) {
    for (const row of data.applications) {
      if (!row || typeof row !== 'object') continue;
      const a = row as Record<string, unknown>;
      if (typeof a.playerId !== 'string' || typeof a.nickname !== 'string') continue;
      applications.push({
        playerId: a.playerId,
        nickname: a.nickname,
        playerLevel: typeof a.playerLevel === 'number' ? Math.floor(a.playerLevel) : 1,
        requestedAt: typeof a.requestedAt === 'number' ? a.requestedAt : Date.now(),
      });
    }
  }

  const activity: GuildActivity[] = [];
  if (Array.isArray(data.activity)) {
    for (const row of data.activity) {
      if (!row || typeof row !== 'object') continue;
      const a = row as Record<string, unknown>;
      if (typeof a.id !== 'string' || typeof a.type !== 'string') continue;
      activity.push({
        id: a.id,
        type: a.type as GuildActivity['type'],
        actorId: typeof a.actorId === 'string' ? a.actorId : null,
        targetId: typeof a.targetId === 'string' ? a.targetId : null,
        message: typeof a.message === 'string' ? a.message : '',
        timestamp: typeof a.timestamp === 'number' ? a.timestamp : Date.now(),
      });
    }
  }

  const benefitsRaw =
    data.benefits && typeof data.benefits === 'object'
      ? (data.benefits as Record<string, unknown>)
      : {};

  return {
    id: data.id,
    name: data.name.trim().slice(0, GUILD_NAME_MAX),
    tag: data.tag.trim().toUpperCase().slice(0, GUILD_TAG_MAX),
    description:
      typeof data.description === 'string'
        ? data.description.trim().slice(0, 280)
        : typeof data.notice === 'string'
          ? data.notice.trim().slice(0, 280)
          : '',
    level: typeof data.level === 'number' && data.level >= 1 ? Math.floor(data.level) : 1,
    xp,
    leaderId,
    members: members.slice(0, maxMembers),
    maxMembers,
    joinMode: data.joinMode === 'approval' ? 'approval' : 'open',
    applications,
    activity: activity.slice(0, GUILD_ACTIVITY_LIMIT),
    benefits: {
      extraMemberSlots:
        typeof benefitsRaw.extraMemberSlots === 'number'
          ? Math.max(0, Math.floor(benefitsRaw.extraMemberSlots))
          : 0,
      guildBossUnlocked: Boolean(benefitsRaw.guildBossUnlocked),
    },
    createdAt:
      typeof data.createdAt === 'number' && Number.isFinite(data.createdAt)
        ? data.createdAt
        : Date.now(),
    legacy: {
      funds: typeof data.funds === 'number' ? data.funds : 0,
      notice: typeof data.notice === 'string' ? data.notice : undefined,
      emblemIcon: typeof data.emblemIcon === 'string' ? data.emblemIcon : GUILD_DEFAULT_EMBLEM,
      emblemBg: typeof data.emblemBg === 'string' ? data.emblemBg : '#7f1d1d',
      bannerStyle: typeof data.bannerStyle === 'string' ? data.bannerStyle : 'shield',
      bossHp: typeof data.bossHp === 'number' ? data.bossHp : undefined,
      bossMaxHp: typeof data.bossMaxHp === 'number' ? data.bossMaxHp : undefined,
      skillLevels:
        data.skillLevels && typeof data.skillLevels === 'object'
          ? (data.skillLevels as Record<string, number>)
          : {},
      shopStock:
        data.shopStock && typeof data.shopStock === 'object'
          ? (data.shopStock as Record<string, number>)
          : {},
      dailyFragmentDay:
        typeof data.dailyFragmentDay === 'string' || data.dailyFragmentDay === null
          ? (data.dailyFragmentDay as string | null)
          : null,
      dailyFragmentCharId:
        typeof data.dailyFragmentCharId === 'string' ? data.dailyFragmentCharId : null,
    },
  };
}

function toSummary(g: Guild): GuildPublicSummary {
  return {
    id: g.id,
    name: g.name,
    tag: g.tag,
    level: g.level,
    memberCount: g.members.length,
    maxMembers: g.maxMembers + g.benefits.extraMemberSlots,
    joinMode: g.joinMode,
    description: g.description,
    emblemIcon: g.legacy?.emblemIcon,
    emblemBg: g.legacy?.emblemBg,
  };
}

function effectiveMax(g: Guild): number {
  return Math.min(GUILD_MEMBER_LIMIT + g.benefits.extraMemberSlots, g.maxMembers + g.benefits.extraMemberSlots);
}

/**
 * Provider local (client-only). Persistência em localStorage — não é backend global.
 * Mocks DEV usam prefixo mock-guild / mock-member.
 */
export class LocalGuildProvider implements GuildProvider {
  readonly id = 'local-mock';
  private memory = new Map<string, Guild>();
  private loaded = false;
  private forceFail = false;
  private bumpListeners = new Set<() => void>();

  setForceFail(fail: boolean): void {
    this.forceFail = fail;
  }

  onChange(listener: () => void): () => void {
    this.bumpListeners.add(listener);
    return () => this.bumpListeners.delete(listener);
  }

  private bump(): void {
    for (const fn of this.bumpListeners) {
      try {
        fn();
      } catch {
        // ignore
      }
    }
  }

  private assertReady(): void {
    if (this.forceFail) throw new Error('Guild provider indisponível');
  }

  private ensureLoaded(): void {
    if (this.loaded) return;
    this.loaded = true;
    if (typeof window === 'undefined') return;
    try {
      let raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        for (const key of LEGACY_KEYS) {
          raw = window.localStorage.getItem(key);
          if (raw) break;
        }
      }
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== 'object') return;
      for (const value of Object.values(parsed as Record<string, unknown>)) {
        const g = normalizeGuild(value);
        if (g) this.memory.set(g.id, g);
      }
    } catch {
      // ignore
    }
  }

  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly PERSIST_DEBOUNCE_MS = 400;

  private writePersist(): void {
    if (typeof window === 'undefined') return;
    try {
      const obj: Record<string, Guild> = {};
      for (const [id, g] of this.memory) obj[id] = g;
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch {
      // ignore
    }
    this.bump();
  }

  private persist(): void {
    if (typeof window === 'undefined') return;
    if (this.persistTimer) return;
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      this.writePersist();
    }, this.PERSIST_DEBOUNCE_MS);
  }

  /** Grava já (dissolve / reset / operações críticas). */
  private persistNow(): void {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    this.writePersist();
  }

  private get(guildId: string): Guild | null {
    this.ensureLoaded();
    return this.memory.get(guildId) ?? null;
  }

  private set(guild: Guild): void {
    this.memory.set(guild.id, guild);
    this.persist();
  }

  private delete(guildId: string): void {
    this.memory.delete(guildId);
    this.persistNow();
  }

  findGuildIdByPlayer(playerId: string): string | null {
    this.ensureLoaded();
    for (const g of this.memory.values()) {
      if (g.members.some((m) => m.playerId === playerId)) return g.id;
    }
    return null;
  }

  listAll(): Guild[] {
    this.ensureLoaded();
    return [...this.memory.values()];
  }

  async createGuild(
    input: CreateGuildInput,
    founder: { playerId: string; nickname: string; playerLevel: number },
  ): Promise<Guild> {
    this.assertReady();
    this.ensureLoaded();
    if (this.findGuildIdByPlayer(founder.playerId)) {
      throw new Error('Você já está em uma Guild.');
    }
    const name = normalizeGuildName(input.name);
    const tag = normalizeGuildTag(input.tag);
    if (!isValidGuildName(name)) throw new Error('Nome inválido.');
    if (!isValidGuildTag(tag)) throw new Error('Tag inválida.');
    for (const g of this.memory.values()) {
      if (g.name.toLowerCase() === name.toLowerCase()) throw new Error('Nome já em uso.');
      if (g.tag === tag) throw new Error('Tag já em uso.');
    }
    const now = Date.now();
    const id = newId('g');
    let guild: Guild = {
      id,
      name,
      tag,
      description: (input.description ?? '').trim().slice(0, 280),
      level: 1,
      xp: 0,
      leaderId: founder.playerId,
      members: [
        {
          playerId: founder.playerId,
          nickname: founder.nickname.trim() || 'Jogador',
          role: 'leader',
          contribution: 0,
          joinedAt: now,
          lastActiveAt: now,
          playerLevel: Math.max(1, founder.playerLevel),
        },
      ],
      maxMembers: GUILD_MEMBER_LIMIT,
      joinMode: input.joinMode === 'approval' ? 'approval' : 'open',
      applications: [],
      activity: [],
      benefits: defaultBenefits(),
      createdAt: now,
      legacy: {
        funds: 0,
        emblemIcon:
          typeof input.emblemIcon === 'string' && input.emblemIcon.startsWith('/')
            ? input.emblemIcon
            : GUILD_DEFAULT_EMBLEM,
        emblemBg:
          typeof input.emblemBg === 'string' && /^#[0-9a-fA-F]{6}$/.test(input.emblemBg)
            ? input.emblemBg
            : '#7f1d1d',
        skillLevels: {},
        shopStock: {},
      },
    };
    guild = pushActivity(guild, {
      type: 'guildCreated',
      actorId: founder.playerId,
      targetId: null,
      message: `${founder.nickname} criou a Guild [${tag}] ${name}.`,
    });
    this.set(guild);
    emitGuildEvent('guildCreated', { guildId: id, playerId: founder.playerId });
    return guild;
  }

  async getGuild(guildId: string): Promise<Guild | null> {
    this.assertReady();
    return this.get(guildId);
  }

  async searchGuilds(query: GuildSearchQuery): Promise<GuildSearchResult> {
    this.assertReady();
    this.ensureLoaded();
    const q = (query.query ?? '').trim().toLowerCase();
    let list = this.listAll();
    if (q) {
      list = list.filter(
        (g) => g.name.toLowerCase().includes(q) || g.tag.toLowerCase().includes(q),
      );
    }
    list.sort((a, b) => b.level - a.level || a.name.localeCompare(b.name, 'pt-BR'));
    const page = Math.max(0, query.page ?? 0);
    const pageSize = Math.min(50, Math.max(1, query.pageSize ?? 20));
    const start = page * pageSize;
    const slice = list.slice(start, start + pageSize);
    return {
      guilds: slice.map(toSummary),
      total: list.length,
      page,
      pageSize,
    };
  }

  async joinGuild(
    guildId: string,
    player: { playerId: string; nickname: string; playerLevel: number },
  ): Promise<{ ok: boolean; pending?: boolean; error?: string }> {
    try {
      this.assertReady();
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Falha' };
    }
    if (this.findGuildIdByPlayer(player.playerId)) {
      return { ok: false, error: 'Você já está em uma Guild.' };
    }
    const guild = this.get(guildId);
    if (!guild) return { ok: false, error: 'Guild não encontrada.' };
    const max = effectiveMax(guild);
    if (guild.members.length >= max) return { ok: false, error: 'Guild cheia.' };

    const nick = player.nickname.trim() || 'Jogador';
    const now = Date.now();

    if (guild.joinMode === 'approval') {
      if (guild.applications.some((a) => a.playerId === player.playerId)) {
        return { ok: true, pending: true };
      }
      let next = {
        ...guild,
        applications: [
          ...guild.applications,
          {
            playerId: player.playerId,
            nickname: nick,
            playerLevel: Math.max(1, player.playerLevel),
            requestedAt: now,
          },
        ],
      };
      next = pushActivity(next, {
        type: 'applicationSubmitted',
        actorId: player.playerId,
        targetId: null,
        message: `${nick} solicitou entrada.`,
      });
      this.set(next);
      return { ok: true, pending: true };
    }

    let next: Guild = {
      ...guild,
      members: [
        ...guild.members,
        {
          playerId: player.playerId,
          nickname: nick,
          role: 'member',
          contribution: 0,
          joinedAt: now,
          lastActiveAt: now,
          playerLevel: Math.max(1, player.playerLevel),
        },
      ],
    };
    next = pushActivity(next, {
      type: 'memberJoined',
      actorId: player.playerId,
      targetId: null,
      message: `${nick} entrou na Guild.`,
    });
    this.set(next);
    emitGuildEvent('guildJoined', { guildId, playerId: player.playerId });
    return { ok: true };
  }

  async leaveGuild(guildId: string, playerId: string): Promise<{ ok: boolean; error?: string }> {
    try {
      this.assertReady();
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Falha' };
    }
    const guild = this.get(guildId);
    if (!guild) return { ok: false, error: 'Guild não encontrada.' };
    const member = guild.members.find((m) => m.playerId === playerId);
    if (!member) return { ok: false, error: 'Você não é membro.' };
    const leave = canLeaveGuild(member, guild.members.length);
    if (!leave.ok) return { ok: false, error: leave.reason };

    const remaining = guild.members.filter((m) => m.playerId !== playerId);
    let next: Guild = {
      ...guild,
      members: remaining,
      applications: guild.applications.filter((a) => a.playerId !== playerId),
    };
    next = pushActivity(next, {
      type: 'memberLeft',
      actorId: playerId,
      targetId: null,
      message: `${member.nickname} saiu da Guild.`,
    });
    this.set(next);
    emitGuildEvent('guildLeft', { guildId, playerId });
    return { ok: true };
  }

  async dissolveGuild(guildId: string, playerId: string): Promise<{ ok: boolean; error?: string }> {
    try {
      this.assertReady();
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Falha' };
    }
    const guild = this.get(guildId);
    if (!guild) return { ok: false, error: 'Guild não encontrada.' };
    const actor = guild.members.find((m) => m.playerId === playerId);
    if (!canDissolveGuild(actor ?? null)) {
      return { ok: false, error: 'Apenas o Líder pode dissolver.' };
    }
    this.delete(guildId);
    emitGuildEvent('guildDissolved', { guildId, playerId });
    // Item 29: invalidar Guild Boss State associado
    try {
      const { getLocalGuildBossProvider } = await import('@/lib/guild-boss-local-provider');
      getLocalGuildBossProvider().invalidateState(guildId);
    } catch {
      // ignore
    }
    return { ok: true };
  }

  async updateMemberRole(
    guildId: string,
    actorId: string,
    targetId: string,
    role: GuildMemberRole,
  ): Promise<{ ok: boolean; error?: string }> {
    try {
      this.assertReady();
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Falha' };
    }
    const guild = this.get(guildId);
    if (!guild) return { ok: false, error: 'Guild não encontrada.' };
    const actor = guild.members.find((m) => m.playerId === actorId) ?? null;
    const target = guild.members.find((m) => m.playerId === targetId) ?? null;
    if (!actor || !target) return { ok: false, error: 'Membro não encontrado.' };
    if (role === 'leader') return { ok: false, error: 'Use transferência de liderança.' };

    if (role === 'officer') {
      if (!canPromoteMember(actor, target, 'officer')) {
        return { ok: false, error: 'Sem permissão para promover.' };
      }
    } else if (role === 'member') {
      if (!canDemoteMember(actor, target)) {
        return { ok: false, error: 'Sem permissão para rebaixar.' };
      }
    } else {
      return { ok: false, error: 'Cargo inválido.' };
    }

    const prev = target.role;
    let next: Guild = {
      ...guild,
      members: guild.members.map((m) => (m.playerId === targetId ? { ...m, role } : m)),
    };
    next = pushActivity(next, {
      type: role === 'officer' ? 'memberPromoted' : 'memberDemoted',
      actorId,
      targetId,
      message:
        role === 'officer'
          ? `${actor.nickname} promoveu ${target.nickname} a Oficial.`
          : `${actor.nickname} rebaixou ${target.nickname} a Membro.`,
    });
    this.set(next);
    if (role === 'officer' && prev !== 'officer') {
      emitGuildEvent('guildMemberPromoted', { guildId, targetId });
    }
    return { ok: true };
  }

  async transferLeadership(
    guildId: string,
    actorId: string,
    newLeaderId: string,
  ): Promise<{ ok: boolean; error?: string }> {
    try {
      this.assertReady();
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Falha' };
    }
    const guild = this.get(guildId);
    if (!guild) return { ok: false, error: 'Guild não encontrada.' };
    const actor = guild.members.find((m) => m.playerId === actorId) ?? null;
    const target = guild.members.find((m) => m.playerId === newLeaderId) ?? null;
    if (!canTransferLeadership(actor, target)) {
      return { ok: false, error: 'Transferência inválida.' };
    }
    let next: Guild = {
      ...guild,
      leaderId: newLeaderId,
      members: guild.members.map((m) => {
        if (m.playerId === newLeaderId) return { ...m, role: 'leader' as const };
        if (m.playerId === actorId) return { ...m, role: 'officer' as const };
        if (m.role === 'leader') return { ...m, role: 'member' as const };
        return m;
      }),
    };
    // Enforce single leader
    const leaders = next.members.filter((m) => m.role === 'leader');
    if (leaders.length !== 1) {
      next = {
        ...next,
        members: next.members.map((m) =>
          m.playerId === newLeaderId ? { ...m, role: 'leader' } : { ...m, role: m.role === 'leader' ? 'officer' : m.role },
        ),
      };
    }
    next = pushActivity(next, {
      type: 'leadershipTransferred',
      actorId,
      targetId: newLeaderId,
      message: `${actor!.nickname} transferiu a liderança para ${target!.nickname}.`,
    });
    this.set(next);
    return { ok: true };
  }

  async kickMember(
    guildId: string,
    actorId: string,
    targetId: string,
  ): Promise<{ ok: boolean; error?: string }> {
    try {
      this.assertReady();
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Falha' };
    }
    const guild = this.get(guildId);
    if (!guild) return { ok: false, error: 'Guild não encontrada.' };
    const actor = guild.members.find((m) => m.playerId === actorId) ?? null;
    const target = guild.members.find((m) => m.playerId === targetId) ?? null;
    if (!canKickMember(actor, target)) return { ok: false, error: 'Sem permissão para expulsar.' };
    let next: Guild = {
      ...guild,
      members: guild.members.filter((m) => m.playerId !== targetId),
    };
    next = pushActivity(next, {
      type: 'memberKicked',
      actorId,
      targetId,
      message: `${actor!.nickname} expulsou ${target!.nickname}.`,
    });
    this.set(next);
    emitGuildEvent('guildLeft', { guildId, playerId: targetId, kicked: true });
    return { ok: true };
  }

  async editGuild(
    guildId: string,
    actorId: string,
    patch: import('@/types/guild').EditGuildPatch,
  ): Promise<{ ok: boolean; error?: string }> {
    try {
      this.assertReady();
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Falha' };
    }
    const guild = this.get(guildId);
    if (!guild) return { ok: false, error: 'Guild não encontrada.' };
    const actor = guild.members.find((m) => m.playerId === actorId);
    if (!canGuildMemberPerform(actor ?? null, 'editGuild')) {
      return { ok: false, error: 'Sem permissão para editar.' };
    }
    let name = guild.name;
    if (typeof patch.name === 'string') {
      name = normalizeGuildName(patch.name);
      if (!isValidGuildName(name)) return { ok: false, error: 'Nome inválido.' };
      for (const g of this.memory.values()) {
        if (g.id !== guildId && g.name.toLowerCase() === name.toLowerCase()) {
          return { ok: false, error: 'Nome já em uso.' };
        }
      }
    }
    const nextLegacy = { ...(guild.legacy ?? {}) };
    if (typeof patch.emblemIcon === 'string' && patch.emblemIcon.startsWith('/')) {
      nextLegacy.emblemIcon = patch.emblemIcon;
    }
    if (typeof patch.emblemBg === 'string' && /^#[0-9a-fA-F]{6}$/.test(patch.emblemBg)) {
      nextLegacy.emblemBg = patch.emblemBg;
    }
    let next: Guild = {
      ...guild,
      name,
      description:
        typeof patch.description === 'string'
          ? patch.description.trim().slice(0, 280)
          : guild.description,
      joinMode: patch.joinMode === 'approval' || patch.joinMode === 'open' ? patch.joinMode : guild.joinMode,
      legacy: nextLegacy,
    };
    next = pushActivity(next, {
      type: 'guildEdited',
      actorId,
      targetId: null,
      message: `${actor!.nickname} atualizou a Guild.`,
    });
    this.set(next);
    return { ok: true };
  }

  async getApplications(guildId: string): Promise<GuildApplication[]> {
    this.assertReady();
    return this.get(guildId)?.applications ?? [];
  }

  async approveApplication(
    guildId: string,
    actorId: string,
    applicantId: string,
  ): Promise<{ ok: boolean; error?: string }> {
    try {
      this.assertReady();
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Falha' };
    }
    const guild = this.get(guildId);
    if (!guild) return { ok: false, error: 'Guild não encontrada.' };
    const actor = guild.members.find((m) => m.playerId === actorId);
    if (!canGuildMemberPerform(actor ?? null, 'approveMember')) {
      return { ok: false, error: 'Sem permissão.' };
    }
    const app = guild.applications.find((a) => a.playerId === applicantId);
    if (!app) return { ok: false, error: 'Solicitação não encontrada.' };
    if (this.findGuildIdByPlayer(applicantId)) {
      const cleaned = {
        ...guild,
        applications: guild.applications.filter((a) => a.playerId !== applicantId),
      };
      this.set(cleaned);
      return { ok: false, error: 'Jogador já está em outra Guild.' };
    }
    if (guild.members.length >= effectiveMax(guild)) {
      return { ok: false, error: 'Guild cheia.' };
    }
    const now = Date.now();
    let next: Guild = {
      ...guild,
      applications: guild.applications.filter((a) => a.playerId !== applicantId),
      members: [
        ...guild.members,
        {
          playerId: app.playerId,
          nickname: app.nickname,
          role: 'member',
          contribution: 0,
          joinedAt: now,
          lastActiveAt: now,
          playerLevel: app.playerLevel,
        },
      ],
    };
    next = pushActivity(next, {
      type: 'applicationApproved',
      actorId,
      targetId: applicantId,
      message: `${actor!.nickname} aprovou ${app.nickname}.`,
    });
    this.set(next);
    emitGuildEvent('guildJoined', { guildId, playerId: applicantId });
    return { ok: true };
  }

  async rejectApplication(
    guildId: string,
    actorId: string,
    applicantId: string,
  ): Promise<{ ok: boolean; error?: string }> {
    try {
      this.assertReady();
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Falha' };
    }
    const guild = this.get(guildId);
    if (!guild) return { ok: false, error: 'Guild não encontrada.' };
    const actor = guild.members.find((m) => m.playerId === actorId);
    if (!canGuildMemberPerform(actor ?? null, 'approveMember')) {
      return { ok: false, error: 'Sem permissão.' };
    }
    let next: Guild = {
      ...guild,
      applications: guild.applications.filter((a) => a.playerId !== applicantId),
    };
    next = pushActivity(next, {
      type: 'applicationRejected',
      actorId,
      targetId: applicantId,
      message: `${actor!.nickname} rejeitou uma solicitação.`,
    });
    this.set(next);
    return { ok: true };
  }

  async grantOnlineKillProgress(
    guildId: string,
    playerId: string,
    opts?: { source?: 'online' | 'offline' | 'dev' },
  ): Promise<{ guildXp: number; contribution: number }> {
    const source = opts?.source ?? 'online';
    if (source === 'offline' || source === 'dev') {
      return { guildXp: 0, contribution: 0 };
    }
    try {
      this.assertReady();
    } catch {
      return { guildXp: 0, contribution: 0 };
    }
    const guild = this.get(guildId);
    if (!guild) return { guildXp: 0, contribution: 0 };
    const member = guild.members.find((m) => m.playerId === playerId);
    if (!member) return { guildXp: 0, contribution: 0 };

    const guildXp = GUILD_XP_PER_ONLINE_KILL;
    const contribution = GUILD_CONTRIBUTION_PER_ONLINE_KILL;
    const applied = applyGuildXp(guild, guildXp);
    let next: Guild = {
      ...applied.guild,
      members: applied.guild.members.map((m) =>
        m.playerId === playerId
          ? {
              ...m,
              contribution: m.contribution + contribution,
              lastActiveAt: Date.now(),
            }
          : m,
      ),
    };
    if (applied.levelsGained > 0) {
      next = pushActivity(next, {
        type: 'guildLevelUp',
        actorId: null,
        targetId: null,
        message: `Guild alcançou o Level ${next.level}.`,
      });
      emitGuildEvent('guildLevelUp', { guildId, level: next.level });
    }
    this.set(next);
    return { guildXp, contribution };
  }

  async addGuildXp(guildId: string, amount: number): Promise<Guild | null> {
    this.assertReady();
    const guild = this.get(guildId);
    if (!guild) return null;
    const applied = applyGuildXp(guild, amount);
    let next = applied.guild;
    if (applied.levelsGained > 0) {
      next = pushActivity(next, {
        type: 'guildLevelUp',
        actorId: null,
        targetId: null,
        message: `Guild alcançou o Level ${next.level}.`,
      });
      emitGuildEvent('guildLevelUp', { guildId, level: next.level });
    }
    this.set(next);
    return next;
  }

  /** Contribution do Guild Boss (não 1:1 com damage). */
  async addMemberContribution(guildId: string, playerId: string, amount: number): Promise<void> {
    this.assertReady();
    const guild = this.get(guildId);
    if (!guild || !(amount > 0)) return;
    const next: Guild = {
      ...guild,
      members: guild.members.map((m) =>
        m.playerId === playerId
          ? { ...m, contribution: m.contribution + Math.floor(amount), lastActiveAt: Date.now() }
          : m,
      ),
    };
    this.set(next);
  }

  async resetAll(): Promise<void> {
    this.memory.clear();
    this.loaded = true;
    this.persistNow();
  }

  async seedMockGuild(opts?: { memberCount?: number }): Promise<Guild> {
    this.assertReady();
    this.ensureLoaded();
    const count = Math.max(2, Math.min(GUILD_MEMBER_LIMIT, opts?.memberCount ?? 8));
    const leaderId = 'mock-leader';
    const now = Date.now();
    const members: GuildMember[] = [
      {
        playerId: leaderId,
        nickname: 'MockLeader',
        role: 'leader',
        contribution: 500,
        joinedAt: now - 86_400_000,
        lastActiveAt: now,
        playerLevel: 40,
      },
    ];
    for (let i = 1; i < count; i += 1) {
      members.push({
        playerId: `mock-member-${i}`,
        nickname: `MockMember${i}`,
        role: i === 1 ? 'officer' : 'member',
        contribution: Math.floor(Math.random() * 400),
        joinedAt: now - i * 3_600_000,
        lastActiveAt: now - i * 60_000,
        playerLevel: 10 + (i % 40),
      });
    }
    const id = newId('mock-guild');
    const guild: Guild = {
      id,
      name: `Mock Guild ${id.slice(-4)}`,
      tag: `M${String(this.memory.size % 100).padStart(2, '0')}`,
      description: 'Guild mock DEV — não é produção.',
      level: 3,
      xp: 500,
      leaderId,
      members,
      maxMembers: GUILD_MEMBER_LIMIT,
      joinMode: 'open',
      applications: [],
      activity: [],
      benefits: defaultBenefits(),
      createdAt: now,
    };
    this.set(guild);
    return guild;
  }
}

let singleton: LocalGuildProvider | null = null;

export function getLocalGuildProvider(): LocalGuildProvider {
  if (!singleton) singleton = new LocalGuildProvider();
  return singleton;
}

export function resetLocalGuildProvider(): void {
  singleton = new LocalGuildProvider();
}

export function getGuildProvider(): GuildProvider {
  return getLocalGuildProvider();
}
