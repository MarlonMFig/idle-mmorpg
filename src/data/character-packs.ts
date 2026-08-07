import * as Phaser from 'phaser';
import { CHARACTER_DISPLAY_HEIGHT } from '@/constants/sprites';
import type { WonsrDirection } from '@/data/wonsr-sprites';
import type { StarterCharacterId } from '@/types/player-creation';

/** Definição de um spritesheet de personagem. */
export interface SpriteSheetDef {
  key: string;
  url: string;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  /**
   * Altura do desenho visível dentro do frame (px). A escala sai daqui, e não
   * de `frameHeight`, para o personagem ficar do mesmo tamanho dos monstros
   * e NPCs mesmo com folga transparente na moldura.
   */
  contentHeight?: number;
}

export interface CharacterSkillAnimDef extends SpriteSheetDef {
  /** Duração aproximada do lock de movimento (ms). */
  durationMs: number;
  /** Atraso até aplicar dano (ms). */
  hitDelayMs: number;
  /** FPS da animação; sem valor, 12. */
  frameRate?: number;
  /** FX opcional (projétil / chama). */
  fx?: SpriteSheetDef;
}

/** Hit reaction / death sheet (repeat: 0). Opcional por pack. */
export interface CharacterReactionAnimDef extends SpriteSheetDef {
  /** FPS; padrão 10 (hurt) / 8 (death). */
  frameRate?: number;
}

export interface CharacterPack {
  /** Starter id ou id do personagem selado. */
  id: string;
  walk: SpriteSheetDef;
  attack: SpriteSheetDef;
  /**
   * Sequência de folhas de ataque (ex.: combo 1 → 2 → 3).
   * Sem isso, usa só `attack`.
   */
  attackChain?: readonly SpriteSheetDef[];
  /** Idle lateral opcional (sem isso, usa o frame 0 do walk). */
  idle?: SpriteSheetDef;
  /** Dano não-letal: play once, volta a idle/walk. */
  hurt?: CharacterReactionAnimDef;
  /** Morte: play once e segura o último quadro (cadáver / fade). */
  death?: CharacterReactionAnimDef;
  /** Metadados da sheet direcional exportada do DAT/SPR do WONSR. */
  outfit?: {
    lookType: number;
    phases: number;
    directions: readonly WonsrDirection[];
    content: { x: number; y: number; width: number; height: number };
  };
  /** skillId → animação no personagem. */
  skillAnims: Record<string, CharacterSkillAnimDef>;
  /** Hotbar de 4 jutsus, liberados nos níveis 1, 5, 15 e 30. */
  hotbarSkillIds: readonly string[];
}

function wonsrOutfitSheet(
  lookType: number,
  content: { x: number; y: number; width: number; height: number },
): SpriteSheetDef {
  return {
    key: `wonsr-outfits-${lookType}`,
    url: `/sprites/wonsr/outfits/${lookType}.png`,
    frameWidth: 32,
    frameHeight: 64,
    frameCount: 12,
    contentHeight: content.height,
  };
}

/**
 * Folhas de jutsu do Naruto recortadas por `scripts/process-naruto-jutsu-nu.js`
 * (métricas em `public/sprites/player/naruto/meta.json`). `contentHeight` é a
 * altura do Naruto no primeiro frame: os quadros maiores (Rasengan, Kurama)
 * crescem na tela sem esticar o personagem.
 */
const NARUTO_JUTSU_ANIMS: Record<string, CharacterSkillAnimDef> = {
  'skill-rasengan': {
    key: 'naruto-rasengan',
    url: '/sprites/player/naruto/rasengan.png',
    // Sheet gerada de assets/naruto-source/nu/rasengan-gif.gif
    // (npm run naruto:rasengan-gif). Grelha multi-linha para caber no WebGL.
    frameWidth: 332,
    frameHeight: 197,
    frameCount: 26,
    contentHeight: 110,
    frameRate: 10,
    durationMs: 2600,
    // Impacto / flash grande começa ~frame 15.
    hitDelayMs: 1500,
  },
  'skill-kurama-mode': {
    key: 'naruto-kyuubi',
    url: '/sprites/player/naruto/kyuubi.png',
    frameWidth: 136,
    frameHeight: 136,
    frameCount: 37,
    contentHeight: 40,
    frameRate: 14,
    durationMs: 2650,
    hitDelayMs: 2250,
  },
};

const NARUTO_WALK: SpriteSheetDef = {
  key: 'naruto-walk',
  url: '/sprites/player/naruto/walk.png',
  // npm run naruto:walk — assets/naruto-source/nu/naruto/walk/frame_001..006.png
  frameWidth: 31,
  frameHeight: 51,
  frameCount: 6,
  contentHeight: 48,
};

const NARUTO_IDLE: SpriteSheetDef = {
  key: 'naruto-idle',
  url: '/sprites/player/naruto/idle.png',
  // npm run naruto:idle — assets/naruto-source/nu/naruto/idle/frame_001..006.png
  frameWidth: 34,
  frameHeight: 50,
  frameCount: 6,
  contentHeight: 48,
};

const NARUTO_COMBO_1: SpriteSheetDef = {
  key: 'naruto-combo1',
  url: '/sprites/player/naruto/combo1.png',
  frameWidth: 87,
  frameHeight: 85,
  frameCount: 4,
  contentHeight: 81,
};

