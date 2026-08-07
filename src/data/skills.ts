import type { SkillDefinition, SkillElement } from '@/types/skill';
import type { StarterCharacterId } from '@/types/player-creation';
import {
  CHARACTER_SKILL_AREA_RADIUS,
  CHARACTER_SKILL_COOLDOWNS_MS,
  CHARACTER_SKILL_DAMAGE,
  CHARACTER_SKILL_LEVELS,
} from '@/constants/skill';
import { getCharacterPack } from '@/data/character-packs';
import { CHARACTER_PROGRESSION_SKILL_DEFINITIONS } from '@/data/character-skill-progression';
import { WONSR_SKILL_DEFINITIONS } from '@/data/wonsr-skills';

/**
 * Catálogo vivo de jutsus.
 * Curado a partir de `nto-jutsu-reference.ts` (servidor NTO War Legends).
 * Dano/cooldown/alcance retunados para o idle MMORPG — não copiam os valores TFS.
 * Iniciais começam sem nenhum (só ataque básico).
 */
const SKILL_LIST: SkillDefinition[] = [
  {
    id: 'skill-kunai',
    name: 'Kunai',
    element: 'neutral',
    cooldownMs: 2800,
    damage: 22,
    icon: '/sprites/skills/neutral.svg',
    animation: { kind: 'projectile', durationMs: 320, scale: 0.9 },
    range: 90,
    description: 'Arremesso básico de kunai. (NTO: Throw Kunai no jutsu)',
  },
  {
    id: 'skill-shuriken',
    name: 'Shuriken',
    element: 'neutral',
    cooldownMs: 3200,
    damage: 26,
    icon: '/sprites/skills/neutral.svg',
    animation: { kind: 'projectile', durationMs: 300, scale: 0.85 },
    range: 100,
    description: 'Arremesso de shuriken. (NTO: Throw Shuriken no jutsu)',
  },
  {
    id: 'skill-katon-gokakyu',
    name: 'Katon: Goukakyuu',
    element: 'fire',
    cooldownMs: 4200,
    damage: 34,
    icon: '/sprites/skills/fire.svg',
    // Sem sheet no pack → burst genérico; Sasuke sobrescreve via skillAnims.
    animation: { kind: 'burst', durationMs: 420, scale: 1.1 },
    range: 72,
    description: 'Grande bola de fogo. (NTO: Katon Gokakyu no Jutsu)',
  },
  {
    id: 'skill-katon-ryuka',
    name: 'Katon: Ryuuka',
    element: 'fire',
    cooldownMs: 4800,
    damage: 40,
    icon: '/sprites/skills/fire.svg',
    animation: { kind: 'beam', durationMs: 380, scale: 1.0 },
    range: 88,
    description: 'Dragão de chamas. (NTO: Katon Ryuka no Jutsu)',
  },
  {
    id: 'skill-raiton-kudaru',
    name: 'Raiton: Kudaru',
    element: 'lightning',
    cooldownMs: 4000,
    damage: 36,
    icon: '/sprites/skills/lightning.svg',
    animation: { kind: 'beam', durationMs: 340, scale: 0.95 },
    range: 84,
    description: 'Descarga de raios. (NTO: Raiton no kudaru)',
  },
  {
    id: 'skill-chidori',
    name: 'Chidori',
    element: 'lightning',
    requiredLevel: 1,
    cooldownMs: 4500,
    damage: 24,
    icon: '/sprites/skills/lightning.svg',
    animation: { kind: 'character', durationMs: 2357, scale: 1 },
    range: 64,
    description: 'Lâmina de relâmpago em alta velocidade. (NTO: Chidori)',
  },
  {
    id: 'skill-chidori-nagashi',
    name: 'Chidori Nagashi',
    element: 'lightning',
    requiredLevel: 5,
    cooldownMs: 2800,
    damage: 36,
    icon: '/sprites/skills/lightning.svg',
    animation: { kind: 'aura', durationMs: 520, scale: 1.15 },
    range: 68,
    description: 'Descarga de Chidori ao redor do alvo.',
  },
  {
    id: 'skill-suiton-suiryudan',
    name: 'Suiton: Suiryudan',
    element: 'water',
    cooldownMs: 5000,
    damage: 42,
    icon: '/sprites/skills/water.svg',
    animation: { kind: 'projectile', durationMs: 400, scale: 1.05 },
    range: 96,
    description: 'Dragão de água. (NTO: Suiton Suiryudan no Jutsu)',
  },
  {
    id: 'skill-fuuton-arizukokku',
    name: 'Fuuton: Arizukokku',
    element: 'wind',
    cooldownMs: 4600,
    damage: 38,
    icon: '/sprites/skills/wind.svg',
    animation: { kind: 'slash', durationMs: 320, scale: 1.0 },
    range: 80,
    description: 'Lâminas de vento. (NTO: Fuuton Arizukokku)',
  },
  {
    id: 'skill-sabaku-kyu',
    name: 'Sabaku Kyuu',
    element: 'earth',
    cooldownMs: 5200,
    damage: 44,
    icon: '/sprites/skills/earth.svg',
    animation: { kind: 'aura', durationMs: 480, scale: 1.2 },
    range: 70,
    description: 'Prisão de areia. (NTO: Sabaku Kyu)',
  },
  {
    id: 'skill-juuken',
    name: 'Juuken',
    element: 'yang',
    cooldownMs: 3600,
    damage: 30,
    icon: '/sprites/skills/yang.svg',
    animation: { kind: 'slash', durationMs: 280, scale: 0.95 },
    range: 56,
    description: 'Punho gentil do Hyuuga. (NTO: Juuken)',
  },
  {
    id: 'skill-konoha-senpu',
    name: 'Konoha Senpu',
    element: 'neutral',
    requiredLevel: 1,
    cooldownMs: 7000,
    damage: 32,
    icon: '/sprites/skills/neutral.svg',
    animation: { kind: 'slash', durationMs: 320, scale: 1.05 },
    range: 58,
    description: 'Chute giratório característico de Rock Lee.',
  },
  {
    id: 'skill-omote-renge',
    name: 'Omote Renge',
    element: 'yang',
    requiredLevel: 5,
    cooldownMs: 9000,
    damage: 36,
    icon: '/sprites/skills/yang.svg',
    animation: { kind: 'slash', durationMs: 420, scale: 1.2 },
    range: 60,
    description: 'Lótus frontal — taijutsu explosivo. (NTO: Omote Renge)',
  },
  {
    id: 'skill-hakke-kaiten',
    name: 'Kaiten',
    element: 'yin',
    requiredLevel: 1,
    cooldownMs: 11000,
    damage: 36,
    icon: '/sprites/skills/yin.svg',
    animation: { kind: 'character', durationMs: 5000, scale: 1 },
    range: 72,
    areaRadius: 56,
    description:
      'Palma Rotatória do Céu — rotação defensiva dos Oito Trigramas com cúpula de chakra. (NTO: Hakkeshou Kaiten)',
  },
  {
    id: 'skill-rasengan',
    name: 'Rasengan',
    element: 'yang',
    requiredLevel: 1,
    cooldownMs: 4000,
    damage: 24,
    icon: '/sprites/skills/yang.svg',
    animation: { kind: 'character', durationMs: 2600, scale: 1 },
    range: 64,
    description: 'Esfera de chakra giratória. (NTO: Rasengan)',
  },
  {
    id: 'skill-oodama-rasengan',
    name: 'Oodama Rasengan',
    element: 'yang',
    requiredLevel: 5,
    cooldownMs: 8000,
    damage: 36,
    icon: '/sprites/skills/yang.svg',
    animation: { kind: 'burst', durationMs: 620, scale: 1.3 },
    range: 68,
    description: 'Uma versão ampliada e mais destrutiva do Rasengan.',
  },
  {
    id: 'skill-kurama-mode',
    name: 'Modo Kurama',
    element: 'fire',
    requiredLevel: CHARACTER_SKILL_LEVELS[3],
    cooldownMs: CHARACTER_SKILL_COOLDOWNS_MS[3],
    damage: CHARACTER_SKILL_DAMAGE[3],
    icon: '/sprites/skills/fire.svg',
    animation: { kind: 'character', durationMs: 2050, scale: 1 },
    range: 96,
    areaRadius: CHARACTER_SKILL_AREA_RADIUS,
    description: 'Manto da Kyuubi e a investida da Raposa de Nove Caudas. Causa dano em área.',
  },
  {
    id: 'skill-hosenka',
    name: 'Housenka',
    element: 'fire',
    cooldownMs: 3600,
    damage: 34,
    icon: '/sprites/skills/fire.svg',
    animation: { kind: 'character', durationMs: 1100, scale: 1 },
    range: 120,
    description: 'Katon: Flor da Fênix.',
  },
  {
    id: 'skill-explosion-kunai',
    name: 'Kunai Explosiva',
    element: 'fire',
    requiredLevel: 5,
    cooldownMs: 5500,
    damage: 36,
    icon: '/sprites/skills/fire.svg',
    animation: { kind: 'character', durationMs: 1400, scale: 1 },
    range: 110,
    description: 'Arremessa kunai com selo explosivo no alvo — Jutsu do Shikamaru.',
  },
  {
    id: 'skill-hakke-kusho',
    name: 'Hakke Kūshō',
    element: 'yang',
    requiredLevel: 1,
    cooldownMs: 4500,
    damage: 28,
    icon: '/sprites/skills/yang.svg',
    animation: { kind: 'character', durationMs: 1083, scale: 1 },
    range: 88,
    description: 'Palma do Vácuo dos Oito Trigramas — Jutsu 1 do Neji.',
  },
  {
    id: 'skill-rokujuyon-sho',
    name: 'Hakke Rokujūyon Shō',
    element: 'yang',
    requiredLevel: 5,
    cooldownMs: 7000,
    damage: 40,
    icon: '/sprites/skills/yang.svg',
    animation: { kind: 'character', durationMs: 917, scale: 1 },
    range: 72,
    description: 'Sessenta e quatro palmas — Jutsu 2 do Neji.',
  },
  {
    id: 'skill-sand-prison',
    name: 'Sabaku Kyū',
    element: 'earth',
    requiredLevel: 1,
    cooldownMs: 6500,
    damage: 40,
    icon: '/sprites/skills/earth.svg',
    animation: { kind: 'character', durationMs: 2273, scale: 1 },
    range: 110,
    description: 'Prisão de areia — Gaara reúne areia, encerra e esmaga o alvo.',
  },
  {
    id: 'skill-chou-bakou',
    name: 'Chou Ba-Kou Fuusou',
    element: 'yang',
    requiredLevel: 1,
    cooldownMs: 4500,
    damage: 30,
    icon: '/sprites/skills/yang.svg',
    animation: { kind: 'character', durationMs: 1000, scale: 1 },
    range: 88,
    description: 'Força sobre-humana — Jutsu 1 da Sakura.',
  },
  {
    id: 'skill-chakra-strength',
    name: 'Byakugō no In',
    element: 'yang',
    requiredLevel: 5,
    cooldownMs: 7500,
    damage: 42,
    icon: '/sprites/skills/yang.svg',
    animation: { kind: 'character', durationMs: 1000, scale: 1 },
    range: 80,
    description: 'Força chakra aprimorada — Jutsu 2 da Sakura.',
  },
  {
    id: 'skill-nikudan-sensha',
    name: 'Nikudan Sensha',
    element: 'yang',
    requiredLevel: 1,
    cooldownMs: 6000,
    damage: 36,
    icon: '/sprites/skills/yang.svg',
    animation: { kind: 'character', durationMs: 2083, scale: 1 },
    range: 100,
    description: 'Bala Humana — Jutsu 1 do Chouji (selos → expansão → giro).',
  },
  {
    id: 'skill-hakke-shouhou',
    name: 'Hakke Shōhō',
    element: 'yang',
    requiredLevel: 1,
    cooldownMs: 7000,
    damage: 40,
    icon: '/sprites/skills/yang.svg',
    animation: { kind: 'character', durationMs: 2583, scale: 1 },
    range: 92,
    description:
      'Palmas do Oito Trigramas — jutsu da Hinata (postura → rajada de dash Jūken → impacto).',
  },
];

