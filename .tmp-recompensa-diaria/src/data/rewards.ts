import { DayReward, ItemReward } from '../types';

export const REWARDS_ITEMS_CATALOG: Record<string, Omit<ItemReward, 'count'>> = {
  copper: {
    id: 'copper',
    name: 'Copper (DEV)',
    type: 'copper',
    rarity: 'common',
    description: 'Moeda de troca padrão usada para forja, upgrades e comércio no reino.',
    color: '#eab308',
    glowColor: 'rgba(234, 179, 8, 0.4)',
  },
  potion: {
    id: 'potion',
    name: 'Poção de Vida',
    type: 'potion',
    rarity: 'common',
    description: 'Restaura instantaneamente 150 pontos de HP durante combate ou exploração.',
    color: '#ef4444',
    glowColor: 'rgba(239, 68, 68, 0.4)',
  },
  concentrated_potion: {
    id: 'concentrated_potion',
    name: 'Poção Concentrada',
    type: 'concentrated_potion',
    rarity: 'rare',
    description: 'Fórmula refinada que recupera 450 HP e concede 10% de regeneração contínua.',
    color: '#3b82f6',
    glowColor: 'rgba(59, 130, 246, 0.4)',
  },
  ultra_potion: {
    id: 'ultra_potion',
    name: 'Poção Ultra Concentrada',
    type: 'ultra_potion',
    rarity: 'epic',
    description: 'Elixir alquímico raro que restaura 1000 HP e purifica todas as maldições ativas.',
    color: '#a855f7',
    glowColor: 'rgba(168, 85, 247, 0.45)',
  },
  scroll: {
    id: 'scroll',
    name: 'Pergaminho de Selamento',
    type: 'scroll',
    rarity: 'epic',
    description: 'Pergaminho com encantamento arcano usado para selar demônios e forjar runas lendárias.',
    color: '#ec4899',
    glowColor: 'rgba(236, 72, 153, 0.45)',
  },
  revive: {
    id: 'revive',
    name: 'Pena de Fênix (Revive)',
    type: 'revive',
    rarity: 'legendary',
    description: 'Relíquia sagrada que revive um personagem caído imediatamente com 80% de HP.',
    color: '#f97316',
    glowColor: 'rgba(249, 115, 22, 0.5)',
  },
  chest: {
    id: 'chest',
    name: 'Baú do Soberano',
    type: 'chest',
    rarity: 'legendary',
    description: 'Baú divino contendo tesouros primordiais e materiais raros para forja mítica.',
    color: '#fbbf24',
    glowColor: 'rgba(251, 191, 36, 0.6)',
  },
};

export const DAILY_REWARDS_DATA: DayReward[] = [
  {
    day: 1,
    title: 'Dia 1',
    subtitle: 'Primeiro Passo',
    note: 'Valores de balanceamento inicial',
    items: [
      {
        ...REWARDS_ITEMS_CATALOG.copper,
        count: 80,
      },
    ],
  },
  {
    day: 2,
    title: 'Dia 2',
    subtitle: 'Suprimentos Básicos',
    note: 'Valores de balanceamento inicial',
    items: [
      {
        ...REWARDS_ITEMS_CATALOG.potion,
        count: 2,
      },
    ],
  },
  {
    day: 3,
    title: 'Dia 3',
    subtitle: 'Provisões da Guarda',
    note: 'Valores de balanceamento inicial',
    items: [
      {
        ...REWARDS_ITEMS_CATALOG.copper,
        count: 120,
      },
      {
        ...REWARDS_ITEMS_CATALOG.potion,
        count: 1,
      },
    ],
  },
  {
    day: 4,
    title: 'Dia 4',
    subtitle: 'Elixir Refinado',
    note: 'Valores de balanceamento inicial',
    items: [
      {
        ...REWARDS_ITEMS_CATALOG.concentrated_potion,
        count: 1,
      },
    ],
  },
  {
    day: 5,
    title: 'Dia 5',
    subtitle: 'Arcano Antigo',
    note: 'Valores de balanceamento inicial',
    items: [
      {
        ...REWARDS_ITEMS_CATALOG.copper,
        count: 180,
      },
      {
        ...REWARDS_ITEMS_CATALOG.scroll,
        count: 1,
      },
    ],
  },
  {
    day: 6,
    title: 'Dia 6',
    subtitle: 'Graça da Fênix',
    note: 'Valores de balanceamento inicial',
    items: [
      {
        ...REWARDS_ITEMS_CATALOG.ultra_potion,
        count: 1,
      },
      {
        ...REWARDS_ITEMS_CATALOG.revive,
        count: 1,
      },
    ],
  },
  {
    day: 7,
    title: 'Dia 7',
    subtitle: 'Grande Tesouro Imperial',
    note: 'Valores de balanceamento inicial',
    isGrandReward: true,
    items: [
      {
        ...REWARDS_ITEMS_CATALOG.copper,
        count: 350,
      },
      {
        ...REWARDS_ITEMS_CATALOG.scroll,
        count: 2,
      },
      {
        ...REWARDS_ITEMS_CATALOG.concentrated_potion,
        count: 2,
      },
      {
        ...REWARDS_ITEMS_CATALOG.chest,
        count: 1,
      },
    ],
  },
];
