import type { HuntDefinition, HuntTarget } from '@/types/hunt';
import type { MapKey } from '@/maps/map-registry';
import type { CaptureEnemyTier } from '@/constants/capture-system';
import { resolveCaptureEnemyTier } from '@/lib/capture-enemy-tier';

export type HuntDifficultyId = 'facil' | 'medio' | 'dificil' | 'muito-dificil';

export interface HuntDifficulty {
  id: HuntDifficultyId;
  label: string;
  accent: string;
}

export interface HuntWorldRegion {
  id: string;
  label: string;
  location: string;
  imageUrl: string;
  mapKeys: readonly MapKey[];
}

export interface HuntMapPin {
  hunt: HuntDefinition;
  target: HuntTarget;
  region: HuntWorldRegion;
  difficulty: HuntDifficulty;
}

export type HuntLevelFilter = 'all' | '1-20' | '20-40' | '40-60' | '60+';

export const HUNT_LEVEL_FILTERS: Array<{ id: HuntLevelFilter; label: string }> = [
  { id: 'all', label: 'TODAS' },
  { id: '1-20', label: 'NV 1-20' },
  { id: '20-40', label: 'NV 20-40' },
  { id: '40-60', label: 'NV 40-60' },
  { id: '60+', label: 'NV 60+' },
];

const DIFFICULTIES: Record<HuntDifficultyId, HuntDifficulty> = {
  facil: { id: 'facil', label: 'Fácil', accent: '#4caf7a' },
  medio: { id: 'medio', label: 'Médio', accent: '#6b98a7' },
  dificil: { id: 'dificil', label: 'Difícil', accent: '#e67a2f' },
  'muito-dificil': { id: 'muito-dificil', label: 'Muito difícil', accent: '#c45c5c' },
};

const TIER_TO_DIFFICULTY: Record<CaptureEnemyTier, HuntDifficultyId> = {
  comum: 'facil',
  elite: 'medio',
  raro: 'dificil',
  chefe: 'muito-dificil',
};

/** Regiões do mapa-múndi visual — arte Top down existente como fundo. */
export const HUNT_WORLD_REGIONS: HuntWorldRegion[] = [
  {
    id: 'clareira',
    label: 'Clareira',
    location: 'Konoha - Floresta',
    imageUrl: '/maps/hunt-td-clareira-equipe-7.png?v=naruto-td1',
    mapKeys: ['huntForestClearing', 'huntTdClareiraEquipe7', 'huntTesteFarmWonsr', 'huntTesteDemon', 'huntTesteWonsrMonsters'],
  },
  {
    id: 'vale',
    label: 'Vale do Fim',
    location: 'Konoha - Vale do Fim',
    imageUrl: '/maps/hunt-td-vale-do-fim.png?v=naruto-td1',
    mapKeys: ['huntValeDoFim', 'huntTdValeDoFim', 'huntCampoGuerraNinja'],
  },
  {
    id: 'treino',
    label: 'Campo de Treino',
    location: 'Konoha - Treinamento',
    imageUrl: '/maps/wonsr-campo-treinamento.png?v=naruto-td1',
    mapKeys: ['huntCampoTreinamento', 'huntWonsrCampoTreinamento', 'huntTesteEquipe'],
  },
  {
    id: 'arena',
    label: 'Arena Chunin',
    location: 'Konoha - Arena',
    imageUrl: '/maps/hunt-td-arena-exame-chunin.png?v=naruto-td1',
    mapKeys: [
      'huntArenaExameChunin',
      'huntArenaExameChunnin',
      'huntTdArenaExameChunin',
      'huntTorneioArtesMarciais',
    ],
  },
  {
    id: 'uchiha',
    label: 'Distrito Uchiha',
    location: 'Konoha - Distrito Uchiha',
    imageUrl: '/maps/hunt-td-cratera-konoha.png?v=naruto-td1',
    mapKeys: ['huntDistritoUchiha', 'huntKonohaDestruida', 'huntTdCrateraKonoha'],
  },
  {
    id: 'ponte',
    label: 'Ponte das Ondas',
    location: 'País das Ondas',
    imageUrl: '/maps/hunt-td-ponte-das-ondas.png?v=naruto-td1',
    mapKeys: ['huntPontePaisOnda', 'huntTdPonteDasOndas', 'huntWonsrPonteDaNevoa'],
  },
  {
    id: 'areia',
    label: 'Deserto',
    location: 'País do Vento - Areia',
    imageUrl: '/maps/hunt-td-arena-vila-areia.png?v=naruto-td1',
    mapKeys: [
      'huntPaisDoVento',
      'huntTdArenaVilaAreia',
      'huntDesertoSaiyajin',
      'huntWonsrDesertoAreia',
    ],
  },
  {
    id: 'akatsuki',
    label: 'Caverna Akatsuki',
    location: 'Esconderijo Akatsuki',
    imageUrl: '/maps/hunt-td-caverna-akatsuki.png?v=naruto-td1',
    mapKeys: [
      'huntEsconderijoAkatsuki',
      'huntTdCavernaAkatsuki',
      'huntWonsrCavernaAkatsuki',
      'huntWonsrFlorestaDaMorte',
    ],
  },
  {
    id: 'orochimaru',
    label: 'Lab. Orochimaru',
    location: 'Esconderijo de Orochimaru',
    imageUrl: '/maps/hunt-td-laboratorio-orochimaru.png?v=naruto-td1',
    mapKeys: [
      'huntLabOrochimaru',
      'huntTdLaboratorioOrochimaru',
      'huntWonsrLaboratorioOrochimaru',
      'huntWonsrEsconderijoOrochimaru',
      'huntSalaDoTempo',
    ],
  },
  {
    id: 'myoboku',
    label: 'Monte Myoboku',
    location: 'Monte Myoboku',
    imageUrl: '/maps/wonsr-clareira-equipe-7.png?v=naruto-td1',
    mapKeys: ['huntMonteMyoboku', 'huntWonsrClareiraEquipe7', 'huntWonsrPaisDoFerro', 'huntWonsrValeDasEstatuas'],
  },
];

