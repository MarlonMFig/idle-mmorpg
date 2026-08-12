/**
 * Types for Anime World Idle Guild System
 */

export type GuildRole = 'LÍDER' | 'VICE-LÍDER' | 'OFICIAL' | 'MEMBRO';

export type MemberStatus = 'ONLINE' | 'OFFLINE';

export type Village = 'Folha' | 'Névoa' | 'Areia' | 'Nuvem' | 'Pedra' | 'Sombras';

export interface GuildMember {
  id: string;
  name: string;
  characterName: string;
  level: number;
  role: GuildRole;
  status: MemberStatus;
  lastOnline: string;
  power: number;
  expContributed: number;
  coinsDonated: number;
  weeklyExp: number;
  village: Village;
  avatarUrl: string;
  joinedAt: string;
  checkedInToday: boolean;
}

export interface GuildInfo {
  id: string;
  name: string;
  tag: string;
  level: number;
  exp: number;
  maxExp: number;
  leaderName: string;
  memberCount: number;
  maxMembers: number;
  totalPower: number;
  serverRank: number;
  emblemIcon: string;
  emblemBg: string;
  notice: string;
  funds: number;
  guildCoins: number;
  requiredLevelToJoin: number;
  isOpenJoin: boolean;
  creationDate: string;
  dailyCheckInCount: number;
}

export interface GuildRankEntry {
  rank: number;
  id: string;
  guildName: string;
  tag: string;
  level: number;
  emblemIcon: string;
  emblemBg: string;
  leaderName: string;
  memberCount: number;
  maxMembers: number;
  totalPower: number;
  description: string;
  isUserGuild?: boolean;
}

export type MissionCategory = 'DIÁRIA' | 'COMBATE' | 'GUILDA' | 'TREINO';

export interface GuildMission {
  id: string;
  title: string;
  description: string;
  icon: string;
  currentProgress: number;
  targetProgress: number;
  rewardCoins: number;
  rewardExp: number;
  isCompleted: boolean;
  isClaimed: boolean;
  category: MissionCategory;
}

export interface BossDamager {
  id: string;
  memberName: string;
  characterName: string;
  role: GuildRole;
  damage: number;
  percentage: number;
  attacksCount: number;
}

export interface GuildBoss {
  id: string;
  name: string;
  title: string;
  avatarUrl: string;
  currentHp: number;
  maxHp: number;
  level: number;
  element: string;
  timeRemainingSeconds: number;
  status: 'DISPONÍVEL' | 'DERROTADO' | 'EM_BREVE';
  rewards: {
    exp: number;
    coins: number;
    items: string[];
  };
  topDamagers: BossDamager[];
}

export interface GuildSkill {
  id: string;
  name: string;
  description: string;
  level: number;
  maxLevel: number;
  icon: string;
  effectText: string;
  upgradeCostFunds: number;
  upgradeCostCoins: number;
  isMaxed?: boolean;
}

export interface GuildShopItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  priceCoins: number;
  category: 'Ninja' | 'Consumíveis' | 'Selamento' | 'Exclusivo';
  stock: number;
  maxStock: number;
  reqGuildLevel: number;
}

export interface JoinRequest {
  id: string;
  playerName: string;
  characterName: string;
  level: number;
  power: number;
  village: Village;
  avatarUrl: string;
  requestedAt: string;
}
