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

/** Estandartes ilustrados disponíveis na criação da guilda. */
export const GUILD_EMBLEMS = (
  [
    [1, 'Folha de Konoha'],
    [2, 'Clã Uchiha'],
    [3, 'Nuvem Vermelha'],
    [4, 'Tropa de Exploração'],
    [5, 'Piratas do Chapéu de Palha'],
    [6, 'Fairy Tail'],
    [7, 'Máscara Hollow'],
    [8, 'Chama Sombria'],
    [9, 'Serpente Celeste'],
    [10, 'Marca Amaldiçoada'],
    [11, 'Crânio Branco'],
    [12, 'Leão Dourado'],
    [14, 'Sharingan'],
    [15, 'Touro Negro'],
    [16, 'Asas Celestes'],
    [18, 'Kame'],
    [19, 'Oni Violeta'],
    [21, 'Estrela Sombria'],
    [22, 'Lâminas Cruzadas'],
    [23, 'Lua de Sangue'],
    [24, 'Cruz Dourada'],
    [25, 'Chama Azul'],
    [26, 'Estrela de Batalha'],
    [27, 'Guerreiro Saiyajin'],
    [28, 'Crânio Carmesim'],
    [29, 'Olho Triplo'],
    [30, 'Fênix Dourada'],
    [31, 'Cavaleiro Alado'],
    [32, 'Escorpião Dourado'],
    [33, 'Máscara Demoníaca'],
    [34, 'Grifo Dourado'],
    [35, 'Machados Rubros'],
    [36, 'Lanças Verdes'],
    [38, 'Pirata da Caveira'],
    [39, 'Lua Violeta'],
    [40, 'Selo Sábio'],
  ] as [number, string][]
).map(([id, label]) => ({
  icon: `/ui/guild-banners/banner-${String(id).padStart(2, '0')}.png`,
  label,
}));

/** Estandarte padrão quando o salvo não existe mais. */
export const GUILD_DEFAULT_EMBLEM = GUILD_EMBLEMS[0].icon;

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

export const GUILD_BOSS_MAX_HP = 100_000_000;
