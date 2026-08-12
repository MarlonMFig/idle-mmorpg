/** Regras de criação e capacidade de Guild. */

/** Nível de conta mínimo para criar/entrar em guild. */
export const GUILD_CREATE_MIN_LEVEL = 20;

/** Membros máximos por guild. */
export const GUILD_MAX_MEMBERS = 30;

export const GUILD_NAME_MIN = 3;
export const GUILD_NAME_MAX = 24;

export const GUILD_TAG_MIN = 2;
export const GUILD_TAG_MAX = 4;

/** Presença diária. */
export const GUILD_CHECKIN_COINS = 100;
export const GUILD_CHECKIN_EXP = 500;

/** Doação: cobre → fundos; EXP da guild = 2× valor; moedas pessoais = 10%. */
export const GUILD_DONATE_MIN = 100;

/** EXP necessária para o próximo nível da guild. */
export function guildExpForLevel(level: number): number {
  return Math.max(5_000, Math.floor(level * 5_000));
}

export const GUILD_EMBLEMS = [
  { icon: '🚩', bg: '#7f1d1d' },
  { icon: '👁️', bg: '#7f1d1d' },
  { icon: '⚔️', bg: '#1e3a5f' },
  { icon: '🛡️', bg: '#14532d' },
  { icon: '🔥', bg: '#9a3412' },
  { icon: '🌙', bg: '#312e81' },
] as const;

export const GUILD_BOSS_MAX_HP = 100_000_000;
