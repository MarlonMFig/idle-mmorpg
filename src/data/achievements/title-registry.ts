import type { TitleDefinition } from '@/types/achievements';

/**
 * Títulos cosméticos — SEM atributos de combate.
 * Balanceamento inicial / apresentação.
 */
export const TITLE_REGISTRY: Record<string, TitleDefinition> = {
  'novato-combate': {
    id: 'novato-combate',
    name: 'Novato em Combate',
    description: 'Desbloqueado ao derrotar 100 inimigos Online.',
    rarity: 'comum',
    source: 'online-kills-100',
  },
  veterano: {
    id: 'veterano',
    name: 'Veterano',
    description: 'Desbloqueado ao derrotar 10.000 inimigos Online.',
    rarity: 'raro',
    source: 'online-kills-10000',
  },
  'lenda-campo': {
    id: 'lenda-campo',
    name: 'Lenda do Campo de Batalha',
    description: 'Desbloqueado ao derrotar 100.000 inimigos Online.',
    rarity: 'lendario',
    source: 'online-kills-100000',
  },
  colecionador: {
    id: 'colecionador',
    name: 'Colecionador',
    description: 'Desbloqueado ao obter 50 personagens únicos.',
    rarity: 'epico',
    source: 'collection-50',
  },
  'mestre-combate': {
    id: 'mestre-combate',
    name: 'Mestre de Combate',
    description: 'Desbloqueado ao alcançar Maestria 100 em um personagem.',
    rarity: 'lendario',
    source: 'mastery-100',
  },
  desperto: {
    id: 'desperto',
    name: 'Desperto',
    description: 'Desbloqueado ao alcançar Despertar III.',
    rarity: 'epico',
    source: 'awakening-3',
  },
  'mestre-shinobi': {
    id: 'mestre-shinobi',
    name: 'Mestre Shinobi',
    description: 'Ninja Graduação Rank IV.',
    rarity: 'lendario',
    source: 'lineage-rank-4-ninja',
  },
  'capitao-espiritual': {
    id: 'capitao-espiritual',
    name: 'Capitão Espiritual',
    description: 'Shinigami Graduação Rank IV.',
    rarity: 'lendario',
    source: 'lineage-rank-4-shinigami',
  },
  'imperador-mares': {
    id: 'imperador-mares',
    name: 'Imperador dos Mares',
    description: 'Pirata Graduação Rank IV.',
    rarity: 'lendario',
    source: 'lineage-rank-4-pirata',
  },
  'cacador-lendario': {
    id: 'cacador-lendario',
    name: 'Caçador Lendário',
    description: 'Caçador Graduação Rank IV.',
    rarity: 'lendario',
    source: 'lineage-rank-4-cacador',
  },
  'feiticeiro-especial': {
    id: 'feiticeiro-especial',
    name: 'Feiticeiro Especial',
    description: 'Feiticeiro Graduação Rank IV.',
    rarity: 'lendario',
    source: 'lineage-rank-4-feiticeiro',
  },
  'guerreiro-lendario': {
    id: 'guerreiro-lendario',
    name: 'Guerreiro Lendário',
    description: 'Guerreiro Graduação Rank IV.',
    rarity: 'lendario',
    source: 'lineage-rank-4-guerreiro',
  },
  'olhos-escarlates': {
    id: 'olhos-escarlates',
    name: 'Olhos Escarlates',
    description: 'Exemplo: Sharingan IV.',
    rarity: 'mitico',
    source: 'spec-sharingan-4',
  },
  'visao-absoluta': {
    id: 'visao-absoluta',
    name: 'Visão Absoluta',
    description: 'Exemplo: Byakugan IV.',
    rarity: 'mitico',
    source: 'spec-byakugan-4',
  },
};

export function getTitleDefinition(id: string | null | undefined): TitleDefinition | null {
  if (!id) return null;
  return TITLE_REGISTRY[id] ?? null;
}

export function listTitleDefinitions(): TitleDefinition[] {
  return Object.values(TITLE_REGISTRY);
}
