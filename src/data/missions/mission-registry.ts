import { POTION_ITEM_IDS } from '@/config/gameConfig';
import type { MissionDefinition } from '@/types/missions';

const copper = (amount: number): MissionDefinition['rewards'] => [{ type: 'copper', amount }];
const copperPotion = (amount: number, potions = 1): MissionDefinition['rewards'] => [
  { type: 'copper', amount },
  { type: 'item', id: POTION_ITEM_IDS.normal, amount: potions },
];

/** Pool diário — seleciona 5 por ciclo. Copper = BALANCEAMENTO INICIAL. */
export const DAILY_MISSION_POOL: readonly MissionDefinition[] = [
  {
    id: 'daily-online-kills-100',
    type: 'daily',
    name: 'Caçador Incansável',
    description: 'Derrote 100 inimigos em combate Online.',
    tag: 'combat',
    variantGroup: 'online-kills',
    condition: { type: 'onlineKills', value: 100 },
    rewards: copper(80),
    rewardsDev: true,
  },
  {
    id: 'daily-online-kills-250',
    type: 'daily',
    name: 'Ofensiva Diária',
    description: 'Derrote 250 inimigos em combate Online.',
    tag: 'combat',
    variantGroup: 'online-kills',
    condition: { type: 'onlineKills', value: 250 },
    rewards: copper(140),
    rewardsDev: true,
  },
  {
    id: 'daily-capture-1',
    type: 'daily',
    name: 'Primeiro Recrutamento do Dia',
    description: 'Recrute 1 personagem.',
    tag: 'capture',
    variantGroup: 'capture',
    condition: { type: 'charactersCaptured', value: 1 },
    rewards: copper(100),
    rewardsDev: true,
    eligibility: { requiresFeature: 'capture' },
  },
  {
    id: 'daily-capture-3',
    type: 'daily',
    name: 'Caçador de Recrutas',
    description: 'Recrute 3 personagens.',
    tag: 'capture',
    variantGroup: 'capture',
    condition: { type: 'charactersCaptured', value: 3 },
    rewards: copper(180),
    rewardsDev: true,
    eligibility: { requiresFeature: 'capture' },
  },
  {
    id: 'daily-drops-10',
    type: 'daily',
    name: 'Espólio Leve',
    description: 'Obtenha 10 drops em combate Online.',
    tag: 'loot',
    variantGroup: 'drops',
    condition: { type: 'itemsDropped', value: 10 },
    rewards: copper(70),
    rewardsDev: true,
  },
  {
    id: 'daily-drops-25',
    type: 'daily',
    name: 'Espólio do Dia',
    description: 'Obtenha 25 drops em combate Online.',
    tag: 'loot',
    variantGroup: 'drops',
    condition: { type: 'itemsDropped', value: 25 },
    rewards: copper(120),
    rewardsDev: true,
  },
  {
    id: 'daily-copper-combat-200',
    type: 'daily',
    name: 'Bolso de Cobre',
    description: 'Obtenha 200 Copper através de combate Online.',
    tag: 'loot',
    variantGroup: 'copper-combat',
    condition: { type: 'copperEarnedFromCombat', value: 200 },
    rewards: copperPotion(90, 1),
    rewardsDev: true,
  },
  {
    id: 'daily-potions-3',
    type: 'daily',
    name: 'Suprimento de Cura',
    description: 'Use 3 poções.',
    tag: 'consumable',
    variantGroup: 'potions',
    condition: { type: 'potionsUsed', value: 3 },
    rewards: copper(60),
    rewardsDev: true,
    eligibility: { requiresFeature: 'potion' },
  },
  {
    id: 'daily-mastery-xp-200',
    type: 'daily',
    name: 'Treino de Maestria',
    description: 'Ganhe 200 de progresso de Maestria em combate Online.',
    tag: 'mastery',
    variantGroup: 'mastery-xp',
    condition: { type: 'masteryXpGained', value: 200 },
    rewards: copper(100),
    rewardsDev: true,
  },
  {
    id: 'daily-lineage-kills-100',
    type: 'daily',
    name: 'Lealdade da Linhagem',
    description: 'Derrote 100 inimigos Online usando personagens da sua Linhagem.',
    tag: 'lineage',
    variantGroup: 'lineage-kills',
    condition: { type: 'lineageCompatibleKills', value: 100 },
    rewards: copper(120),
    rewardsDev: true,
    eligibility: { requiresLineage: true, minimumPlayerLevel: 20 },
  },
  {
    id: 'daily-hunt-001-kills-80',
    type: 'daily',
    name: 'Caça no Vale',
    description: 'Derrote 80 inimigos na Hunt Mapa de Uzumaki Naruto.',
    tag: 'combat',
    variantGroup: 'hunt-kills',
    condition: { type: 'onlineKillsInHunt', value: 80, huntId: 'wonsr-hunt-001' },
    rewards: copper(90),
    rewardsDev: true,
    eligibility: { requiresHuntId: 'wonsr-hunt-001', minimumPlayerLevel: 1 },
  },
  {
    id: 'daily-unique-enemies-8',
    type: 'daily',
    name: 'Variedade de Alvos',
    description: 'Derrote 8 tipos diferentes de inimigos Online.',
    tag: 'combat',
    variantGroup: 'unique-enemies',
    condition: { type: 'uniqueEnemiesKilled', value: 8 },
    rewards: copper(80),
    rewardsDev: true,
  },
];