const NARUTO_COMBO_2: SpriteSheetDef = {
  key: 'naruto-combo2',
  url: '/sprites/player/naruto/combo2.png',
  frameWidth: 89,
  frameHeight: 77,
  frameCount: 4,
  contentHeight: 75,
};

const NARUTO_COMBO_3: SpriteSheetDef = {
  key: 'naruto-combo3',
  url: '/sprites/player/naruto/combo3.png',
  frameWidth: 89,
  frameHeight: 79,
  frameCount: 5,
  contentHeight: 77,
};

const NARUTO_ATTACK_CHAIN = [NARUTO_COMBO_1, NARUTO_COMBO_2, NARUTO_COMBO_3] as const;

const NARUTO_PACK: CharacterPack = {
  id: 'naruto-classic',
  walk: NARUTO_WALK,
  idle: NARUTO_IDLE,
  attack: NARUTO_COMBO_1,
  attackChain: NARUTO_ATTACK_CHAIN,
  // Sprites laterais (idle/walk/combos/jutsus) — sem outfit WONSR 4 direções.
  skillAnims: NARUTO_JUTSU_ANIMS,
  hotbarSkillIds: [
    'skill-rasengan',
    'skill-oodama-rasengan',
    'skill-kurama-mode',
  ],
};

const SASUKE_WALK: SpriteSheetDef = {
  key: 'sasuke-walk',
  url: '/sprites/player/sasuke/walk.png',
  // Folha horizontal: assets/naruto-source/nu/sasuke-walk-sheet.png
  frameWidth: 42,
  frameHeight: 52,
  frameCount: 6,
  contentHeight: 48,
};

const SASUKE_IDLE: SpriteSheetDef = {
  key: 'sasuke-idle',
  url: '/sprites/player/sasuke/idle.png',
  // Folha horizontal: assets/naruto-source/nu/sasuke-idle-sheet.png
  frameWidth: 33,
  frameHeight: 50,
  frameCount: 6,
  contentHeight: 48,
};

const SASUKE_COMBO_1: SpriteSheetDef = {
  key: 'sasuke-combo1',
  url: '/sprites/player/sasuke/combo1.png',
  // Sequência frame_001…017 (npm run sasuke:combo) — hit 1 (socos).
  frameWidth: 67,
  frameHeight: 55,
  frameCount: 5,
  contentHeight: 48,
};

const SASUKE_COMBO_2: SpriteSheetDef = {
  key: 'sasuke-combo2',
  url: '/sprites/player/sasuke/combo2.png',
  // Hit 2 (chute / mid-combo).
  frameWidth: 67,
  frameHeight: 55,
  frameCount: 6,
  contentHeight: 48,
};

const SASUKE_COMBO_3: SpriteSheetDef = {
  key: 'sasuke-combo3',
  url: '/sprites/player/sasuke/combo3.png',
  // Hit 3 (finisher / lunge).
  frameWidth: 67,
  frameHeight: 55,
  frameCount: 6,
  contentHeight: 48,
};

const SASUKE_ATTACK_CHAIN = [SASUKE_COMBO_1, SASUKE_COMBO_2, SASUKE_COMBO_3] as const;

const SASUKE_JUTSU_ANIMS: Record<string, CharacterSkillAnimDef> = {
  'skill-chidori': {
    key: 'sasuke-chidori',
    url: '/sprites/player/sasuke/sasuke-chidori.png',
    // Sequência frame_001…033 (npm run sasuke:chidori).
    frameWidth: 109,
    frameHeight: 75,
    frameCount: 33,
    contentHeight: 48,
    frameRate: 14,
    durationMs: 2357,
    // Início do lunge / impacto elétrico.
    hitDelayMs: 1296,
  },
  // 2ª skill: Katon Goukakyuu — corpo (selos) + fogo separado (FX no alvo).
  // npm run sasuke:gokakyu (frames por gap-detect, NÃO grid uniforme)
  'skill-katon-gokakyu': {
    key: 'sasuke-gokakyu',
    url: '/sprites/player/sasuke/sasuke-gokakyu.png',
    frameWidth: 53,
    frameHeight: 51,
    frameCount: 11,
    contentHeight: 48,
    frameRate: 10,
    // Selos (~1.1s) + fogo no alvo; personagem segura o último quadro.
    durationMs: 1700,
    // Fogo e hit no final dos selos / pose de soltura.
    hitDelayMs: 1100,
    fx: {
      key: 'sasuke-gokakyu-fx',
      url: '/sprites/player/sasuke/sasuke-gokakyu-fx.png',
      frameWidth: 96,
      frameHeight: 60,
      frameCount: 6,
      contentHeight: 60,
    },
  },
};

const SASUKE_PACK: CharacterPack = {
  id: 'sasuke-classic',
  walk: SASUKE_WALK,
  idle: SASUKE_IDLE,
  attack: SASUKE_COMBO_1,
  attackChain: SASUKE_ATTACK_CHAIN,
  skillAnims: SASUKE_JUTSU_ANIMS,
  hotbarSkillIds: [
    'skill-chidori',
    'skill-katon-gokakyu',
    'character-sasuke-skill-3',
    'character-sasuke-skill-4',
  ],
};

