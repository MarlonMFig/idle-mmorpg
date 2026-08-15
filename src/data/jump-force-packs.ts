/**
 * Auto-generated Jump Force MUGEN packs. Do not edit by hand.
 * npm run jf:roster && npm run jf:client
 */
import type { CharacterPack } from '@/data/character-packs';
import {
  CHARACTER_SKILL_AREA_RADIUS,
  CHARACTER_SKILL_COOLDOWNS_MS,
  CHARACTER_SKILL_DAMAGE,
  CHARACTER_SKILL_LEVELS,
} from '@/constants/skill';
import type { SkillDefinition } from '@/types/skill';

export const ICHIGO_LOOK_TYPE = 9073;

export const JUMP_FORCE_LOOK_TYPES = [
  9073,
] as const;

const ICHIGO_PACK: CharacterPack = {
  id: 'ichigo',
  idle: {
    key: 'ichigo-idle',
    url: '/sprites/player/ichigo/idle.png',
    frameWidth: 75,
    frameHeight: 55,
    frameCount: 8,
    contentHeight: 51,
    originX: 0.373,
    frameRate: 8,
  },
  walk: {
    key: 'ichigo-walk',
    url: '/sprites/player/ichigo/walk.png',
    frameWidth: 85,
    frameHeight: 48,
    frameCount: 8,
    contentHeight: 51,
    originX: 0.412,
    frameRate: 12,
  },
  attack: {
    key: 'ichigo-combo1',
    url: '/sprites/player/ichigo/combo1.png',
    frameWidth: 94,
    frameHeight: 51,
    frameCount: 7,
    contentHeight: 51,
    originX: 0.617,
    frameRate: 12,
  },
  attackChain: [
    {
    key: 'ichigo-combo1',
    url: '/sprites/player/ichigo/combo1.png',
    frameWidth: 94,
    frameHeight: 51,
    frameCount: 7,
    contentHeight: 51,
    originX: 0.617,
    frameRate: 12,
  },
    {
    key: 'ichigo-combo2',
    url: '/sprites/player/ichigo/combo2.png',
    frameWidth: 105,
    frameHeight: 84,
    frameCount: 7,
    contentHeight: 51,
    originX: 0.429,
    frameRate: 12,
  },
    {
    key: 'ichigo-combo3',
    url: '/sprites/player/ichigo/combo3.png',
    frameWidth: 112,
    frameHeight: 58,
    frameCount: 7,
    contentHeight: 51,
    originX: 0.429,
    frameRate: 12,
  },
  ],
  hurt: {
    key: 'ichigo-hurt',
    url: '/sprites/player/ichigo/hurt.png',
    frameWidth: 66,
    frameHeight: 49,
    frameCount: 3,
    contentHeight: 51,
    originX: 0.409,
    frameRate: 10,
  },
  death: {
    key: 'ichigo-death',
    url: '/sprites/player/ichigo/death.png',
    frameWidth: 68,
    frameHeight: 44,
    frameCount: 3,
    contentHeight: 51,
    originX: 0.574,
    frameRate: 8,
  },
  skillAnims: {
    'skill-ichigo-1': {
      key: 'ichigo-special1',
      url: '/sprites/player/ichigo/special1.png',
      frameWidth: 105,
      frameHeight: 105,
      frameCount: 13,
      contentHeight: 51,
      originX: 0.476,
      frameRate: 18,
      durationMs: 717,
      hitDelayMs: 317,
      fxReleaseMs: 317,
      fxAttach: 'target' as const,
      fxGround: false as const,
      fx: {
        key: 'ichigo-special1-fx',
        url: '/sprites/player/ichigo/special1-fx.png',
        frameWidth: 529,
        frameHeight: 309,
        frameCount: 11,
        contentHeight: 305,
      },
    },
    'skill-ichigo-2': {
      key: 'ichigo-special2',
      url: '/sprites/player/ichigo/special2.png',
      frameWidth: 107,
      frameHeight: 87,
      frameCount: 12,
      contentHeight: 51,
      originX: 0.533,
      frameRate: 14,
      durationMs: 850,
      hitDelayMs: 383,
      fxReleaseMs: 383,
      fxAttach: 'target' as const,
      fxGround: false as const,
      fx: {
        key: 'ichigo-special2-fx',
        url: '/sprites/player/ichigo/special2-fx.png',
        frameWidth: 577,
        frameHeight: 240,
        frameCount: 12,
        contentHeight: 236,
      },
    },
    'skill-ichigo-3': {
      key: 'ichigo-special3',
      url: '/sprites/player/ichigo/special3.png',
      frameWidth: 116,
      frameHeight: 105,
      frameCount: 13,
      contentHeight: 51,
      originX: 0.543,
      frameRate: 11,
      durationMs: 1133,
      hitDelayMs: 533,
      fxReleaseMs: 533,
      fxAttach: 'caster' as const,
      fxGround: false as const,
      fx: {
        key: 'ichigo-special3-fx',
        url: '/sprites/player/ichigo/special3-fx.png',
        frameWidth: 249,
        frameHeight: 213,
        frameCount: 18,
        contentHeight: 209,
      },
    },
    'skill-ichigo-4': {
      key: 'ichigo-special4',
      url: '/sprites/player/ichigo/special4.png',
      frameWidth: 82,
      frameHeight: 88,
      frameCount: 10,
      contentHeight: 51,
      originX: 0.512,
      frameRate: 13,
      durationMs: 783,
      hitDelayMs: 350,
      fxReleaseMs: 350,
      fxAttach: 'caster' as const,
      fxGround: false as const,
      fx: {
        key: 'ichigo-special4-fx',
        url: '/sprites/player/ichigo/special4-fx.png',
        frameWidth: 567,
        frameHeight: 548,
        frameCount: 10,
        contentHeight: 544,
      },
    }
  },
  hotbarSkillIds: ["skill-ichigo-1","skill-ichigo-2","skill-ichigo-3","skill-ichigo-4"],
};