/** Pool semanal — 5 por ciclo. Copper = BALANCEAMENTO INICIAL. */
export const WEEKLY_MISSION_POOL: readonly MissionDefinition[] = [
  {
    id: 'weekly-online-kills-2500',
    type: 'weekly',
    name: 'Campanha Semanal',
    description: 'Derrote 2.500 inimigos em combate Online.',
    tag: 'combat',
    variantGroup: 'online-kills',
    condition: { type: 'onlineKills', value: 2_500 },
    rewards: copper(400),
    rewardsDev: true,
  },
  {
    id: 'weekly-online-kills-5000',
    type: 'weekly',
    name: 'Ofensiva Prolongada',
    description: 'Derrote 5.000 inimigos em combate Online.',
    tag: 'combat',
    variantGroup: 'online-kills',
    condition: { type: 'onlineKills', value: 5_000 },
    rewards: copper(700),
    rewardsDev: true,
  },
  {
    id: 'weekly-capture-10',
    type: 'weekly',
    name: 'Recrutamento Semanal',
    description: 'Recrute 10 personagens.',
    tag: 'capture',
    variantGroup: 'capture',
    condition: { type: 'charactersCaptured', value: 10 },
    rewards: copper(500),
    rewardsDev: true,
    eligibility: { requiresFeature: 'capture' },
  },
  {
    id: 'weekly-drops-250',
    type: 'weekly',
    name: 'Saque da Semana',
    description: 'Obtenha 250 drops em combate Online.',
    tag: 'loot',
    variantGroup: 'drops',
    condition: { type: 'itemsDropped', value: 250 },
    rewards: copper(450),
    rewardsDev: true,
  },
  {
    id: 'weekly-copper-combat-2500',
    type: 'weekly',
    name: 'Tesouro de Combate',
    description: 'Obtenha 2.500 Copper através de combate Online.',
    tag: 'loot',
    variantGroup: 'copper-combat',
    condition: { type: 'copperEarnedFromCombat', value: 2_500 },
    rewards: copperPotion(480, 3),
    rewardsDev: true,
  },
  {
    id: 'weekly-potions-20',
    type: 'weekly',
    name: 'Estoque Médico',
    description: 'Use 20 poções.',
    tag: 'consumable',
    variantGroup: 'potions',
    condition: { type: 'potionsUsed', value: 20 },
    rewards: copper(300),
    rewardsDev: true,
    eligibility: { requiresFeature: 'potion' },
  },
  {
    id: 'weekly-lineage-kills-1000',
    type: 'weekly',
    name: 'Frente da Linhagem',
    description: 'Derrote 1.000 inimigos Online usando personagens da sua Linhagem.',
    tag: 'lineage',
    variantGroup: 'lineage-kills',
    condition: { type: 'lineageCompatibleKills', value: 1_000 },
    rewards: copper(520),
    rewardsDev: true,
    eligibility: { requiresLineage: true, minimumPlayerLevel: 20 },
  },
  {
    id: 'weekly-mastery-xp-2000',
    type: 'weekly',
    name: 'Maestria da Semana',
    description: 'Ganhe 2.000 de progresso de Maestria em combate Online.',
    tag: 'mastery',
    variantGroup: 'mastery-xp',
    condition: { type: 'masteryXpGained', value: 2_000 },
    rewards: copper(500),
    rewardsDev: true,
  },
  {
    id: 'weekly-hunt-006-kills-200',
    type: 'weekly',
    name: 'Distrito Uchiha',
    description: 'Derrote 200 inimigos na Hunt Mapa de Uchiha Sasuke.',
    tag: 'combat',
    variantGroup: 'hunt-kills',
    condition: { type: 'onlineKillsInHunt', value: 200, huntId: 'wonsr-hunt-006' },
    rewards: copper(420),
    rewardsDev: true,
    eligibility: { requiresHuntId: 'wonsr-hunt-006', minimumPlayerLevel: 10 },
  },
  {
    id: 'weekly-unique-enemies-25',
    type: 'weekly',
    name: 'Catálogo de Inimigos',
    description: 'Derrote 25 tipos diferentes de inimigos Online.',
    tag: 'combat',
    variantGroup: 'unique-enemies',
    condition: { type: 'uniqueEnemiesKilled', value: 25 },
    rewards: copper(380),
    rewardsDev: true,
  },
];