const ROCK_LEE_WALK: SpriteSheetDef = {
  key: 'rock-lee-walk',
  url: '/sprites/player/rock-lee/walk.png',
  // npm run rock-lee:body — assets/naruto-source/nu/rock-lee-walk-sheet.png
  frameWidth: 39,
  frameHeight: 50,
  frameCount: 6,
  contentHeight: 48,
};

const ROCK_LEE_IDLE: SpriteSheetDef = {
  key: 'rock-lee-idle',
  url: '/sprites/player/rock-lee/idle.png',
  // npm run rock-lee:body — assets/naruto-source/nu/rock-lee-idle-sheet.png
  frameWidth: 35,
  frameHeight: 50,
  frameCount: 6,
  contentHeight: 48,
};

const ROCK_LEE_COMBO_1: SpriteSheetDef = {
  key: 'rock-lee-combo1',
  url: '/sprites/player/rock-lee/combo1.png',
  // frame_001…020 (npm run rock-lee:combo) — hit 1.
  frameWidth: 59,
  frameHeight: 58,
  frameCount: 9,
  contentHeight: 48,
};

const ROCK_LEE_COMBO_2: SpriteSheetDef = {
  key: 'rock-lee-combo2',
  url: '/sprites/player/rock-lee/combo2.png',
  // Hit 2.
  frameWidth: 59,
  frameHeight: 58,
  frameCount: 12,
  contentHeight: 48,
};

const ROCK_LEE_COMBO_3: SpriteSheetDef = {
  key: 'rock-lee-combo3',
  url: '/sprites/player/rock-lee/combo3.png',
  // Hit 3 (finisher).
  frameWidth: 59,
  frameHeight: 58,
  frameCount: 12,
  contentHeight: 48,
};

const ROCK_LEE_ATTACK_CHAIN = [ROCK_LEE_COMBO_1, ROCK_LEE_COMBO_2, ROCK_LEE_COMBO_3] as const;

const ROCK_LEE_JUTSU_ANIMS: Record<string, CharacterSkillAnimDef> = {
  // 1ª skill: Konoha Senpu (npm run rock-lee:skill1)
  'skill-konoha-senpu': {
    key: 'rock-lee-konoha-senpu',
    url: '/sprites/player/rock-lee/konoha-senpu.png',
    frameWidth: 45,
    frameHeight: 63,
    frameCount: 27,
    contentHeight: 48,
    frameRate: 17,
    durationMs: 1929,
    hitDelayMs: 868,
  },
  // 2ª skill: Omote Renge (npm run rock-lee:skill2)
  'skill-omote-renge': {
    key: 'rock-lee-omote-renge',
    url: '/sprites/player/rock-lee/omote-renge.png',
    frameWidth: 131,
    frameHeight: 101,
    frameCount: 52,
    contentHeight: 48,
    frameRate: 17,
    durationMs: 2714,
    hitDelayMs: 1671,
  },
};

const ROCK_LEE_PACK: CharacterPack = {
  id: 'rock-lee',
  walk: ROCK_LEE_WALK,
  idle: ROCK_LEE_IDLE,
  attack: ROCK_LEE_COMBO_1,
  attackChain: ROCK_LEE_ATTACK_CHAIN,
  skillAnims: ROCK_LEE_JUTSU_ANIMS,
  hotbarSkillIds: [
    'skill-konoha-senpu',
    'skill-omote-renge',
    'character-lee-skill-3',
    'character-lee-skill-4',
  ],
};

/**
 * Shikamaru Nara (lookType 1426 / slug WONSR).
 * npm run shikamaru:idle | walk | combo | jutsu | jutsu2 | jutsu2-vfx  (or shikamaru:all)
 * Sources: assets/naruto-source/nu/shikamaru/{idle,walk,combo,jutsu,jutsu2,jutsu2-vfx}/frame_*.png
 * Alpha-only pack (no black/green key).
 */
const SHIKAMARU_IDLE: SpriteSheetDef = {
  key: 'shikamaru-idle',
  url: '/sprites/player/shikamaru/idle.png',
  frameWidth: 27,
  frameHeight: 49,
  frameCount: 8,
  contentHeight: 48,
};

const SHIKAMARU_WALK: SpriteSheetDef = {
  key: 'shikamaru-walk',
  url: '/sprites/player/shikamaru/walk.png',
  frameWidth: 24,
  frameHeight: 49,
  frameCount: 6,
  contentHeight: 48,
};

const SHIKAMARU_COMBO_1: SpriteSheetDef = {
  key: 'shikamaru-combo1',
  url: '/sprites/player/shikamaru/combo1.png',
  frameWidth: 48,
  frameHeight: 58,
  frameCount: 5,
  contentHeight: 48,
};

const SHIKAMARU_COMBO_2: SpriteSheetDef = {
  key: 'shikamaru-combo2',
  url: '/sprites/player/shikamaru/combo2.png',
  frameWidth: 48,
  frameHeight: 58,
  frameCount: 5,
  contentHeight: 48,
};

const SHIKAMARU_COMBO_3: SpriteSheetDef = {
  key: 'shikamaru-combo3',
  url: '/sprites/player/shikamaru/combo3.png',
  frameWidth: 48,
  frameHeight: 58,
  frameCount: 5,
  contentHeight: 48,
};

