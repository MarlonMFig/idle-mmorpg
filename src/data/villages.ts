import { VILLAGE_SYSTEM_BY_ID } from '@/constants/village-system';
import type { VillageId } from '@/types/village';

export type { VillageId } from '@/types/village';

export type VillageIconKind = 'leaf' | 'sand' | 'mist' | 'cloud' | 'stone';

export interface VillageDefinition {
  id: VillageId;
  name: string;
  fullName: string;
  country: string;
  shortLabel: string;
  accent: string;
  icon: VillageIconKind;
  iconSrc: string;
  rivalId: VillageId;
  element: string;
  profile: string;
  bonusLabel: string;
}

export const VILLAGES: readonly VillageDefinition[] = [
  {
    ...VILLAGE_SYSTEM_BY_ID.konoha,
    shortLabel: 'Folha',
    accent: '#3ecf6a',
    icon: 'leaf',
    iconSrc: '/ui/villages/konoha.png',
    rivalId: 'iwa',
    bonusLabel: '+10% chance de captura',
  },
  {
    ...VILLAGE_SYSTEM_BY_ID.suna,
    shortLabel: 'Areia',
    accent: '#e8a04a',
    icon: 'sand',
    iconSrc: '/ui/villages/suna.png',
    rivalId: 'kiri',
    bonusLabel: '+15% velocidade de kill',
  },
  {
    ...VILLAGE_SYSTEM_BY_ID.kiri,
    shortLabel: 'Névoa',
    accent: '#6eb6ff',
    icon: 'mist',
    iconSrc: '/ui/villages/kiri.png',
    rivalId: 'suna',
    bonusLabel: '+20% raridade alta / -10% chance de captura',
  },
  {
    ...VILLAGE_SYSTEM_BY_ID.kumo,
    shortLabel: 'Nuvem',
    accent: '#f0c14a',
    icon: 'cloud',
    iconSrc: '/ui/villages/kumo.png',
    rivalId: 'konoha',
    bonusLabel: '+15% XP por kill',
  },
  {
    ...VILLAGE_SYSTEM_BY_ID.iwa,
    shortLabel: 'Pedra',
    accent: '#c4a882',
    icon: 'stone',
    iconSrc: '/ui/villages/iwa.png',
    rivalId: 'konoha',
    bonusLabel: '+10% chance de drop de loot',
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