function journey(
  id: string,
  name: string,
  description: string,
  condition: MissionDefinition['condition'],
  nextMissionId: string | undefined,
  amount: number,
): MissionDefinition {
  return {
    id,
    type: 'journey',
    name,
    description,
    tag: 'progress',
    variantGroup: 'progress',
    condition,
    rewards: copper(amount),
    rewardsDev: true,
    nextMissionId,
  };
}

/**
 * Jornada sequencial — ordem ajustada ao fluxo real:
 * Linhagem libera no Level 20; Especialização no Rank II;
 * Despertar I exige Maestria 25.
 */
export const JOURNEY_MISSIONS: readonly MissionDefinition[] = [
  journey('journey-player-level-5', 'Primeiros Passos', 'Alcance o nível de conta 5.', { type: 'playerLevel', value: 5 }, 'journey-capture-1', 80),
  journey('journey-capture-1', 'Novo Companheiro', 'Recrute seu primeiro personagem (além do inicial).', { type: 'uniqueCharacters', value: 2 }, 'journey-unique-3', 100),
  journey('journey-unique-3', 'Formando a Equipe', 'Possua 3 personagens diferentes.', { type: 'uniqueCharacters', value: 3 }, 'journey-player-level-10', 120),
  journey('journey-player-level-10', 'Nível 10', 'Alcance o nível de conta 10.', { type: 'playerLevel', value: 10 }, 'journey-stars-1', 140),
  journey('journey-stars-1', 'Primeira Estrela', 'Evolua um personagem para 1★.', { type: 'characterStars', value: 1 }, 'journey-mastery-10', 150),
  journey('journey-mastery-10', 'Início da Maestria', 'Alcance Maestria 10 com um personagem.', { type: 'characterMastery', value: 10 }, 'journey-unique-5', 160),
  journey('journey-unique-5', 'Coleção Inicial', 'Possua 5 personagens diferentes.', { type: 'uniqueCharacters', value: 5 }, 'journey-player-level-20', 180),
  journey('journey-player-level-20', 'Nível 20', 'Alcance o nível de conta 20.', { type: 'playerLevel', value: 20 }, 'journey-lineage-selected', 200),
  journey('journey-lineage-selected', 'Escolha de Linhagem', 'Escolha sua Linhagem.', { type: 'lineageSelected' }, 'journey-lineage-rank-2', 220),
  journey('journey-lineage-rank-2', 'Graduação II', 'Alcance Rank II da sua Linhagem.', { type: 'lineageRank', value: 2 }, 'journey-spec-selected', 250),
  journey('journey-spec-selected', 'Caminho da Especialização', 'Escolha sua Especialização.', { type: 'specializationSelected' }, 'journey-spec-level-2', 260),
  journey('journey-spec-level-2', 'Especialização II', 'Alcance Especialização II.', { type: 'specializationLevel', value: 2 }, 'journey-stars-3', 280),
  journey('journey-stars-3', 'Três Estrelas', 'Evolua um personagem para 3★.', { type: 'characterStars', value: 3 }, 'journey-mastery-25', 300),
  journey('journey-mastery-25', 'Maestria 25', 'Alcance Maestria 25 com um personagem.', { type: 'characterMastery', value: 25 }, 'journey-awakening-1', 320),
  journey('journey-awakening-1', 'Primeiro Despertar', 'Realize seu primeiro Despertar.', { type: 'awakeningLevel', value: 1 }, 'journey-player-level-40', 350),
  journey('journey-player-level-40', 'Nível 40', 'Alcance o nível de conta 40.', { type: 'playerLevel', value: 40 }, 'journey-lineage-rank-3', 380),
  journey('journey-lineage-rank-3', 'Graduação III', 'Alcance Rank III da sua Linhagem.', { type: 'lineageRank', value: 3 }, 'journey-mastery-50', 400),
  journey('journey-mastery-50', 'Maestria 50', 'Alcance Maestria 50 com um personagem.', { type: 'characterMastery', value: 50 }, 'journey-spec-level-3', 420),
  journey('journey-spec-level-3', 'Especialização III', 'Alcance Especialização III.', { type: 'specializationLevel', value: 3 }, 'journey-unique-25', 450),
  journey('journey-unique-25', 'Coleção Ampla', 'Possua 25 personagens diferentes.', { type: 'uniqueCharacters', value: 25 }, 'journey-player-level-70', 480),
  journey('journey-player-level-70', 'Nível 70', 'Alcance o nível de conta 70.', { type: 'playerLevel', value: 70 }, 'journey-lineage-rank-4', 500),
  journey('journey-lineage-rank-4', 'Graduação Máxima', 'Alcance Rank IV da sua Linhagem.', { type: 'lineageRank', value: 4 }, undefined, 600),
];

export const JOURNEY_START_ID = JOURNEY_MISSIONS[0]?.id ?? 'journey-player-level-5';

const ALL: MissionDefinition[] = [
  ...DAILY_MISSION_POOL,
  ...WEEKLY_MISSION_POOL,
  ...JOURNEY_MISSIONS,
];

export function listMissionDefinitions(): readonly MissionDefinition[] {
  return ALL;
}

export function getMissionDefinition(id: string): MissionDefinition | null {
  return ALL.find((row) => row.id === id) ?? null;
}

export function listDailyMissionPool(): readonly MissionDefinition[] {
  return DAILY_MISSION_POOL;
}

export function listWeeklyMissionPool(): readonly MissionDefinition[] {
  return WEEKLY_MISSION_POOL;
}

export function listJourneyMissions(): readonly MissionDefinition[] {
  return JOURNEY_MISSIONS;
}

export function journeyStageIndex(missionId: string | null): number {
  if (!missionId) return 0;
  const idx = JOURNEY_MISSIONS.findIndex((row) => row.id === missionId);
  return idx >= 0 ? idx + 1 : 0;
}
