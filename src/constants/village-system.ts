import type { VillageId } from '@/types/village';

export type VillageBonusKind =
  | 'captureChance'
  | 'killSpeed'
  | 'highRarityChance'
  | 'xpPerKill'
  | 'lootDropChance';

export interface VillageBonusEntry {
  kind: VillageBonusKind;
  value: number;
}

export interface VillageSystemDefinition {
  id: VillageId;
  name: string;
  fullName: string;
  country: string;
  element: string;
  profile: string;
  bonuses: readonly VillageBonusEntry[];
}

export const VILLAGE_SYSTEM: readonly VillageSystemDefinition[] = [
  {
    id: 'konoha',
    name: 'Vila Oculta da Folha',
    fullName: 'Konohagakure no Sato',
    country: 'País do Fogo',
    element: 'katon',
    profile: 'Perfil equilibrado para quem quer progressão estável e mais recrutamentos.',
    bonuses: [{ kind: 'captureChance', value: 0.1 }],
  },
  {
    id: 'suna',
    name: 'Vila Oculta da Areia',
    fullName: 'Sunagakure no Sato',
    country: 'País do Vento',
    element: 'futon',
    profile: 'Perfil agressivo para acelerar farming e limpar hunts mais rápido.',
    bonuses: [{ kind: 'killSpeed', value: 0.15 }],
  },
  {
    id: 'kiri',
    name: 'Vila Oculta da Névoa',
    fullName: 'Kirigakure no Sato',
    country: 'País da Água',
    element: 'suiton',
    profile: 'Perfil arriscado para caçar exemplares raros aceitando menos chance de selamento.',
    bonuses: [
      { kind: 'highRarityChance', value: 0.2 },
      { kind: 'captureChance', value: -0.1 },
    ],
  },
  {
    id: 'kumo',
    name: 'Vila Oculta da Nuvem',
    fullName: 'Kumogakure no Sato',
    country: 'País do Raio',
    element: 'raiton',
    profile: 'Perfil de progressão para subir nível mais rápido por kill.',
    bonuses: [{ kind: 'xpPerKill', value: 0.15 }],
  },
  {
    id: 'iwa',
    name: 'Vila Oculta da Pedra',
    fullName: 'Iwagakure no Sato',
    country: 'País da Terra',
    element: 'doton',
    profile: 'Perfil econômico para aumentar constância de loot nas caçadas.',
    bonuses: [{ kind: 'lootDropChance', value: 0.1 }],
  },
] as const;

export const VILLAGE_SYSTEM_BY_ID: Record<VillageId, VillageSystemDefinition> = Object.fromEntries(
  VILLAGE_SYSTEM.map((village) => [village.id, village]),
) as Record<VillageId, VillageSystemDefinition>;