const SHIKAMARU_ATTACK_CHAIN = [SHIKAMARU_COMBO_1, SHIKAMARU_COMBO_2, SHIKAMARU_COMBO_3] as const;

/**
 * Kunai Explosiva (npm run shikamaru:jutsu2 + jutsu2-vfx) —
 * body cast + separate FX on target (same pattern as Sasuke Goukakyuu).
 */
const SHIKAMARU_JUTSU_ANIMS: Record<string, CharacterSkillAnimDef> = {
  // npm run shikamaru:jutsu2 + jutsu2-vfx
  'skill-explosion-kunai': {
    key: 'shikamaru-explosion-kunai',
    url: '/sprites/player/shikamaru/explosion-kunai.png',
    frameWidth: 44,
    frameHeight: 51,
    frameCount: 14,
    contentHeight: 48,
    frameRate: 10,
    durationMs: 1400,
    hitDelayMs: 812,
    fx: {
      key: 'shikamaru-explosion-kunai-fx',
      url: '/sprites/player/shikamaru/explosion-kunai-fx.png',
      frameWidth: 42,
      frameHeight: 52,
      frameCount: 18,
      contentHeight: 52,
    },
  },
};

const SHIKAMARU_PACK: CharacterPack = {
  id: 'shikamaru',
  walk: SHIKAMARU_WALK,
  idle: SHIKAMARU_IDLE,
  attack: SHIKAMARU_COMBO_1,
  attackChain: SHIKAMARU_ATTACK_CHAIN,
  skillAnims: SHIKAMARU_JUTSU_ANIMS,
  hotbarSkillIds: ['skill-explosion-kunai'],
};

/** lookType WONSR do Shikamaru Nara (vocations). */
export const SHIKAMARU_LOOK_TYPE = 1426;

/** Hyuga Neji (mapas: lookTypes de monstro + curado 9003; slug `neji`). */
export const NEJI_LOOK_TYPES = [489, 490, 494] as const;
/** lookType 9003 é identidade client-only (não vem do DAT/SPR WONSR). */
export const NEJI_CURATED_LOOK_TYPE = 9003;

const NEJI_IDLE: SpriteSheetDef = {
  key: 'neji-idle',
  url: '/sprites/player/neji/idle.png',
  frameWidth: 38,
  frameHeight: 52,
  frameCount: 4,
  contentHeight: 48,
};

/** npm run neji:walk — assets/naruto-source/nu/neji-walk-sheet.png (6-frame horizontal) */
const NEJI_WALK: SpriteSheetDef = {
  key: 'neji-walk',
  url: '/sprites/player/neji/walk.png',
  frameWidth: 27,
  frameHeight: 53,
  frameCount: 6,
  contentHeight: 48,
};

/** npm run neji:combo — assets/naruto-source/nu/neji-combo-sheet.png (5+6+11) */
const NEJI_COMBO_1: SpriteSheetDef = {
  key: 'neji-combo1',
  url: '/sprites/player/neji/combo1.png',
  frameWidth: 60,
  frameHeight: 52,
  frameCount: 5,
  contentHeight: 48,
};

const NEJI_COMBO_2: SpriteSheetDef = {
  key: 'neji-combo2',
  url: '/sprites/player/neji/combo2.png',
  frameWidth: 53,
  frameHeight: 51,
  frameCount: 6,
  contentHeight: 48,
};

const NEJI_COMBO_3: SpriteSheetDef = {
  key: 'neji-combo3',
  url: '/sprites/player/neji/combo3.png',
  frameWidth: 65,
  frameHeight: 53,
  frameCount: 11,
  contentHeight: 48,
};

const NEJI_ATTACK_CHAIN = [NEJI_COMBO_1, NEJI_COMBO_2, NEJI_COMBO_3] as const;

const NEJI_JUTSU_ANIMS: Record<string, CharacterSkillAnimDef> = {
  'skill-hakke-kaiten': {
    key: 'neji-kaiten',
    url: '/sprites/player/neji/kaiten.png',
    frameWidth: 124,
    frameHeight: 92,
    frameCount: 59,
    contentHeight: 48,
    frameRate: 18,
    durationMs: 2917,
    hitDelayMs: 1213,
  },
  'skill-hakke-kusho': {
    key: 'neji-hakke-kusho',
    url: '/sprites/player/neji/hakke-kusho.png',
    frameWidth: 50,
    frameHeight: 50,
    frameCount: 13,
    contentHeight: 48,
    frameRate: 12,
    durationMs: 1083,
    hitDelayMs: 780,
  },
  'skill-rokujuyon-sho': {
    key: 'neji-rokujuyon-sho',
    url: '/sprites/player/neji/rokujuyon-sho.png',
    frameWidth: 100,
    frameHeight: 86,
    frameCount: 11,
    contentHeight: 48,
    frameRate: 12,
    durationMs: 917,
    hitDelayMs: 596,
  },
};

const NEJI_PACK: CharacterPack = {
  id: 'neji',
  walk: NEJI_WALK,
  idle: NEJI_IDLE,
  attack: NEJI_COMBO_1,
  attackChain: NEJI_ATTACK_CHAIN,
  skillAnims: NEJI_JUTSU_ANIMS,
  hotbarSkillIds: ['skill-hakke-kaiten', 'skill-rokujuyon-sho'],
};

