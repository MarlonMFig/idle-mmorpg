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

/** Emblemas em `public/ui/guild-banners/` (pack pixel-art). */
export const GUILD_EMBLEMS = [
  { id: "folha-rubra", label: "Folha Rubra", icon: "/ui/guild-banners/folha-rubra.png" },
  { id: "raposa-carmesim", label: "Raposa Carmesim", icon: "/ui/guild-banners/raposa-carmesim.png" },
  { id: "corvo-da-lua", label: "Corvo da Lua", icon: "/ui/guild-banners/corvo-da-lua.png" },
  { id: "lobo-do-trovao", label: "Lobo do Trovão", icon: "/ui/guild-banners/lobo-do-trovao.png" },
  { id: "serpente-esmeralda", label: "Serpente Esmeralda", icon: "/ui/guild-banners/serpente-esmeralda.png" },
  { id: "sapo-sabio", label: "Sapo Sábio", icon: "/ui/guild-banners/sapo-sabio.png" },
  { id: "dragao-celeste", label: "Dragão Celeste", icon: "/ui/guild-banners/dragao-celeste.png" },
  { id: "fenix-dourada", label: "Fênix Dourada", icon: "/ui/guild-banners/fenix-dourada.png" },
  { id: "tigre-branco", label: "Tigre Branco", icon: "/ui/guild-banners/tigre-branco.png" },
  { id: "tartaruga-de-ferro", label: "Tartaruga de Ferro", icon: "/ui/guild-banners/tartaruga-de-ferro.png" },
  { id: "aranha-dourada", label: "Aranha Dourada", icon: "/ui/guild-banners/aranha-dourada.png" },
  { id: "tubarao-da-nevoa", label: "Tubarão da Névoa", icon: "/ui/guild-banners/tubarao-da-nevoa.png" },
  { id: "sol-carmesim", label: "Sol Carmesim", icon: "/ui/guild-banners/sol-carmesim.png" },
  { id: "lua-violeta", label: "Lua Violeta", icon: "/ui/guild-banners/lua-violeta.png" },
  { id: "eclipse-negro", label: "Eclipse Negro", icon: "/ui/guild-banners/eclipse-negro.png" },
  { id: "estrela-do-norte", label: "Estrela do Norte", icon: "/ui/guild-banners/estrela-do-norte.png" },
  { id: "tempestade-azul", label: "Tempestade Azul", icon: "/ui/guild-banners/tempestade-azul.png" },
  { id: "chama-eterna", label: "Chama Eterna", icon: "/ui/guild-banners/chama-eterna.png" },
  { id: "laminas-cruzadas", label: "Lâminas Cruzadas", icon: "/ui/guild-banners/laminas-cruzadas.png" },
  { id: "katana-fantasma", label: "Katana Fantasma", icon: "/ui/guild-banners/katana-fantasma.png" },
  { id: "shuriken-imperial", label: "Shuriken Imperial", icon: "/ui/guild-banners/shuriken-imperial.png" },
  { id: "arco-da-cacada", label: "Arco da Caçada", icon: "/ui/guild-banners/arco-da-cacada.png" },
  { id: "punho-de-ferro", label: "Punho de Ferro", icon: "/ui/guild-banners/punho-de-ferro.png" },
  { id: "escudo-shinobi", label: "Escudo Shinobi", icon: "/ui/guild-banners/escudo-shinobi.png" },
  { id: "olho-carmesim", label: "Olho Carmesim", icon: "/ui/guild-banners/olho-carmesim.png" },
  { id: "mascara-oni", label: "Máscara Oni", icon: "/ui/guild-banners/mascara-oni.png" },
  { id: "selo-proibido", label: "Selo Proibido", icon: "/ui/guild-banners/selo-proibido.png" },
  { id: "pergaminho-ancestral", label: "Pergaminho Ancestral", icon: "/ui/guild-banners/pergaminho-ancestral.png" },
  { id: "ampulheta-de-areia", label: "Ampulheta de Areia", icon: "/ui/guild-banners/ampulheta-de-areia.png" },
  { id: "cristal-de-gelo", label: "Cristal de Gelo", icon: "/ui/guild-banners/cristal-de-gelo.png" },
  { id: "montanha-de-pedra", label: "Montanha de Pedra", icon: "/ui/guild-banners/montanha-de-pedra.png" },
  { id: "onda-profunda", label: "Onda Profunda", icon: "/ui/guild-banners/onda-profunda.png" },
  { id: "arvore-ancestral", label: "Árvore Ancestral", icon: "/ui/guild-banners/arvore-ancestral.png" },
  { id: "flor-de-lotus", label: "Flor de Lótus", icon: "/ui/guild-banners/flor-de-lotus.png" },
  { id: "borboleta-de-chakra", label: "Borboleta de Chakra", icon: "/ui/guild-banners/borboleta-de-chakra.png" },
  { id: "equilibrio-ninja", label: "Equilíbrio Ninja", icon: "/ui/guild-banners/equilibrio-ninja.png" },
] as const;

export type GuildEmblemId = (typeof GUILD_EMBLEMS)[number]["id"];

/** Estandarte padrão quando o salvo não existe mais. */
export const GUILD_DEFAULT_EMBLEM = GUILD_EMBLEMS[0]?.icon ?? "/ui/guild-banners/folha-rubra.png";

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
