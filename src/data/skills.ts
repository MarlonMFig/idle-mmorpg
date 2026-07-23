import type { SkillDefinition, SkillElement } from '@/types/skill';
import type { StarterCharacterId } from '@/types/player-creation';
import { getCharacterPack } from '@/data/character-packs';

/**
 * Catálogo de jutsus (Naruto + Sasuke).
 * A hotbar ativa vem do character pack do starter.
 */
const SKILL_LIST: SkillDefinition[] = [
  // —— Naruto ——
  {
    id: 'skill-rasengan',
    name: 'Rasengan',
    element: 'wind',
    cooldownMs: 4500,
    damage: 40,
    icon: '/sprites/skills/chakra-pulse.png',
    animation: { kind: 'character', durationMs: 800, scale: 1 },
    range: 64,
    description: 'Esfera de chakra giratória.',
  },
  {
    id: 'skill-sexy-jutsu',
    name: 'Jutsu Sexy',
    element: 'yang',
    cooldownMs: 5000,
    damage: 28,
    icon: '/sprites/skills/sexy-jutsu.png',
    animation: { kind: 'character', durationMs: 1900, scale: 1 },
    range: 72,
    description: 'Oiroke no Jutsu.',
  },
  // —— Sasuke ——
  {
    id: 'skill-chidori',
    name: 'Chidori',
    element: 'lightning',
    cooldownMs: 4200,
    damage: 42,
    icon: '/sprites/skills/sasuke-chidori.png?v=7',
    animation: { kind: 'character', durationMs: 2100, scale: 1 },
    range: 70,
    description: 'Lâmina de relâmpago na mão.',
  },
  {
    id: 'skill-hosenka',
    name: 'Housenka',
    element: 'fire',
    cooldownMs: 3600,
    damage: 34,
    icon: '/sprites/skills/sasuke-hosenka.png?v=7',
    animation: { kind: 'character', durationMs: 1100, scale: 1 },
    range: 120,
    description: 'Katon: Flor da Fênix.',
  },
];

export type SkillId = (typeof SKILL_LIST)[number]['id'];

export const SKILLS: Record<string, SkillDefinition> = Object.fromEntries(
  SKILL_LIST.map((skill) => [skill.id, skill]),
);

export const SKILL_DEFINITIONS: readonly SkillDefinition[] = SKILL_LIST;

/** @deprecated Use getHotbarSkillIdsForStarter — mantido para defaults Naruto. */
export const STARTER_HOTBAR_SKILL_IDS: readonly string[] = getCharacterPack(
  'naruto-classic',
).hotbarSkillIds;

export const STARTER_KNOWN_SKILL_IDS: readonly string[] = SKILL_DEFINITIONS.map((s) => s.id);

export function getHotbarSkillIdsForStarter(starterId: StarterCharacterId): readonly string[] {
  return getCharacterPack(starterId).hotbarSkillIds;
}

export function getSkill(skillId: string): SkillDefinition | undefined {
  return SKILLS[skillId];
}

export function listSkillsByElement(element: SkillElement): SkillDefinition[] {
  return SKILL_DEFINITIONS.filter((skill) => skill.element === element);
}