/** Gaara (vocation 1395 + variantes de mapa). npm run gaara:all */
export const GAARA_LOOK_TYPES = [1395, 41, 42, 710] as const;

const GAARA_IDLE: SpriteSheetDef = {
  key: 'gaara-idle',
  url: '/sprites/player/gaara/idle.png',
  frameWidth: 24,
  frameHeight: 50,
  frameCount: 4,
  contentHeight: 48,
};

const GAARA_WALK: SpriteSheetDef = {
  key: 'gaara-walk',
  url: '/sprites/player/gaara/walk.png',
  frameWidth: 25,
  frameHeight: 50,
  frameCount: 6,
  contentHeight: 48,
};

const GAARA_COMBO_1: SpriteSheetDef = {
  key: 'gaara-combo1',
  url: '/sprites/player/gaara/combo1.png',
  frameWidth: 77,
  frameHeight: 69,
  frameCount: 5,
  contentHeight: 48,
};

const GAARA_COMBO_2: SpriteSheetDef = {
  key: 'gaara-combo2',
  url: '/sprites/player/gaara/combo2.png',
  frameWidth: 77,
  frameHeight: 69,
  frameCount: 5,
  contentHeight: 48,
};

const GAARA_COMBO_3: SpriteSheetDef = {
  key: 'gaara-combo3',
  url: '/sprites/player/gaara/combo3.png',
  frameWidth: 77,
  frameHeight: 69,
  frameCount: 5,
  contentHeight: 48,
};

const GAARA_ATTACK_CHAIN = [GAARA_COMBO_1, GAARA_COMBO_2, GAARA_COMBO_3] as const;

/** npm run gaara:damage — frames 1–2 do strip damage-source. */
const GAARA_HURT: CharacterReactionAnimDef = {
  key: 'gaara-hurt',
  url: '/sprites/player/gaara/hurt.png',
  frameWidth: 57,
  frameHeight: 50,
  frameCount: 2,
  contentHeight: 48,
  frameRate: 9,
};

/** npm run gaara:damage — frames 3–5 death, hold last. */
const GAARA_DEATH: CharacterReactionAnimDef = {
  key: 'gaara-death',
  url: '/sprites/player/gaara/death.png',
  frameWidth: 57,
  frameHeight: 50,
  frameCount: 3,
  contentHeight: 48,
  frameRate: 8,
};

const GAARA_JUTSU_ANIMS: Record<string, CharacterSkillAnimDef> = {
  'skill-sand-prison': {
    key: 'gaara-sand-prison',
    url: '/sprites/player/gaara/sand-prison.png',
    frameWidth: 198,
    frameHeight: 172,
    frameCount: 25,
    contentHeight: 48,
    frameRate: 11,
    durationMs: 2273,
    hitDelayMs: 1637,
  },
};

const GAARA_PACK: CharacterPack = {
  id: 'gaara',
  walk: GAARA_WALK,
  idle: GAARA_IDLE,
  attack: GAARA_COMBO_1,
  attackChain: GAARA_ATTACK_CHAIN,
  hurt: GAARA_HURT,
  death: GAARA_DEATH,
  skillAnims: GAARA_JUTSU_ANIMS,
  hotbarSkillIds: ['skill-sand-prison'],
};

/** Sakura Haruno (vocation 1423 + variantes). npm run sakura:all */
export const SAKURA_LOOK_TYPES = [1423, 350, 352] as const;

const SAKURA_IDLE: SpriteSheetDef = {
  key: 'sakura-idle',
  url: '/sprites/player/sakura/idle.png',
  frameWidth: 21,
  frameHeight: 51,
  frameCount: 4,
  contentHeight: 48,
};

const SAKURA_WALK: SpriteSheetDef = {
  key: 'sakura-walk',
  url: '/sprites/player/sakura/walk.png',
  frameWidth: 50,
  frameHeight: 52,
  frameCount: 6,
  contentHeight: 48,
};

const SAKURA_COMBO_1: SpriteSheetDef = {
  key: 'sakura-combo1',
  url: '/sprites/player/sakura/combo1.png',
  frameWidth: 46,
  frameHeight: 50,
  frameCount: 2,
  contentHeight: 48,
};

const SAKURA_COMBO_2: SpriteSheetDef = {
  key: 'sakura-combo2',
  url: '/sprites/player/sakura/combo2.png',
  frameWidth: 46,
  frameHeight: 50,
  frameCount: 2,
  contentHeight: 48,
};

const SAKURA_COMBO_3: SpriteSheetDef = {
  key: 'sakura-combo3',
  url: '/sprites/player/sakura/combo3.png',
  frameWidth: 46,
  frameHeight: 50,
  frameCount: 1,
  contentHeight: 48,
};

const SAKURA_ATTACK_CHAIN = [SAKURA_COMBO_1, SAKURA_COMBO_2, SAKURA_COMBO_3] as const;

