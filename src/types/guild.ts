export type GuildMemberRole = 'leader' | 'vice' | 'officer' | 'member';
export type GuildBannerStyle =
  | 'shield'
  | 'standard'
  | 'pennant'
  | 'swallowtail'
  | 'round'
  | 'diamond';

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
  bannerStyle: GuildBannerStyle;
  bossHp: number;
  bossMaxHp: number;
  skillLevels: Record<string, number>;
  shopStock: Record<string, number>;
  /** Fragmento rotativo diário (spec AIW). */
  dailyFragmentDay: string | null;
  dailyFragmentCharId: string | null;
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
