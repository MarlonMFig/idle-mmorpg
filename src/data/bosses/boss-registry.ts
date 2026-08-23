import { POTION_ITEM_IDS } from '@/config/gameConfig';
import { MAP_KEYS } from '@/maps/map-registry';
import { GUILD_BOSS_BOSS_ID } from '@/constants/guild-boss';
import { WORLD_BOSS_BOSS_ID } from '@/constants/world-boss';
import type { BossDefinition } from '@/types/boss';

/** Único Boss temporário deste item — balanceamento inicial. */
export const TEST_BOSS_ID = 'boss-training-dummy';

export const BOSS_DEFINITIONS: readonly BossDefinition[] = [
  {
    id: TEST_BOSS_ID,
    name: 'Boss de Teste',
    level: 12,
    lookType: 9080,
    mapKey: MAP_KEYS.huntCampoTreinamento,
    hp: 6000,
    speed: 42,
    xp: 0,
    skills: ['skill-kunai', 'skill-shuriken', 'skill-katon-gokakyu', 'skill-chidori'],
    elements: ['physical', 'fire', 'lightning'],
    resistances: { fire: 0.15 },
    immunities: [],
    statusImmunities: [],
    timeLimit: 180_000,
    attemptRules: {
      maxAttempts: 3,
      resetType: 'daily',
      abandonConsumesAttempt: true,
    },
    entryCost: [],
    phases: [
      {
        id: 'phase-1',
        hpThreshold: 1,
        skillOverrides: ['skill-kunai', 'skill-shuriken', 'skill-katon-gokakyu', 'skill-chidori'],
      },
      {
        id: 'phase-2',
        hpThreshold: 0.5,
        skillOverrides: ['skill-katon-ryuka', 'skill-raiton-kudaru', 'skill-raikiri', 'skill-amaterasu'],
        statModifiers: { damageMul: 1.15 },
      },
    ],
    rewards: [
      { type: 'copper', amount: 220 },
      { type: 'item', id: POTION_ITEM_IDS.normal, amount: 1 },
    ],
    firstClearReward: [{ type: 'copper', amount: 80 }],
    eligibility: { playerLevel: 1 },
    rankingMode: 'fastestKill',
    rewardsDev: true,
  },
  /**
   * Guild Boss semanal — combat/phases via Boss System.
   * HP compartilhado autoritativo: GuildBossState.
   */
  {
    id: GUILD_BOSS_BOSS_ID,
    name: 'Guild Boss — Titã Semanal (DEV)',
    level: 30,
    lookType: 9080,
    mapKey: MAP_KEYS.huntCampoTreinamento,
    hp: 100_000_000,
    speed: 38,
    xp: 0,
    skills: ['skill-kunai', 'skill-shuriken', 'skill-katon-gokakyu', 'skill-chidori'],
    elements: ['physical', 'fire'],
    resistances: { fire: 0.1 },
    immunities: [],
    statusImmunities: [],
    timeLimit: 120_000,
    attemptRules: {
      maxAttempts: null,
      resetType: 'none',
      abandonConsumesAttempt: true,
    },
    entryCost: [],
    phases: [
      {
        id: 'phase-1',
        hpThreshold: 1,
        skillOverrides: ['skill-kunai', 'skill-shuriken', 'skill-katon-gokakyu', 'skill-chidori'],
      },
      {
        id: 'phase-2',
        hpThreshold: 0.75,
        skillOverrides: ['skill-katon-ryuka', 'skill-raiton-kudaru', 'skill-raikiri', 'skill-amaterasu'],
        statModifiers: { damageMul: 1.1 },
      },
      {
        id: 'phase-3',
        hpThreshold: 0.5,
        skillOverrides: ['skill-amaterasu', 'skill-raikiri', 'skill-katon-gokakyu', 'skill-chidori'],
        statModifiers: { damageMul: 1.2 },
      },
      {
        id: 'phase-4',
        hpThreshold: 0.25,
        skillOverrides: ['skill-amaterasu', 'skill-raikiri', 'skill-katon-ryuka', 'skill-chidori'],
        statModifiers: { damageMul: 1.35 },
      },
    ],
    rewards: [],
    eligibility: { playerLevel: 1 },
    rankingMode: 'highestDamage',
    rewardsDev: true,
  },
  /**
   * World Boss semanal — combat/phases via Boss System.
   * HP global autoritativo: WorldBossCycle (backend).
   */
  {
    id: WORLD_BOSS_BOSS_ID,
    name: 'World Boss — Colosso Semanal (DEV)',
    level: 40,
    lookType: 9080,
    mapKey: MAP_KEYS.huntCampoTreinamento,
    hp: 10_000_000_000,
    speed: 40,
    xp: 0,
    skills: ['skill-kunai', 'skill-shuriken', 'skill-katon-gokakyu', 'skill-chidori'],
    elements: ['physical', 'fire', 'lightning'],
    resistances: { fire: 0.12 },
    immunities: [],
    statusImmunities: [],
    timeLimit: 120_000,
    attemptRules: {
      maxAttempts: null,
      resetType: 'none',
      abandonConsumesAttempt: true,
    },
    entryCost: [],
    phases: [
      {
        id: 'phase-1',
        hpThreshold: 1,
        skillOverrides: ['skill-kunai', 'skill-shuriken', 'skill-katon-gokakyu', 'skill-chidori'],
      },
      {
        id: 'phase-2',
        hpThreshold: 0.75,
        skillOverrides: ['skill-katon-ryuka', 'skill-raiton-kudaru', 'skill-raikiri', 'skill-amaterasu'],
        statModifiers: { damageMul: 1.1 },
      },
      {
        id: 'phase-3',
        hpThreshold: 0.5,
        skillOverrides: ['skill-amaterasu', 'skill-raikiri', 'skill-katon-gokakyu', 'skill-chidori'],
        statModifiers: { damageMul: 1.25 },
      },
      {
        id: 'phase-4',
        hpThreshold: 0.25,
        skillOverrides: ['skill-amaterasu', 'skill-raikiri', 'skill-katon-ryuka', 'skill-chidori'],
        statModifiers: { damageMul: 1.4 },
      },
    ],
    rewards: [],
    eligibility: { playerLevel: 1 },
    rankingMode: 'highestDamage',
    rewardsDev: true,
  },
];

export function listBossDefinitions(): readonly BossDefinition[] {
  return BOSS_DEFINITIONS;
}

export function getBossDefinition(id: string): BossDefinition | null {
  return BOSS_DEFINITIONS.find((row) => row.id === id) ?? null;
}

/** Painel Bosses (solo) — exclui Guild Boss e World Boss. */
export function listSoloBossDefinitions(): readonly BossDefinition[] {
  return BOSS_DEFINITIONS.filter(
    (row) => row.id !== GUILD_BOSS_BOSS_ID && row.id !== WORLD_BOSS_BOSS_ID,
  );
}
