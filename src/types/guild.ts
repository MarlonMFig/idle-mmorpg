export type GuildMemberRole = 'leader' | 'vice' | 'officer' | 'member';

export interface GuildMember {
  playerId: string;
  nickname: string;
  role: GuildMemberRole;
  joinedAt: number;
  coinsDonated: number;
  expContributed: number;
}

export interface Guild {
  id: string;
  name: string;
  tag: string;
  leaderId: string;
  members: GuildMember[];
  maxMembers: number;
  createdAt: number;
  level: number;
  exp: number;
  funds: number;
  notice: string;
  emblemIcon: string;
  emblemBg: string;
  bossHp: number;
  bossMaxHp: number;
  skillLevels: Record<string, number>;
  shopStock: Record<string, number>;
}

export type GuildTabId =
  | 'members'
  | 'ranking'
  | 'missions'
  | 'boss'
  | 'skills'
  | 'shop'
  | 'manage';

export const GUILD_ROLE_LABEL: Record<GuildMemberRole, string> = {
  leader: 'Líder',
  vice: 'Vice-Líder',
  officer: 'Oficial',
  member: 'Membro',
};

export function isLeadershipRole(role: GuildMemberRole): boolean {
  return role === 'leader' || role === 'vice';
}
