import type { CharacterPack, SpriteSheetDef } from '@/data/character-packs';

/** Tiny RPG Character Pack 02 — Demon_A / Blood Monster_A (100×100, with shadows). */
export const DEMON_A_LOOK_TYPE = 9100;
export const BLOOD_MONSTER_A_LOOK_TYPE = 9101;

const FRAME = 100;
/** Pés do desenho ~y 59; pixels abaixo disso são só sombra. */
const ORIGIN_Y = 0.6;
const CONTENT_H = 22;

function sheet(
  slug: 'demon-a' | 'blood-monster-a',
  anim: string,
  frameCount: number,
  frameRate?: number,
): SpriteSheetDef {
  return {
    key: `${slug}-${anim}`,
    url: `/sprites/enemies/${slug}/${anim}.png`,
    frameWidth: FRAME,
    frameHeight: FRAME,
    frameCount,
    contentHeight: CONTENT_H,
    originY: ORIGIN_Y,
    frameRate,
  };
}

const DEMON_IDLE = sheet('demon-a', 'idle', 6, 8);
const DEMON_WALK = sheet('demon-a', 'walk', 8, 10);
const DEMON_ATK1 = sheet('demon-a', 'attack01', 7, 12);
const DEMON_ATK2 = sheet('demon-a', 'attack02', 7, 12);
const DEMON_HURT = { ...sheet('demon-a', 'hurt', 4, 10) };
const DEMON_DEATH = { ...sheet('demon-a', 'death', 4, 8) };

const BLOOD_IDLE = sheet('blood-monster-a', 'idle', 6, 8);
const BLOOD_WALK = sheet('blood-monster-a', 'walk', 8, 10);
const BLOOD_ATK1 = sheet('blood-monster-a', 'attack01', 8, 12);
const BLOOD_ATK2 = sheet('blood-monster-a', 'attack02', 8, 12);
const BLOOD_HURT = { ...sheet('blood-monster-a', 'hurt', 4, 10) };
const BLOOD_DEATH = { ...sheet('blood-monster-a', 'death', 4, 8) };

export const DEMON_A_PACK: CharacterPack = {
  id: 'demon-a',
  walk: DEMON_WALK,
  idle: DEMON_IDLE,
  attack: DEMON_ATK1,
  attackChain: [DEMON_ATK1, DEMON_ATK2],
  hurt: DEMON_HURT,
  death: DEMON_DEATH,
  skillAnims: {},
  hotbarSkillIds: [],
  displayScale: 1.35,
};

export const BLOOD_MONSTER_A_PACK: CharacterPack = {
  id: 'blood-monster-a',
  walk: BLOOD_WALK,
  idle: BLOOD_IDLE,
  attack: BLOOD_ATK1,
  attackChain: [BLOOD_ATK1, BLOOD_ATK2],
  hurt: BLOOD_HURT,
  death: BLOOD_DEATH,
  skillAnims: {},
  hotbarSkillIds: [],
  displayScale: 1.35,
};

export const TINY_RPG_BY_LOOK_TYPE: Record<number, CharacterPack> = {
  [DEMON_A_LOOK_TYPE]: DEMON_A_PACK,
  [BLOOD_MONSTER_A_LOOK_TYPE]: BLOOD_MONSTER_A_PACK,
};

export const TINY_RPG_BY_SLUG: Record<string, CharacterPack> = {
  'demon-a': DEMON_A_PACK,
  demon: DEMON_A_PACK,
  'blood-monster-a': BLOOD_MONSTER_A_PACK,
  'blood-monster': BLOOD_MONSTER_A_PACK,
};

export const TINY_RPG_PREVIEW_BY_LOOK_TYPE: Record<number, string> = {
  [DEMON_A_LOOK_TYPE]: '/sprites/enemies/demon-a/preview.png',
  [BLOOD_MONSTER_A_LOOK_TYPE]: '/sprites/enemies/blood-monster-a/preview.png',
};
