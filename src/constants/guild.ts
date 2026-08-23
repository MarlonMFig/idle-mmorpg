/** Regras e configs do sistema de Guild (Item 28). */

/** Alias canônico do limite de membros. */
export const GUILD_MEMBER_LIMIT = 30;

/** @deprecated Prefer GUILD_MEMBER_LIMIT. */
export const GUILD_MAX_MEMBERS = GUILD_MEMBER_LIMIT;

/** Nível mínimo de conta para criar/entrar (sem VIP). */
export const GUILD_CREATE_MIN_LEVEL = 20;

export const GUILD_NAME_MIN = 3;
export const GUILD_NAME_MAX = 24;
export const GUILD_TAG_MIN = 2;
export const GUILD_TAG_MAX = 4;
export const GUILD_DESCRIPTION_MAX = 280;

/** Custo de criação — configurável; 0 neste item (sem cobrança). */
export const GUILD_CREATE_COST = {
  copper: 0,
  animeCoins: 0,
} as const;

/** Guild XP por kill Online oficial (não usa Player XP). */
export const GUILD_XP_PER_ONLINE_KILL = 1;

/** Contribution pessoal por kill Online oficial. */
export const GUILD_CONTRIBUTION_PER_ONLINE_KILL = 1;

/** Histórico: últimos N eventos. */
export const GUILD_ACTIVITY_LIMIT = 80;

/** Top contribuidores na aba Progresso. */
export const GUILD_TOP_CONTRIBUTORS = 5;

/**
 * Curva própria de Guild Level (não usa Player XP).
 * Simples e configurável — não é balanceamento final.
 * Lv.n → n * 2000 XP (mín. 2000).
 */
export function guildXpForLevel(level: number): number {
  const lv = Math.max(1, Math.floor(level));
  return Math.max(2_000, lv * 2_000);
}

/** @deprecated Prefer guildXpForLevel. */
export function guildExpForLevel(level: number): number {
  return guildXpForLevel(level);
}

/** Legado UI (ainda referenciado por assets). */
export const GUILD_CHECKIN_COINS = 100;
export const GUILD_CHECKIN_EXP = 500;
export const GUILD_DONATE_MIN = 100;
export const GUILD_BOSS_MAX_HP = 100_000_000;

/** IDs reais em `public/ui/guild-banners/` (alguns números ausentes no pack). */
const GUILD_BANNER_IDS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 18, 19, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30,
  31, 32, 33, 34, 35, 36, 38, 39, 40,
] as const;

const GUILD_BANNER_LABELS: Record<number, string> = {
  1: 'Folha de Konoha',
  2: 'Clã Uchiha',
  3: 'Nuvem Vermelha',
  4: 'Tropa de Exploração',
  5: 'Piratas do Chapéu de Palha',
};

export const GUILD_EMBLEMS = GUILD_BANNER_IDS.map((id) => ({
  id,
  icon: `/ui/guild-banners/banner-${String(id).padStart(2, '0')}.png`,
  label: GUILD_BANNER_LABELS[id] ?? `Banner ${String(id).padStart(2, '0')}`,
}));

/** Estandarte padrão quando o salvo não existe mais. */
export const GUILD_DEFAULT_EMBLEM = GUILD_EMBLEMS[0]?.icon ?? '/ui/guild-banners/banner-01.png';

export function isGuildEmblemIcon(value: string | null | undefined): boolean {
  if (!value) return false;
  return GUILD_EMBLEMS.some((entry) => entry.icon === value);
}

/** Cores rápidas; o seletor livre permite qualquer cor hexadecimal. */
export const GUILD_COLORS = [
  '#991b1b',
  '#c2410c',
  '#ca8a04',
  '#15803d',
  '#0f766e',
  '#0369a1',
  '#1d4ed8',
  '#4338ca',
  '#7e22ce',
  '#be185d',
  '#334155',
  '#171717',
] as const;