export const JUMP_FORCE_BY_SLUG: Record<string, CharacterPack> = {
  'ichigo': ICHIGO_PACK,
};

export const JUMP_FORCE_BY_LOOK_TYPE: Record<number, CharacterPack> = {
  [ICHIGO_LOOK_TYPE]: ICHIGO_PACK,
};

export const JUMP_FORCE_PREVIEW_BY_LOOK_TYPE: Record<number, string> = {
  [ICHIGO_LOOK_TYPE]: '/sprites/player/previews/ichigo.png',
};

export const JUMP_FORCE_HUNT_CHARACTERS = [
    { id: 'curated-character-ichigo', sourceId: 'curated-character-ichigo', name: "Ichigo Kurosaki", category: 'personagem', source: 'curated/ichigo', lookType: 9073, hasSprite: false, sourceMonster: null },
];

export const JUMP_FORCE_PREFERRED_NAMES = [
  "Ichigo Kurosaki",
];

export const JUMP_FORCE_SKILLS: SkillDefinition[] = [
  {
    id: 'skill-ichigo-1',
    name: "Getsuga Tenshou",
    element: 'yang' as const,
    requiredLevel: CHARACTER_SKILL_LEVELS[0],
    cooldownMs: CHARACTER_SKILL_COOLDOWNS_MS[0],
    damage: CHARACTER_SKILL_DAMAGE[0],
    icon: '/sprites/skills/yang.svg',
    animation: { kind: 'character' as const, durationMs: 717, scale: 1 },
    range: 170,
    description: "Getsuga Tenshou — Ichigo Kurosaki.",
  },
  {
    id: 'skill-ichigo-2',
    name: "Crescend Getsuga Tenshou",
    element: 'yang' as const,
    requiredLevel: CHARACTER_SKILL_LEVELS[1],
    cooldownMs: CHARACTER_SKILL_COOLDOWNS_MS[1],
    damage: CHARACTER_SKILL_DAMAGE[1],
    icon: '/sprites/skills/yang.svg',
    animation: { kind: 'character' as const, durationMs: 850, scale: 1 },
    range: 170,
    description: "Crescend Getsuga Tenshou — Ichigo Kurosaki.",
  },
  {
    id: 'skill-ichigo-3',
    name: "Giratory Sword",
    element: 'yang' as const,
    requiredLevel: CHARACTER_SKILL_LEVELS[2],
    cooldownMs: CHARACTER_SKILL_COOLDOWNS_MS[2],
    damage: CHARACTER_SKILL_DAMAGE[2],
    icon: '/sprites/skills/yang.svg',
    animation: { kind: 'character' as const, durationMs: 1133, scale: 1 },
    range: 100,
    description: "Giratory Sword — Ichigo Kurosaki.",
  },
  {
    id: 'skill-ichigo-4',
    name: "Reiatsu Explosion",
    element: 'yang' as const,
    requiredLevel: CHARACTER_SKILL_LEVELS[3],
    cooldownMs: CHARACTER_SKILL_COOLDOWNS_MS[3],
    damage: CHARACTER_SKILL_DAMAGE[3],
    icon: '/sprites/skills/yang.svg',
    animation: { kind: 'character' as const, durationMs: 783, scale: 1 },
    range: 120,
    areaRadius: CHARACTER_SKILL_AREA_RADIUS,
    description: "Reiatsu Explosion — Ichigo Kurosaki.",
  }
];
