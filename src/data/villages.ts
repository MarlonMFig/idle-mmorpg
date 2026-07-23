import type { VillageId } from '@/types/village';

export type { VillageId } from '@/types/village';

export type VillageIconKind = 'leaf' | 'sand' | 'mist' | 'cloud' | 'stone';

export interface VillageDefinition {
  id: VillageId;
  name: string;
  /** Nome completo exibido na criação. */
  fullName: string;
  shortLabel: string;
  /** Cor de destaque (CSS). */
  accent: string;
  icon: VillageIconKind;
  /** Rival histórico sugerido (guerras futuras). */
  rivalId: VillageId;
  elementsLabel: string;
  passiveTitle: string;
  passiveBonus: string;
  lore: string;
  startingItems: string;
}

export const VILLAGES: readonly VillageDefinition[] = [
  {
    id: 'konoha',
    name: 'Konoha',
    fullName: 'Vila da Folha',
    shortLabel: 'Folha',
    accent: '#3ecf6a',
    icon: 'leaf',
    rivalId: 'iwa',
    elementsLabel: 'ELEMENTO FUTON / KATON',
    passiveTitle: 'Habilidade Passiva Inicial:',
    passiveBonus: '+10% XP Bônus & +5% Velocidade de Ataque',
    lore:
      'A vila mais famosa e equilibrada, lar de grandes prodígios. Foco em determinação (Vontade do Fogo) e evolução contínua.',
    startingItems: 'Kunai de Treino Básica e a Bandana da Vila escolhida!',
  },
  {
    id: 'suna',
    name: 'Suna',
    fullName: 'Vila da Areia',
    shortLabel: 'Areia',
    accent: '#e8a04a',
    icon: 'sand',
    rivalId: 'kiri',
    elementsLabel: 'ELEMENTO FUTTON / DOTON',
    passiveTitle: 'Habilidade Passiva Inicial:',
    passiveBonus: '+8% Defesa & +6% Dano à Distância',
    lore:
      'Guardiã do deserto. Sobrevive com disciplina, puppets e tempestades de areia que desgastam o inimigo.',
    startingItems: 'Kunai de Treino Básica e a Bandana da Vila escolhida!',
  },
  {
    id: 'kiri',
    name: 'Kiri',
    fullName: 'Vila da Névoa',
    shortLabel: 'Névoa',
    accent: '#6eb6ff',
    icon: 'mist',
    rivalId: 'suna',
    elementsLabel: 'ELEMENTO SUITON / DOTON',
    passiveTitle: 'Habilidade Passiva Inicial:',
    passiveBonus: '+10% Crítico & +5% Evasão',
    lore:
      'Nascida da névoa silenciosa. Especialistas em assassinato silencioso e controle do campo com água.',
    startingItems: 'Kunai de Treino Básica e a Bandana da Vila escolhida!',
  },
  {
    id: 'kumo',
    name: 'Kumo',
    fullName: 'Vila da Nuvem',
    shortLabel: 'Nuvem',
    accent: '#f0c14a',
    icon: 'cloud',
    rivalId: 'konoha',
    elementsLabel: 'ELEMENTO RAITON / FUTTON',
    passiveTitle: 'Habilidade Passiva Inicial:',
    passiveBonus: '+12% Velocidade & +4% Dano Elétrico',
    lore:
      'Poder nas montanhas. Shinobis rápidos e agressivos, mestres do raio e da pressão ofensiva.',
    startingItems: 'Kunai de Treino Básica e a Bandana da Vila escolhida!',
  },
  {
    id: 'iwa',
    name: 'Iwa',
    fullName: 'Vila da Pedra',
    shortLabel: 'Pedra',
    accent: '#c4a882',
    icon: 'stone',
    rivalId: 'konoha',
    elementsLabel: 'ELEMENTO DOTON / KATON',
    passiveTitle: 'Habilidade Passiva Inicial:',
    passiveBonus: '+12% HP Máximo & +5% Resistência',
    lore:
      'Inabalável como a montanha. Foco em resistência, explosivos e controle de terreno.',
    startingItems: 'Kunai de Treino Básica e a Bandana da Vila escolhida!',
  },
] as const;

export const VILLAGE_BY_ID: Record<VillageId, VillageDefinition> = Object.fromEntries(
  VILLAGES.map((village) => [village.id, village]),
) as Record<VillageId, VillageDefinition>;

export function getVillage(villageId: VillageId): VillageDefinition {
  return VILLAGE_BY_ID[villageId];
}

export function getVillageName(villageId: VillageId): string {
  return VILLAGE_BY_ID[villageId]?.name ?? villageId;
}