const SAKURA_JUTSU_ANIMS: Record<string, CharacterSkillAnimDef> = {
  'skill-chou-bakou': {
    key: 'sakura-chou-bakou',
    url: '/sprites/player/sakura/chou-bakou.png',
    frameWidth: 46,
    frameHeight: 50,
    frameCount: 13,
    contentHeight: 48,
    frameRate: 12,
    durationMs: 1083,
    hitDelayMs: 596,
  },
  'skill-chakra-strength': {
    key: 'sakura-chakra-strength',
    url: '/sprites/player/sakura/chakra-strength.png',
    frameWidth: 62,
    frameHeight: 62,
    frameCount: 12,
    contentHeight: 48,
    frameRate: 12,
    durationMs: 1000,
    hitDelayMs: 600,
  },
};

const SAKURA_PACK: CharacterPack = {
  id: 'sakura',
  walk: SAKURA_WALK,
  idle: SAKURA_IDLE,
  attack: SAKURA_COMBO_1,
  attackChain: SAKURA_ATTACK_CHAIN,
  skillAnims: SAKURA_JUTSU_ANIMS,
  hotbarSkillIds: ['skill-chou-bakou', 'skill-chakra-strength'],
};

/**
 * Chouji Akimichi (Part I) — idle + walk + combo + Nikudan Sensha.
 * npm run chouji:idle — assets/naruto-source/nu/chouji-idle-sheet.png
 * npm run chouji:walk — assets/naruto-source/nu/chouji-walk-sheet.png
 * npm run chouji:combo — assets/naruto-source/nu/chouji-combo-sheet.png
 * npm run chouji:jutsu — seal+spin → nikudan-sensha.png
 * lookType 9004 é identidade client-only.
 */
export const CHOUJI_CURATED_LOOK_TYPE = 9004;

const CHOUJI_IDLE: SpriteSheetDef = {
  key: 'chouji-idle',
  url: '/sprites/player/chouji/idle.png',
  frameWidth: 29,
  frameHeight: 50,
  frameCount: 17,
  contentHeight: 48,
};

/** npm run chouji:walk — 6f side walk RIGHT (dims not shared with idle). */
const CHOUJI_WALK: SpriteSheetDef = {
  key: 'chouji-walk',
  url: '/sprites/player/chouji/walk.png',
  frameWidth: 29,
  frameHeight: 51,
  frameCount: 6,
  contentHeight: 48,
};

/** npm run chouji:combo — punch(3) + kick(4) + multi-size fist finisher */
const CHOUJI_COMBO_1: SpriteSheetDef = {
  key: 'chouji-combo1',
  url: '/sprites/player/chouji/combo1.png',
  frameWidth: 51,
  frameHeight: 52,
  frameCount: 3,
  contentHeight: 48,
};

const CHOUJI_COMBO_2: SpriteSheetDef = {
  key: 'chouji-combo2',
  url: '/sprites/player/chouji/combo2.png',
  frameWidth: 51,
  frameHeight: 52,
  frameCount: 4,
  contentHeight: 48,
};

const CHOUJI_COMBO_3: SpriteSheetDef = {
  key: 'chouji-combo3',
  url: '/sprites/player/chouji/combo3.png',
  frameWidth: 51,
  frameHeight: 52,
  frameCount: 8,
  contentHeight: 48,
};

const CHOUJI_ATTACK_CHAIN = [CHOUJI_COMBO_1, CHOUJI_COMBO_2, CHOUJI_COMBO_3] as const;

/** npm run chouji:jutsu — seal→expand→spin (single strip). */
const CHOUJI_JUTSU_ANIMS: Record<string, CharacterSkillAnimDef> = {
  'skill-nikudan-sensha': {
    key: 'chouji-nikudan-sensha',
    url: '/sprites/player/chouji/nikudan-sensha.png',
    frameWidth: 58,
    frameHeight: 77,
    frameCount: 25,
    contentHeight: 48,
    frameRate: 12,
    durationMs: 2083,
    hitDelayMs: 1083,
  },
};

const CHOUJI_PACK: CharacterPack = {
  id: 'chouji',
  walk: CHOUJI_WALK,
  idle: CHOUJI_IDLE,
  attack: CHOUJI_COMBO_1,
  attackChain: CHOUJI_ATTACK_CHAIN,
  skillAnims: CHOUJI_JUTSU_ANIMS,
  hotbarSkillIds: ['skill-nikudan-sensha'],
};

/**
 * Hinata Hyuga — idle + walk + palm-strike combo + jutsus.
 * npm run hinata:idle — assets/naruto-source/nu/hinata-idle-sheet.png
 * npm run hinata:walk — assets/naruto-source/nu/hinata-walk-sheet.png
 * npm run hinata:combo — assets/naruto-source/nu/hinata-combo-sheet.png
 * npm run hinata:jutsu — hakke-shou.png (31f primary sequence)
 * Source: assets/naruto-source/nu/hinata/jutsu-new
 * lookType 9005 é identidade client-only.
 */
export const HINATA_CURATED_LOOK_TYPE = 9005;

const HINATA_IDLE: SpriteSheetDef = {
  key: 'hinata-idle',
  url: '/sprites/player/hinata/idle.png',
  frameWidth: 33,
  frameHeight: 52,
  frameCount: 5,
  contentHeight: 48,
};

const HINATA_WALK: SpriteSheetDef = {
  key: 'hinata-walk',
  url: '/sprites/player/hinata/walk.png',
  frameWidth: 25,
  frameHeight: 51,
  frameCount: 6,
  contentHeight: 48,
};

