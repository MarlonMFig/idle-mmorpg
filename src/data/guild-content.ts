/**
 * Catálogo estático de missões, habilidades e loja da guild
 * (progresso/estado ficam no registry + player state).
 */

export interface GuildSkillDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  effectText: string;
  maxLevel: number;
  baseFunds: number;
  baseCoins: number;
}

export interface GuildShopDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  priceCoins: number;
  category: string;
  maxStock: number;
  reqGuildLevel: number;
  /** Quantidade de cobre concedida como “bem simbólico” (v1). */
  copperReward: number;
}

export interface GuildMissionDef {
  id: string;
  title: string;
  description: string;
  icon: string;
  target: number;
  rewardCoins: number;
  rewardExp: number;
  category: 'DIÁRIA' | 'COMBATE' | 'GUILDA' | 'TREINO';
}

export const GUILD_SKILL_DEFS: readonly GuildSkillDef[] = [
  {
    id: 'sk-atk',
    name: 'Bônus de Ataque Ninja',
    description: 'Aumenta o potencial de combate da equipe nas caças.',
    icon: '⚔️',
    effectText: '+2% ataque por nível',
    maxLevel: 10,
    baseFunds: 5_000,
    baseCoins: 50,
  },
  {
    id: 'sk-exp',
    name: 'Sabedoria do Clã',
    description: 'Mais EXP ao derrotar inimigos (preparado para bônus futuro).',
    icon: '📜',
    effectText: '+1% EXP por nível',
    maxLevel: 10,
    baseFunds: 4_500,
    baseCoins: 45,
  },
  {
    id: 'sk-gold',
    name: 'Prosperidade Ninja',
    description: 'Mais cobre em drops (preparado para bônus futuro).',
    icon: '💰',
    effectText: '+1% loot por nível',
    maxLevel: 10,
    baseFunds: 4_000,
    baseCoins: 40,
  },
  {
    id: 'sk-hp',
    name: 'Barreira de Chakra',
    description: 'Reforça a resistência do time.',
    icon: '🛡️',
    effectText: '+2% HP por nível',
    maxLevel: 10,
    baseFunds: 3_500,
    baseCoins: 35,
  },
  {
    id: 'sk-seal',
    name: 'Mestre dos Selamentos',
    description: 'Melhora a chance de selamento (preparado).',
    icon: '✨',
    effectText: '+0.5% selamento por nível',
    maxLevel: 5,
    baseFunds: 6_000,
    baseCoins: 60,
  },
] as const;

export const GUILD_SHOP_DEFS: readonly GuildShopDef[] = [
  {
    id: 'sh-scroll',
    name: 'Pergaminho de Selamento',
    description: 'Recebe cobre equivalente ao valor de reposição do pergaminho.',
    icon: '📜',
    priceCoins: 80,
    category: 'Selamento',
    maxStock: 8,
    reqGuildLevel: 1,
    copperReward: 25,
  },
  {
    id: 'sh-potion',
    name: 'Frasco de Chakra',
    description: 'Suprimento de guilda — recompensa em cobre.',
    icon: '🧪',
    priceCoins: 40,
    category: 'Consumíveis',
    maxStock: 12,
    reqGuildLevel: 1,
    copperReward: 15,
  },
  {
    id: 'sh-fragment',
    name: 'Fragmento de Shinobi',
    description: 'Material de forja (simulado em cobre por enquanto).',
    icon: '🧩',
    priceCoins: 200,
    category: 'Ninja',
    maxStock: 5,
    reqGuildLevel: 3,
    copperReward: 80,
  },
  {
    id: 'sh-exp',
    name: 'Caixa de Pílulas de EXP',
    description: 'Lote de treino — cobre de recompensa.',
    icon: '💊',
    priceCoins: 120,
    category: 'Consumíveis',
    maxStock: 6,
    reqGuildLevel: 2,
    copperReward: 50,
  },
  {
    id: 'sh-aura',
    name: 'Aura da Guilda',
    description: 'Cosmético exclusivo — compra simbólica.',
    icon: '💫',
    priceCoins: 500,
    category: 'Exclusivo',
    maxStock: 1,
    reqGuildLevel: 5,
    copperReward: 0,
  },
] as const;

export const GUILD_MISSION_DEFS: readonly GuildMissionDef[] = [
  {
    id: 'm-checkin',
    title: 'Presença Ninja Diária',
    description: 'Marque presença no mural da guilda.',
    icon: '🗓️',
    target: 1,
    rewardCoins: 50,
    rewardExp: 200,
    category: 'DIÁRIA',
  },
  {
    id: 'm-boss',
    title: 'Desafio do Boss Kurama',
    description: 'Ataque o Boss da guilda ao menos 1 vez.',
    icon: '⚔️',
    target: 1,
    rewardCoins: 150,
    rewardExp: 500,
    category: 'COMBATE',
  },
  {
    id: 'm-donation',
    title: 'Contribuição de Cobre',
    description: 'Doe pelo menos 1.000 de cobre aos fundos da guilda.',
    icon: '💰',
    target: 1_000,
    rewardCoins: 200,
    rewardExp: 600,
    category: 'GUILDA',
  },
  {
    id: 'm-shop',
    title: 'Mercado de Suprimentos',
    description: 'Compre 1 item na loja da guilda.',
    icon: '🛒',
    target: 1,
    rewardCoins: 100,
    rewardExp: 300,
    category: 'GUILDA',
  },
] as const;
