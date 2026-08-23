/**
 * Guild System (Item 28).
 * Guild ≠ Linhagem. Sem Guild Boss / War / Ranking / Shop / Coin / bônus de combate neste item.
 */

export const GUILD_ROLES = ['leader', 'officer', 'member'] as const;
export type GuildMemberRole = (typeof GUILD_ROLES)[number];

export type GuildJoinMode = 'open' | 'approval';

export type GuildAction =
  | 'editGuild'
  | 'inviteMember'
  | 'approveMember'
  | 'kickMember'
  | 'promoteMember'
  | 'demoteMember'
  | 'transferLeadership'
  | 'dissolveGuild'
  | 'leaveGuild'
  | 'viewApplications';

export type GuildActivityType =
  | 'memberJoined'
  | 'memberLeft'
  | 'memberKicked'
  | 'memberPromoted'
  | 'memberDemoted'
  | 'leadershipTransferred'
  | 'guildCreated'
  | 'guildDissolved'
  | 'guildLevelUp'
  | 'applicationSubmitted'
  | 'applicationApproved'
  | 'applicationRejected'
  | 'guildEdited';

export interface GuildMember {
  playerId: string;
  nickname: string;
  role: GuildMemberRole;
  /** Contribuição all-time (estatística, não moeda). */
  contribution: number;
  joinedAt: number;
  lastActiveAt: number;
  /** Level da conta no último snapshot (UI). */
  playerLevel: number;
}

export interface GuildApplication {
  playerId: string;
  nickname: string;
  playerLevel: number;
  requestedAt: number;
}

export interface GuildActivity {
  id: string;
  type: GuildActivityType;
  actorId: string | null;
  targetId: string | null;
  message: string;
  timestamp: number;
}

/** Benefícios estruturais futuros — sem modifiers de combate neste item. */
export interface GuildBenefits {
  /** Reserva para vagas / boss / shop futuros. */
  extraMemberSlots: number;
  guildBossUnlocked: boolean;
}

export interface Guild {
  id: string;
  name: string;
  tag: string;
  description: string;
  level: number;
  xp: number;
  leaderId: string;
  members: GuildMember[];
  maxMembers: number;
  joinMode: GuildJoinMode;
  applications: GuildApplication[];
  activity: GuildActivity[];
  benefits: GuildBenefits;
  createdAt: number;
  /** Campos legados (persistência) — não usados pela UI Item 28. */
  legacy?: GuildLegacyFields;
}

export interface GuildLegacyFields {
  funds?: number;
  notice?: string;
  emblemIcon?: string;
  emblemBg?: string;
  bannerStyle?: string;
  bossHp?: number;
  bossMaxHp?: number;
  skillLevels?: Record<string, number>;
  shopStock?: Record<string, number>;
  dailyFragmentDay?: string | null;
  dailyFragmentCharId?: string | null;
}

export const GUILD_ROLE_LABEL: Record<GuildMemberRole, string> = {
  leader: 'Líder',
  officer: 'Oficial',
  member: 'Membro',
};

export const GUILD_ROLE_ORDER: Record<GuildMemberRole, number> = {
  leader: 0,
  officer: 1,
  member: 2,
};

export type GuildUiTabId = 'overview' | 'members' | 'progress' | 'applications' | 'boss' | 'shop';

export interface GuildSearchQuery {
  query?: string;
  page?: number;
  pageSize?: number;
}

export interface GuildSearchResult {
  guilds: GuildPublicSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export interface GuildPublicSummary {
  id: string;
  name: string;
  tag: string;
  level: number;
  memberCount: number;
  maxMembers: number;
  joinMode: GuildJoinMode;
  description: string;
  emblemIcon?: string;
  emblemBg?: string;
}

export interface CreateGuildInput {
  name: string;
  tag: string;
  description?: string;
  joinMode?: GuildJoinMode;
  emblemIcon?: string;
  emblemBg?: string;
}

export type EditGuildPatch = Partial<
  Pick<Guild, 'name' | 'description' | 'joinMode'> & {
    emblemIcon: string;
    emblemBg: string;
  }
>;

export interface GuildProvider {
  readonly id: string;
  createGuild(input: CreateGuildInput, founder: { playerId: string; nickname: string; playerLevel: number }): Promise<Guild>;
  getGuild(guildId: string): Promise<Guild | null>;
  searchGuilds(query: GuildSearchQuery): Promise<GuildSearchResult>;
  joinGuild(guildId: string, player: { playerId: string; nickname: string; playerLevel: number }): Promise<{ ok: boolean; pending?: boolean; error?: string }>;
  leaveGuild(guildId: string, playerId: string): Promise<{ ok: boolean; error?: string }>;
  dissolveGuild(guildId: string, playerId: string): Promise<{ ok: boolean; error?: string }>;
  updateMemberRole(
    guildId: string,
    actorId: string,
    targetId: string,
    role: GuildMemberRole,
  ): Promise<{ ok: boolean; error?: string }>;
  transferLeadership(
    guildId: string,
    actorId: string,
    newLeaderId: string,
  ): Promise<{ ok: boolean; error?: string }>;
  kickMember(guildId: string, actorId: string, targetId: string): Promise<{ ok: boolean; error?: string }>;
  editGuild(
    guildId: string,
    actorId: string,
    patch: EditGuildPatch,
  ): Promise<{ ok: boolean; error?: string }>;
  getApplications(guildId: string): Promise<GuildApplication[]>;
  approveApplication(guildId: string, actorId: string, applicantId: string): Promise<{ ok: boolean; error?: string }>;
  rejectApplication(guildId: string, actorId: string, applicantId: string): Promise<{ ok: boolean; error?: string }>;
  grantOnlineKillProgress(
    guildId: string,
    playerId: string,
    opts?: { source?: 'online' | 'offline' | 'dev' },
  ): Promise<{ guildXp: number; contribution: number }>;
  addGuildXp(guildId: string, amount: number): Promise<Guild | null>;
  /** Resolve guild do player (local sync / backend mine). */
  findGuildIdByPlayer?(playerId: string): string | null | Promise<string | null>;
  /** DEV */
  setForceFail?(fail: boolean): void;
  resetAll?(): Promise<void>;
  seedMockGuild?(opts?: { memberCount?: number }): Promise<Guild>;
  onChange?(listener: () => void): () => void;
}