const HINATA_COMBO_1: SpriteSheetDef = {
  key: 'hinata-combo1',
  url: '/sprites/player/hinata/combo1.png',
  frameWidth: 55,
  frameHeight: 55,
  frameCount: 5,
  contentHeight: 48,
};

const HINATA_COMBO_2: SpriteSheetDef = {
  key: 'hinata-combo2',
  url: '/sprites/player/hinata/combo2.png',
  frameWidth: 55,
  frameHeight: 55,
  frameCount: 5,
  contentHeight: 48,
};

const HINATA_COMBO_3: SpriteSheetDef = {
  key: 'hinata-combo3',
  url: '/sprites/player/hinata/combo3.png',
  frameWidth: 55,
  frameHeight: 55,
  frameCount: 5,
  contentHeight: 48,
};

const HINATA_ATTACK_CHAIN = [HINATA_COMBO_1, HINATA_COMBO_2, HINATA_COMBO_3] as const;

/** npm run hinata:jutsu — single Hakke Shōhō strip (replaces twin-lion + old 41f). */
const HINATA_JUTSU_ANIMS: Record<string, CharacterSkillAnimDef> = {
  'skill-hakke-shouhou': {
    key: 'hinata-hakke-shou',
    url: '/sprites/player/hinata/hakke-shou.png',
    frameWidth: 148,
    frameHeight: 175,
    frameCount: 31,
    contentHeight: 48,
    frameRate: 12,
    durationMs: 2583,
    hitDelayMs: 1421,
  },
};

const HINATA_PACK: CharacterPack = {
  id: 'hinata',
  walk: HINATA_WALK,
  idle: HINATA_IDLE,
  attack: HINATA_COMBO_1,
  attackChain: HINATA_ATTACK_CHAIN,
  skillAnims: HINATA_JUTSU_ANIMS,
  hotbarSkillIds: ['skill-hakke-shouhou'],
};

/**
 * Naruto Sage Mode (Sennin) — pack parcial (só walk por enquanto).
 * npm run naruto-sennin:walk — assets/naruto-source/nu/naruto-sennin-walk-sheet.png
 * Linha de cima (direita); flipX no jogo para a esquerda.
 *
 * lookType 9001 é identidade client-only (não vem do DAT/SPR WONSR).
 */
export const NARUTO_SENNIN_LOOK_TYPE = 9001;

const NARUTO_SENNIN_WALK: SpriteSheetDef = {
  key: 'naruto-sennin-walk',
  url: '/sprites/player/naruto-sennin/walk.png',
  frameWidth: 45,
  frameHeight: 50,
  frameCount: 7,
  contentHeight: 48,
};

const NARUTO_SENNIN_PACK: CharacterPack = {
  id: 'naruto-sennin',
  walk: NARUTO_SENNIN_WALK,
  // Sem idle/combo ainda — walk cobre idle/attack até as folhas existirem.
  idle: NARUTO_SENNIN_WALK,
  attack: NARUTO_SENNIN_WALK,
  // Jutsus do pack classic até haver sheets sennin (mesmas keys de textura).
  skillAnims: NARUTO_JUTSU_ANIMS,
  hotbarSkillIds: [
    'skill-rasengan',
    'skill-oodama-rasengan',
    'skill-kurama-mode',
  ],
};

/**
 * Uchiha Itachi — pack parcial (só walk lateral por enquanto).
 * npm run itachi:walk — assets/naruto-source/nu/itachi-walk-sheet.png
 * Perfil direita, 6 frames; flipX no jogo para a esquerda.
 *
 * lookType 9002 é identidade client-only (não vem do DAT/SPR WONSR).
 */
export const UCHIHA_ITACHI_LOOK_TYPE = 9002;

const UCHIHA_ITACHI_WALK: SpriteSheetDef = {
  key: 'itachi-walk',
  url: '/sprites/player/itachi/walk.png',
  frameWidth: 26,
  frameHeight: 51,
  frameCount: 6,
  contentHeight: 48,
};

const UCHIHA_ITACHI_PACK: CharacterPack = {
  id: 'uchiha-itachi',
  walk: UCHIHA_ITACHI_WALK,
  // Sem idle/combo ainda — walk cobre idle/attack até as folhas existirem.
  idle: UCHIHA_ITACHI_WALK,
  attack: UCHIHA_ITACHI_WALK,
  skillAnims: {},
  hotbarSkillIds: [],
};

const PACKS: Record<StarterCharacterId, CharacterPack> = {
  'naruto-classic': NARUTO_PACK,
  'sasuke-classic': SASUKE_PACK,
  'rock-lee': ROCK_LEE_PACK,
};

/** Packs curados para personagens selados (substituem outfit 4-dir WONSR). */
const CURATED_BY_SLUG: Record<string, CharacterPack> = {
  shikamaru: SHIKAMARU_PACK,
  neji: NEJI_PACK,
  gaara: GAARA_PACK,
  sakura: SAKURA_PACK,
  chouji: CHOUJI_PACK,
  choji: CHOUJI_PACK,
  hinata: HINATA_PACK,
  'hinata-hyuga': HINATA_PACK,
  'naruto-sennin': NARUTO_SENNIN_PACK,
  itachi: UCHIHA_ITACHI_PACK,
  'uchiha-itachi': UCHIHA_ITACHI_PACK,
};

