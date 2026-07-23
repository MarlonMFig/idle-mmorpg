import type * as Phaser from 'phaser';
import type { StarterCharacterId } from '@/types/player-creation';

/** Definição de um spritesheet de personagem. */
export interface SpriteSheetDef {
  key: string;
  url: string;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
}

export interface CharacterSkillAnimDef extends SpriteSheetDef {
  /** Duração aproximada do lock de movimento (ms). */
  durationMs: number;
  /** Atraso até aplicar dano (ms). */
  hitDelayMs: number;
  /** FX opcional (projétil / chama). */
  fx?: SpriteSheetDef;
}

export interface CharacterPack {
  id: StarterCharacterId;
  /** Altura visual alvo no mundo (px). Escala travada = displayHeight / walk.frameHeight. */
  displayHeight: number;
  walk: SpriteSheetDef;
  attack: SpriteSheetDef;
  /** skillId → animação no personagem. */
  skillAnims: Record<string, CharacterSkillAnimDef>;
  /** Hotbar de 2 jutsus (ordem de cast após o ataque normal). */
  hotbarSkillIds: readonly string[];
}

/** Altura no mundo ~NPC (48px), um pouco maior pra o player destacar. */
const PLAYER_DISPLAY_HEIGHT = 52;

const NARUTO_PACK: CharacterPack = {
  id: 'naruto-classic',
  displayHeight: PLAYER_DISPLAY_HEIGHT,
  walk: {
    key: 'naruto-walk',
    url: '/sprites/player/naruto-walk.png',
    frameWidth: 64,
    frameHeight: 98,
    frameCount: 6,
  },
  attack: {
    key: 'naruto-attack',
    url: '/sprites/player/naruto-combo1.png',
    frameWidth: 86,
    frameHeight: 75,
    frameCount: 4,
  },
  skillAnims: {
    'skill-rasengan': {
      key: 'naruto-rasengan',
      url: '/sprites/player/naruto-rasengan.png',
      frameWidth: 139,
      frameHeight: 74,
      frameCount: 8,
      durationMs: 800,
      hitDelayMs: 550,
    },
    'skill-sexy-jutsu': {
      key: 'naruto-sexy-jutsu',
      url: '/sprites/player/naruto-sexy-jutsu.png',
      frameWidth: 62,
      frameHeight: 63,
      frameCount: 23,
      durationMs: 1900,
      hitDelayMs: 1100,
    },
  },
  hotbarSkillIds: ['skill-rasengan', 'skill-sexy-jutsu'],
};

const SASUKE_PACK: CharacterPack = {
  id: 'sasuke-classic',
  displayHeight: PLAYER_DISPLAY_HEIGHT,
  walk: {
    key: 'sasuke-walk',
    url: '/sprites/player/sasuke/classic/walk.png?v=3',
    frameWidth: 98,
    frameHeight: 98,
    frameCount: 6,
  },
  attack: {
    key: 'sasuke-attack',
    url: '/sprites/player/sasuke/classic/combo1.png?v=6',
    frameWidth: 98,
    frameHeight: 98,
    frameCount: 4,
  },
  skillAnims: {
    'skill-chidori': {
      key: 'sasuke-chidori',
      url: '/sprites/player/sasuke/classic/chidori.png?v=6',
      frameWidth: 238,
      frameHeight: 98,
      frameCount: 25,
      durationMs: 2100,
      hitDelayMs: 1200,
    },
    'skill-hosenka': {
      key: 'sasuke-hosenka',
      url: '/sprites/player/sasuke/classic/hosenka-start.png?v=6',
      frameWidth: 107,
      frameHeight: 98,
      frameCount: 11,
      durationMs: 1100,
      hitDelayMs: 750,
      fx: {
        key: 'sasuke-hosenka-fx',
        url: '/sprites/player/sasuke/classic/hosenka-fx.png?v=3',
        frameWidth: 130,
        frameHeight: 77,
        frameCount: 7,
      },
    },
  },
  hotbarSkillIds: ['skill-chidori', 'skill-hosenka'],
};

const PACKS: Record<StarterCharacterId, CharacterPack> = {
  'naruto-classic': NARUTO_PACK,
  'sasuke-classic': SASUKE_PACK,
  // Rock Lee: fallback visual Naruto até termos sprites.
  'rock-lee': { ...NARUTO_PACK, id: 'rock-lee', hotbarSkillIds: NARUTO_PACK.hotbarSkillIds },
};

export function getCharacterPack(starterId: StarterCharacterId): CharacterPack {
  return PACKS[starterId] ?? NARUTO_PACK;
}

export function preloadCharacterPack(scene: Phaser.Scene, pack: CharacterPack): void {
  const sheets: SpriteSheetDef[] = [pack.walk, pack.attack];
  for (const anim of Object.values(pack.skillAnims)) {
    sheets.push(anim);
    if (anim.fx) sheets.push(anim.fx);
  }

  const seen = new Set<string>();
  for (const sheet of sheets) {
    if (seen.has(sheet.key)) continue;
    seen.add(sheet.key);
    scene.load.spritesheet(sheet.key, sheet.url, {
      frameWidth: sheet.frameWidth,
      frameHeight: sheet.frameHeight,
    });
  }
}