const FALLBACK_REGION: HuntWorldRegion = {
  id: 'fallback',
  label: 'Territórios',
  location: 'Naruto World',
  imageUrl: '/maps/hunt-td-clareira-equipe-7.png?v=naruto-td1',
  mapKeys: [],
};

const REGION_BY_MAP = new Map<string, HuntWorldRegion>();
for (const region of HUNT_WORLD_REGIONS) {
  for (const mapKey of region.mapKeys) {
    REGION_BY_MAP.set(mapKey, region);
  }
}

export function huntDifficultyForHunt(hunt: HuntDefinition, target: HuntTarget): HuntDifficulty {
  const tier = resolveCaptureEnemyTier({
    huntTab: hunt.tab,
    lookType: target.lookType,
    characterId: target.id,
    sourceId: target.sourceId,
    level: hunt.requiredLevel,
  });
  return DIFFICULTIES[TIER_TO_DIFFICULTY[tier]];
}

export function matchesHuntLevelFilter(level: number, filter: HuntLevelFilter): boolean {
  if (filter === 'all') return true;
  if (filter === '1-20') return level >= 1 && level <= 20;
  if (filter === '20-40') return level > 20 && level <= 40;
  if (filter === '40-60') return level > 40 && level <= 60;
  return level > 60;
}

export function resolveHuntRegion(mapKey: MapKey | string): HuntWorldRegion {
  return REGION_BY_MAP.get(mapKey) ?? FALLBACK_REGION;
}

export function buildHuntMapPins(hunts: HuntDefinition[]): HuntMapPin[] {
  const grouped = new Map<string, HuntDefinition[]>();
  for (const hunt of hunts) {
    const region = resolveHuntRegion(hunt.mapKey);
    const list = grouped.get(region.id) ?? [];
    list.push(hunt);
    grouped.set(region.id, list);
  }

  const pins: HuntMapPin[] = [];
  for (const region of [...HUNT_WORLD_REGIONS, FALLBACK_REGION]) {
    const list = grouped.get(region.id);
    if (!list?.length) continue;
    for (const hunt of list) {
      const target = hunt.targets[0];
      if (!target) continue;
      pins.push({
        hunt,
        target,
        region,
        difficulty: huntDifficultyForHunt(hunt, target),
      });
    }
  }
  return pins;
}