export type SkillId = (typeof SKILL_LIST)[number]['id'];

export const SKILL_DEFINITIONS: readonly SkillDefinition[] = [
  ...SKILL_LIST,
  ...CHARACTER_PROGRESSION_SKILL_DEFINITIONS,
  ...WONSR_SKILL_DEFINITIONS.filter((skill) => !SKILL_LIST.some((base) => base.id === skill.id)),
];

export const SKILLS: Record<string, SkillDefinition> = Object.fromEntries(
  SKILL_DEFINITIONS.map((skill) => [skill.id, skill]),
);

/** Hotbar default = pack do Naruto (compat). */
export const STARTER_HOTBAR_SKILL_IDS: readonly string[] =
  getCharacterPack('naruto-classic').hotbarSkillIds;

export const STARTER_KNOWN_SKILL_IDS: readonly string[] = SKILL_DEFINITIONS.map(
  (skill) => skill.id,
);

export function getHotbarSkillIdsForStarter(
  starterId: StarterCharacterId,
): readonly string[] {
  return getCharacterPack(starterId).hotbarSkillIds;
}

export function getSkill(skillId: string): SkillDefinition | undefined {
  return SKILLS[skillId];
}

export function listSkillsByElement(element: SkillElement): SkillDefinition[] {
  return SKILL_DEFINITIONS.filter((skill) => skill.element === element);
}
