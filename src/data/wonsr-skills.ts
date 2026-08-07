import { WONSR_JUTSU_REFERENCE } from '@/data/wonsr-jutsu-reference';
import type { SkillAnimationKind, SkillDefinition, SkillElement } from '@/types/skill';

const ELEMENT_ANIMATION: Record<SkillElement, SkillAnimationKind> = {
  fire: 'burst',
  water: 'projectile',
  wind: 'slash',
  earth: 'aura',
  lightning: 'beam',
  yin: 'aura',
  yang: 'burst',
  neutral: 'slash',
};

/**
 * Jutsus WONSR normalizados para o runtime Phaser.
 * Permanecem bloqueados até serem aprendidos por missão/progressão.
 */
export const WONSR_SKILL_DEFINITIONS: readonly SkillDefinition[] =
  WONSR_JUTSU_REFERENCE.map((jutsu) => ({
    id: jutsu.id,
    name: jutsu.name,
    element: jutsu.element,
    cooldownMs: Math.max(1200, jutsu.cooldownMs),
    damage: Math.max(10, jutsu.damage),
    icon: `/sprites/skills/${jutsu.element}.svg`,
    animation: {
      kind: ELEMENT_ANIMATION[jutsu.element],
      durationMs: 320,
      scale: 1,
    },
    range: jutsu.range ? Math.max(48, jutsu.range * 32) : 72,
    description:
      `Técnica WONSR de ${jutsu.character}.` +
      (jutsu.words ? ` Comando original: ${jutsu.words}.` : ''),
  }));