const CURATED_BY_LOOK_TYPE: Record<number, CharacterPack> = {
  [SHIKAMARU_LOOK_TYPE]: SHIKAMARU_PACK,
  ...Object.fromEntries(NEJI_LOOK_TYPES.map((look) => [look, NEJI_PACK])),
  [NEJI_CURATED_LOOK_TYPE]: NEJI_PACK,
  ...Object.fromEntries(GAARA_LOOK_TYPES.map((look) => [look, GAARA_PACK])),
  ...Object.fromEntries(SAKURA_LOOK_TYPES.map((look) => [look, SAKURA_PACK])),
  [CHOUJI_CURATED_LOOK_TYPE]: CHOUJI_PACK,
  [HINATA_CURATED_LOOK_TYPE]: HINATA_PACK,
  [NARUTO_SENNIN_LOOK_TYPE]: NARUTO_SENNIN_PACK,
  [UCHIHA_ITACHI_LOOK_TYPE]: UCHIHA_ITACHI_PACK,
};

export function getCharacterPack(starterId: StarterCharacterId): CharacterPack {
  return PACKS[starterId] ?? NARUTO_PACK;
}

/** Pack lateral curado por slug WONSR (ex.: `shikamaru`). */
export function getCuratedPackBySlug(slug: string | null | undefined): CharacterPack | null {
  if (!slug) return null;
  return CURATED_BY_SLUG[slug] ?? null;
}

/** Pack lateral curado por lookType WONSR. */
export function getCuratedPackByLookType(lookType: number): CharacterPack | null {
  return CURATED_BY_LOOK_TYPE[lookType] ?? null;
}

/**
 * Escala travada do personagem (walk e jutsus), medida sobre o desenho para
 * bater com a altura padrão de monstros e NPCs.
 */
export function characterBaseScale(pack: CharacterPack): number {
  const height = pack.walk.contentHeight ?? pack.walk.frameHeight;
  return height > 0 ? CHARACTER_DISPLAY_HEIGHT / height : 1;
}

export function preloadCharacterPack(scene: Phaser.Scene, pack: CharacterPack): void {
  const sheets = listPackSheets(pack);
  const seen = new Set<string>();
  for (const sheet of sheets) {
    if (seen.has(sheet.key)) continue;
    seen.add(sheet.key);
    scene.load.spritesheet(sheet.key, sheet.url, {
      frameWidth: sheet.frameWidth,
      frameHeight: sheet.frameHeight,
    });
  }

  // Pixel art nítido (sem blur bilinear).
  scene.load.once(Phaser.Loader.Events.COMPLETE, () => {
    applyNearestFilter(scene, seen);
  });
}

/** Folhas do pack (walk/idle/combo/hurt/death/jutsus). */
export function listPackSheets(pack: CharacterPack): SpriteSheetDef[] {
  const sheets: SpriteSheetDef[] = [pack.walk, pack.attack];
  if (pack.idle) sheets.push(pack.idle);
  if (pack.attackChain) sheets.push(...pack.attackChain);
  if (pack.hurt) sheets.push(pack.hurt);
  if (pack.death) sheets.push(pack.death);
  for (const anim of Object.values(pack.skillAnims)) {
    sheets.push(anim);
    if (anim.fx) sheets.push(anim.fx);
  }
  return sheets;
}

/** Chave Phaser da animação de hit reaction do pack. */
export function packHurtAnimKey(pack: CharacterPack): string | null {
  return pack.hurt ? `${pack.id}-hurt` : null;
}

/** Chave Phaser da animação de morte do pack. */
export function packDeathAnimKey(pack: CharacterPack): string | null {
  return pack.death ? `${pack.id}-death` : null;
}

function applyNearestFilter(scene: Phaser.Scene, keys: Iterable<string>): void {
  for (const key of keys) {
    if (!scene.textures.exists(key)) continue;
    scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
}

/**
 * Carrega sob demanda as sheets de um pack (troca de personagem selado).
 * Se a textura já existe com frameWidth/Height diferentes, recarrega.
 */
export function loadCharacterPack(
  scene: Phaser.Scene,
  pack: CharacterPack,
): Promise<void> {
  const sheets = listPackSheets(pack);
  const queued = new Set<string>();

  for (const sheet of sheets) {
    if (queued.has(sheet.key)) continue;

    if (scene.textures.exists(sheet.key)) {
      const existing = scene.textures.get(sheet.key).get(0);
      const sameSize =
        existing != null &&
        existing.width === sheet.frameWidth &&
        existing.height === sheet.frameHeight;
      if (sameSize) continue;
      scene.textures.remove(sheet.key);
    }

    queued.add(sheet.key);
    scene.load.spritesheet(sheet.key, sheet.url, {
      frameWidth: sheet.frameWidth,
      frameHeight: sheet.frameHeight,
    });
  }

  if (queued.size === 0) {
    applyNearestFilter(
      scene,
      sheets.map((s) => s.key),
    );
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    scene.load.once(Phaser.Loader.Events.COMPLETE, () => {
      applyNearestFilter(scene, queued);
      resolve();
    });
    scene.load.start();
  });
}
