import {
  CHARACTER_SKILL_AREA_RADIUS,
  CHARACTER_SKILL_COOLDOWNS_MS,
  CHARACTER_SKILL_DAMAGE,
  CHARACTER_SKILL_LEVELS,
} from '@/constants/skill';
import { WONSR_JUTSU_REFERENCE, type WonsrJutsuReference } from '@/data/wonsr-jutsu-reference';
import type { SkillAnimationKind, SkillDefinition, SkillElement } from '@/types/skill';

const ELEMENT_ANIMATION: Record<SkillElement, SkillAnimationKind> = {
  physical: 'slash',
  fire: 'burst',
  water: 'projectile',
  wind: 'slash',
  earth: 'aura',
  lightning: 'beam',
  ice: 'projectile',
  dark: 'aura',
  light: 'burst',
  energy: 'beam',
  magic: 'aura',
  yin: 'aura',
  yang: 'burst',
  neutral: 'slash',
};

const EXCLUDED_SLUGS = new Set(['all', 'todos', 'summons', 'bijuu']);

function combatPriority(jutsu: WonsrJutsuReference): number {
  if (jutsu.aggressive && jutsu.needtarget) return 0;
  if (jutsu.aggressive) return 1;
  if (jutsu.needtarget) return 2;
  return 3;
}

function selectFour(entries: readonly WonsrJutsuReference[]): WonsrJutsuReference[] {
  if (entries.length === 0) return [];
  const ordered = [...entries].sort(
    (a, b) => combatPriority(a) - combatPriority(b) || a.level - b.level || a.name.localeCompare(b.name),
  );
  const selected: WonsrJutsuReference[] = [];
  for (let index = 0; index < 4; index += 1) {
    const sourceIndex =
      ordered.length <= 4 ? Math.min(index, ordered.length - 1) : Math.round((index / 3) * (ordered.length - 1));
    selected.push(ordered[sourceIndex]);
  }
  return selected;
}

const referencesByCharacter = new Map<string, WonsrJutsuReference[]>();
for (const jutsu of WONSR_JUTSU_REFERENCE) {
  if (EXCLUDED_SLUGS.has(jutsu.character)) continue;
  const entries = referencesByCharacter.get(jutsu.character) ?? [];
  entries.push(jutsu);
  referencesByCharacter.set(jutsu.character, entries);
}

const skillIdsByCharacter: Record<string, readonly string[]> = {};
const definitions: SkillDefinition[] = [];

for (const [character, entries] of referencesByCharacter) {
  const selected = selectFour(entries);
  const ids = selected.map((jutsu, index) => {
    const id = `character-${character}-skill-${index + 1}`;
    const isArea = index >= 2;
    definitions.push({
      id,
      name: jutsu.name,
      element: jutsu.element,
      requiredLevel: CHARACTER_SKILL_LEVELS[index],
      cooldownMs: CHARACTER_SKILL_COOLDOWNS_MS[index],
      damage: CHARACTER_SKILL_DAMAGE[index],
      icon: `/sprites/skills/${jutsu.element}.svg`,
      animation: {
        kind: isArea ? 'burst' : ELEMENT_ANIMATION[jutsu.element],
        durationMs: isArea ? 460 : 320,
        scale: isArea ? 1.25 : 1,
      },
      range: jutsu.range ? Math.max(64, jutsu.range * 32) : 80,
      areaRadius: isArea ? CHARACTER_SKILL_AREA_RADIUS : undefined,
      description: `${jutsu.name} · libera no nível ${CHARACTER_SKILL_LEVELS[index]}.${
        isArea ? ' Causa dano em área.' : ''
      }`,
    });
    return id;
  });
  skillIdsByCharacter[character] = ids;
}

const GENERIC_ELEMENTS: readonly SkillElement[] = ['neutral', 'wind', 'fire', 'lightning'];
export const GENERIC_CHARACTER_SKILL_IDS = CHARACTER_SKILL_LEVELS.map(
  (_, index) => `character-generic-skill-${index + 1}`,
);

GENERIC_CHARACTER_SKILL_IDS.forEach((id, index) => {
  const element = GENERIC_ELEMENTS[index];
  const isArea = index >= 2;
  definitions.push({
    id,
    name: ['Kunai Rápida', 'Rajada de Chakra', 'Explosão de Chakra', 'Grande Onda de Chakra'][index],
    element,
    requiredLevel: CHARACTER_SKILL_LEVELS[index],
    cooldownMs: CHARACTER_SKILL_COOLDOWNS_MS[index],
    damage: CHARACTER_SKILL_DAMAGE[index],
    icon: `/sprites/skills/${element}.svg`,
    animation: { kind: isArea ? 'burst' : ELEMENT_ANIMATION[element], durationMs: 360, scale: isArea ? 1.25 : 1 },
    range: 88,
    areaRadius: isArea ? CHARACTER_SKILL_AREA_RADIUS : undefined,
    description: `Técnica neutra · libera no nível ${CHARACTER_SKILL_LEVELS[index]}.${
      isArea ? ' Causa dano em área.' : ''
    }`,
  });
});

export const CHARACTER_PROGRESSION_SKILL_DEFINITIONS: readonly SkillDefinition[] = definitions;

export function getCharacterProgressionSkillIds(characterSlug: string): readonly string[] {
  return skillIdsByCharacter[characterSlug] ?? GENERIC_CHARACTER_SKILL_IDS;
}
