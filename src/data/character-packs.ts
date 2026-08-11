import type * as Phaser from 'phaser';
import { CHARACTER_DISPLAY_HEIGHT } from '@/constants/sprites';
import type { WonsrDirection } from '@/data/wonsr-sprites';
import type { StarterCharacterId } from '@/types/player-creation';

/** Avoid runtime `phaser` import — this module is used by React stores during SSR. */
const PHASER_LOADER_COMPLETE = 'complete';
const PHASER_TEXTURE_FILTER_NEAREST = 1;

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
  /**
   * FPS da animação desta folha (walk / idle / combo).
   * Sem valor: walk 12, idle 8, attack 12 (ver Player.ensureAnimations).
   */
  frameRate?: number;
}

export interface CharacterSkillAnimDef extends SpriteSheetDef {
  /** Duração aproximada do lock de movimento (ms). */
  durationMs: number;
  /** Atraso até aplicar dano (ms). */
  hitDelayMs: number;
  /** FPS da animação; sem valor, 12. */
  frameRate?: number;
  /** FX opcional (projétil / chama no alvo). */
  fx?: SpriteSheetDef;
  /**
   * Quando definido, o FX voa do jogador até o alvo: frames 0..N-1 em loop
   * durante o trajeto; frames N..fim no impacto. (ex.: pedra do Jirobo N=2)
   */
  fxFlightFrameCount?: number;
  /**
   * Momento (ms) em que o FX solta:
   * - com `fxFlightFrameCount`: projétil deixa a mão / corpo
   * - sem voo: delay do spawn do FX (padrão: hitDelay−80 no alvo)
   * Ex.: dust no frame 0 do cast → `fxReleaseMs: 0` + `fxAttach: 'caster'`
   */
  fxReleaseMs?: number;
  /**
   * Âncora do FX sem voo. Default `'target'`.
   * `'caster'` = pés do jogador (kick-off / dust do 1º frame).
   */
  fxAttach?: 'caster' | 'target';
  /**
   * Âncora Y do FX: `true` = pés (origin bottom em y), típico dust/rock no chão.
   * Default: pés quando `fxAttach==='caster'`, caso contrário mid-body.
   */
  fxGround?: boolean;
  /**
   * Segundo FX sem voo (ex.: impacto no chão no hitDelay enquanto `fx` é kick-off).
   * Timing: `fxSecondaryReleaseMs` (default = hitDelay). Âncora: `fxSecondaryAttach`.
   */
  fxSecondary?: SpriteSheetDef;
  fxSecondaryReleaseMs?: number;
  fxSecondaryAttach?: 'caster' | 'target';
  /** FPS do FX secundário; padrão 12. */
  fxSecondaryFrameRate?: number;
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
  /**
   * Multiplicador uniforme (altura no mundo). 1 = `CONTENT → CHARACTER_DISPLAY_HEIGHT`.
   * Preferir ajustar `contentHeight` das folhas; isto é override fino.
   */
  displayScale?: number;
  /**
   * Multiplicador só na largura (sobre a escala Y). 1 = sem esmagar horizontal.
   * Fontes densas/largas (ex. Sasuke) usam valor menor que 1.
   */
  displayScaleX?: number;
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
    frameWidth: 139,
    frameHeight: 84,
    frameCount: 48,
    contentHeight: 48,
    frameRate: 12,
    durationMs: 4000,
    hitDelayMs: 2583,
  },
};

const NARUTO_WALK: SpriteSheetDef = {
  key: 'naruto-walk',
  url: '/sprites/player/naruto/walk.png',
  frameWidth: 34,
  frameHeight: 52,
  frameCount: 6,
  contentHeight: 48,
};

const NARUTO_IDLE: SpriteSheetDef = {
  key: 'naruto-idle',
  url: '/sprites/player/naruto/idle.png',
  frameWidth: 37,
  frameHeight: 51,
  frameCount: 6,
  contentHeight: 48,
};

const NARUTO_COMBO_1: SpriteSheetDef = {
  key: 'naruto-combo1',
  url: '/sprites/player/naruto/combo1.png',
  frameWidth: 52,
  frameHeight: 50,
  frameCount: 4,
  contentHeight: 48,
};

const NARUTO_COMBO_2: SpriteSheetDef = {
  key: 'naruto-combo2',
  url: '/sprites/player/naruto/combo2.png',
  frameWidth: 52,
  frameHeight: 50,
  frameCount: 4,
  contentHeight: 48,
};

const NARUTO_COMBO_3: SpriteSheetDef = {
  key: 'naruto-combo3',
  url: '/sprites/player/naruto/combo3.png',
  frameWidth: 52,
  frameHeight: 50,
  frameCount: 4,
  contentHeight: 48,
};

const NARUTO_ATTACK_CHAIN = [NARUTO_COMBO_1, NARUTO_COMBO_2, NARUTO_COMBO_3] as const;

const NARUTO_HURT: CharacterReactionAnimDef = {
  key: 'naruto-hurt',
  url: '/sprites/player/naruto/hurt.png',
  frameWidth: 53,
  frameHeight: 51,
  frameCount: 2,
  contentHeight: 48,
  frameRate: 10,
};

const NARUTO_DEATH: CharacterReactionAnimDef = {
  key: 'naruto-death',
  url: '/sprites/player/naruto/death.png',
  frameWidth: 53,
  frameHeight: 51,
  frameCount: 3,
  contentHeight: 48,
  frameRate: 8,
};

const NARUTO_PACK: CharacterPack = {
  id: 'naruto-classic',
  walk: NARUTO_WALK,
  idle: NARUTO_IDLE,
  attack: NARUTO_COMBO_1,
  attackChain: NARUTO_ATTACK_CHAIN,
  hurt: NARUTO_HURT,
  death: NARUTO_DEATH,
  skillAnims: NARUTO_JUTSU_ANIMS,
  hotbarSkillIds: ['skill-rasengan'],
};

const SASUKE_WALK: SpriteSheetDef = {
  key: 'sasuke-walk',
  url: '/sprites/player/sasuke/walk.png',
  // npm run sasuke:all — assets/naruto-source/nu/sasuke/walk
  frameWidth: 45,
  frameHeight: 52,
  frameCount: 6,
  contentHeight: 48,
};

const SASUKE_IDLE: SpriteSheetDef = {
  key: 'sasuke-idle',
  url: '/sprites/player/sasuke/idle.png',
  frameWidth: 39,
  frameHeight: 52,
  frameCount: 6,
  contentHeight: 48,
};

const SASUKE_COMBO_1: SpriteSheetDef = {
  key: 'sasuke-combo1',
  url: '/sprites/player/sasuke/combo1.png',
  frameWidth: 61,
  frameHeight: 52,
  frameCount: 4,
  contentHeight: 48,
};

const SASUKE_COMBO_2: SpriteSheetDef = {
  key: 'sasuke-combo2',
  url: '/sprites/player/sasuke/combo2.png',
  frameWidth: 61,
  frameHeight: 52,
  frameCount: 4,
  contentHeight: 48,
};

const SASUKE_COMBO_3: SpriteSheetDef = {
  key: 'sasuke-combo3',
  url: '/sprites/player/sasuke/combo3.png',
  frameWidth: 61,
  frameHeight: 52,
  frameCount: 5,
  contentHeight: 48,
};

const SASUKE_ATTACK_CHAIN = [SASUKE_COMBO_1, SASUKE_COMBO_2, SASUKE_COMBO_3] as const;

const SASUKE_HURT: CharacterReactionAnimDef = {
  key: 'sasuke-hurt',
  url: '/sprites/player/sasuke/hurt.png',
  frameWidth: 57,
  frameHeight: 52,
  frameCount: 2,
  contentHeight: 48,
  frameRate: 10,
};

const SASUKE_DEATH: CharacterReactionAnimDef = {
  key: 'sasuke-death',
  url: '/sprites/player/sasuke/death.png',
  frameWidth: 57,
  frameHeight: 52,
  frameCount: 3,
  contentHeight: 48,
  frameRate: 8,
};

const SASUKE_JUTSU_ANIMS: Record<string, CharacterSkillAnimDef> = {
  // Katon Goukakyuu — 17f body cast + fire VFX (flight→impact)
  // npm run sasuke:all && npm run sasuke:gokakyu-fx
  'skill-katon-gokakyu': {
    key: 'sasuke-gokakyu',
    url: '/sprites/player/sasuke/sasuke-gokakyu.png',
    frameWidth: 55,
    frameHeight: 52,
    frameCount: 17,
    contentHeight: 48,
    frameRate: 12,
    // Hold pose through flight + impact
    durationMs: 1600,
    // Damage when fireball impact starts (after short flight from f12 release)
    hitDelayMs: 1110,
    fxFlightFrameCount: 7,
    // f12 of cast @ 12fps ≈ 917ms
    fxReleaseMs: 917,
    fx: {
      key: 'sasuke-gokakyu-fx',
      url: '/sprites/player/sasuke/sasuke-gokakyu-fx.png',
      frameWidth: 76,
      frameHeight: 49,
      frameCount: 12,
      contentHeight: 45,
    },
  },
};

const SASUKE_PACK: CharacterPack = {
  id: 'sasuke-classic',
  walk: SASUKE_WALK,
  idle: SASUKE_IDLE,
  attack: SASUKE_COMBO_1,
  attackChain: SASUKE_ATTACK_CHAIN,
  hurt: SASUKE_HURT,
  death: SASUKE_DEATH,
  skillAnims: SASUKE_JUTSU_ANIMS,
  // Altura = padrão dos packs (contentH 48). Largura esmagada ~20% (art densa).
  displayScale: 1,
  displayScaleX: 0.8,
  hotbarSkillIds: [
    'skill-katon-gokakyu',
    'character-sasuke-skill-3',
    'character-sasuke-skill-4',
  ],
};

const ROCK_LEE_WALK: SpriteSheetDef = {
  key: 'rock-lee-walk',
  url: '/sprites/player/rock-lee/walk.png',
  // npm run rock-lee:all — assets/naruto-source/nu/rock-lee/walk
  frameWidth: 31,
  frameHeight: 52,
  frameCount: 6,
  contentHeight: 48,
};

const ROCK_LEE_IDLE: SpriteSheetDef = {
  key: 'rock-lee-idle',
  url: '/sprites/player/rock-lee/idle.png',
  // npm run rock-lee:all — assets/naruto-source/nu/rock-lee/idle
  frameWidth: 32,
  frameHeight: 51,
  frameCount: 6,
  contentHeight: 48,
};

const ROCK_LEE_COMBO_1: SpriteSheetDef = {
  key: 'rock-lee-combo1',
  url: '/sprites/player/rock-lee/combo1.png',
  // 22f combo → 7+7+8 (npm run rock-lee:all)
  frameWidth: 56,
  frameHeight: 51,
  frameCount: 7,
  contentHeight: 48,
};

const ROCK_LEE_COMBO_2: SpriteSheetDef = {
  key: 'rock-lee-combo2',
  url: '/sprites/player/rock-lee/combo2.png',
  frameWidth: 56,
  frameHeight: 51,
  frameCount: 7,
  contentHeight: 48,
};

const ROCK_LEE_COMBO_3: SpriteSheetDef = {
  key: 'rock-lee-combo3',
  url: '/sprites/player/rock-lee/combo3.png',
  frameWidth: 56,
  frameHeight: 51,
  frameCount: 8,
  contentHeight: 48,
};

const ROCK_LEE_ATTACK_CHAIN = [ROCK_LEE_COMBO_1, ROCK_LEE_COMBO_2, ROCK_LEE_COMBO_3] as const;

const ROCK_LEE_HURT: CharacterReactionAnimDef = {
  key: 'rock-lee-hurt',
  url: '/sprites/player/rock-lee/hurt.png',
  frameWidth: 53,
  frameHeight: 45,
  frameCount: 2,
  contentHeight: 48,
  frameRate: 10,
};

const ROCK_LEE_DEATH: CharacterReactionAnimDef = {
  key: 'rock-lee-death',
  url: '/sprites/player/rock-lee/death.png',
  frameWidth: 53,
  frameHeight: 45,
  frameCount: 3,
  contentHeight: 48,
  frameRate: 8,
};

const ROCK_LEE_JUTSU_ANIMS: Record<string, CharacterSkillAnimDef> = {
  // Omote Renge — 20f @ 14fps: f1 jump · f2–15 air · f16 ground hit
  'skill-omote-renge': {
    key: 'rock-lee-omote-renge',
    url: '/sprites/player/rock-lee/omote-renge.png',
    frameWidth: 77,
    frameHeight: 82,
    frameCount: 20,
    contentHeight: 48,
    frameRate: 14,
    durationMs: 1429,
    // Frame 16 impact: (15 / 14) * 1000
    hitDelayMs: 1071,
    // Kick dust at jump (frame 1)
    fxReleaseMs: 0,
    fxAttach: 'caster',
    fx: {
      key: 'rock-lee-omote-renge-fx',
      url: '/sprites/player/rock-lee/omote-renge-fx.png',
      frameWidth: 51,
      frameHeight: 44,
      frameCount: 1,
      contentHeight: 40,
    },
    // Ground slam dust (frame 16) — 5f strip
    fxSecondaryReleaseMs: 1071,
    fxSecondaryAttach: 'caster',
    fxSecondaryFrameRate: 14,
    fxSecondary: {
      key: 'rock-lee-omote-renge-impact-fx',
      url: '/sprites/player/rock-lee/omote-renge-impact-fx.png',
      frameWidth: 92,
      frameHeight: 76,
      frameCount: 5,
      contentHeight: 72,
    },
  },
};

const ROCK_LEE_PACK: CharacterPack = {
  id: 'rock-lee',
  walk: ROCK_LEE_WALK,
  idle: ROCK_LEE_IDLE,
  attack: ROCK_LEE_COMBO_1,
  attackChain: ROCK_LEE_ATTACK_CHAIN,
  skillAnims: ROCK_LEE_JUTSU_ANIMS,
  hurt: ROCK_LEE_HURT,
  death: ROCK_LEE_DEATH,
  hotbarSkillIds: [
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

/** npm run neji:idle — assets/naruto-source/nu/neji/idle (6f alpha, body-lock) */
const NEJI_IDLE: SpriteSheetDef = {
  key: 'neji-idle',
  url: '/sprites/player/neji/idle.png',
  frameWidth: 37,
  frameHeight: 47,
  frameCount: 6,
  contentHeight: 48,
};

/** npm run neji:walk — assets/naruto-source/nu/neji/walk (6f alpha) */
const NEJI_WALK: SpriteSheetDef = {
  key: 'neji-walk',
  url: '/sprites/player/neji/walk.png',
  frameWidth: 27,
  frameHeight: 52,
  frameCount: 6,
  contentHeight: 48,
};

/** npm run neji:combo — 19f alpha → 5+5+9 (same absoluteScale as walk) */
const NEJI_COMBO_1: SpriteSheetDef = {
  key: 'neji-combo1',
  url: '/sprites/player/neji/combo1.png',
  frameWidth: 57,
  frameHeight: 53,
  frameCount: 5,
  contentHeight: 48,
};

const NEJI_COMBO_2: SpriteSheetDef = {
  key: 'neji-combo2',
  url: '/sprites/player/neji/combo2.png',
  frameWidth: 57,
  frameHeight: 53,
  frameCount: 5,
  contentHeight: 48,
};

const NEJI_COMBO_3: SpriteSheetDef = {
  key: 'neji-combo3',
  url: '/sprites/player/neji/combo3.png',
  frameWidth: 57,
  frameHeight: 53,
  frameCount: 9,
  contentHeight: 48,
};

const NEJI_ATTACK_CHAIN = [NEJI_COMBO_1, NEJI_COMBO_2, NEJI_COMBO_3] as const;

/** Hakkeshou Kaiten — JUTSU COMPLETO 18f alpha. npm run neji:jutsu */
const NEJI_JUTSU_ANIMS: Record<string, CharacterSkillAnimDef> = {
  'skill-hakke-kaiten': {
    key: 'neji-kaiten',
    url: '/sprites/player/neji/kaiten.png',
    frameWidth: 140,
    frameHeight: 91,
    frameCount: 18,
    contentHeight: 48,
    frameRate: 12,
    durationMs: 1500,
    // Hit when blue dome fully formed (frame 5 @ 12fps).
    hitDelayMs: 333,
  },
};

const NEJI_PACK: CharacterPack = {
  id: 'neji',
  walk: NEJI_WALK,
  idle: NEJI_IDLE,
  attack: NEJI_COMBO_1,
  attackChain: NEJI_ATTACK_CHAIN,
  skillAnims: NEJI_JUTSU_ANIMS,
  hotbarSkillIds: ['skill-hakke-kaiten'],
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

/** Sakura Haruno (vocation 1423 + variantes). npm run packs:batch-6 / sakura sources */
export const SAKURA_LOOK_TYPES = [1423, 350, 352] as const;

const SAKURA_IDLE: SpriteSheetDef = {
  key: 'sakura-idle',
  url: '/sprites/player/sakura/idle.png',
  frameWidth: 34,
  frameHeight: 51,
  frameCount: 6,
  contentHeight: 48,
};

const SAKURA_WALK: SpriteSheetDef = {
  key: 'sakura-walk',
  url: '/sprites/player/sakura/walk.png',
  frameWidth: 31,
  frameHeight: 52,
  frameCount: 6,
  contentHeight: 48,
};

const SAKURA_COMBO_1: SpriteSheetDef = {
  key: 'sakura-combo1',
  url: '/sprites/player/sakura/combo1.png',
  frameWidth: 44,
  frameHeight: 52,
  frameCount: 4,
  contentHeight: 48,
};

const SAKURA_COMBO_2: SpriteSheetDef = {
  key: 'sakura-combo2',
  url: '/sprites/player/sakura/combo2.png',
  frameWidth: 44,
  frameHeight: 52,
  frameCount: 4,
  contentHeight: 48,
};

const SAKURA_COMBO_3: SpriteSheetDef = {
  key: 'sakura-combo3',
  url: '/sprites/player/sakura/combo3.png',
  frameWidth: 44,
  frameHeight: 52,
  frameCount: 4,
  contentHeight: 48,
};

const SAKURA_ATTACK_CHAIN = [SAKURA_COMBO_1, SAKURA_COMBO_2, SAKURA_COMBO_3] as const;

const SAKURA_HURT: CharacterReactionAnimDef = {
  key: 'sakura-hurt',
  url: '/sprites/player/sakura/hurt.png',
  frameWidth: 55,
  frameHeight: 47,
  frameCount: 2,
  contentHeight: 48,
  frameRate: 10,
};

const SAKURA_DEATH: CharacterReactionAnimDef = {
  key: 'sakura-death',
  url: '/sprites/player/sakura/death.png',
  frameWidth: 55,
  frameHeight: 47,
  frameCount: 3,
  contentHeight: 48,
  frameRate: 8,
};

const SAKURA_JUTSU_ANIMS: Record<string, CharacterSkillAnimDef> = {
  'skill-chou-bakou': {
    key: 'sakura-chou-bakou',
    url: '/sprites/player/sakura/chou-bakou.png',
    frameWidth: 79,
    frameHeight: 88,
    frameCount: 19,
    contentHeight: 48,
    frameRate: 12,
    durationMs: 1583,
    hitDelayMs: 917,
  },
};

const SAKURA_PACK: CharacterPack = {
  id: 'sakura',
  walk: SAKURA_WALK,
  idle: SAKURA_IDLE,
  attack: SAKURA_COMBO_1,
  attackChain: SAKURA_ATTACK_CHAIN,
  hurt: SAKURA_HURT,
  death: SAKURA_DEATH,
  skillAnims: SAKURA_JUTSU_ANIMS,
  hotbarSkillIds: ['skill-chou-bakou'],
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
 * Might Guy — idle + walk + combo + Asa Kujaku (separate from Rock Lee).
 * npm run guy:idle  — assets/naruto-source/nu/guy/_src/idle/frame_*.png (alpha-only)
 * npm run guy:walk  — assets/naruto-source/nu/guy/walk-sheet.png
 * npm run guy:combo — assets/naruto-source/nu/guy/_src/combo/frame_*.png (20f → 5+5+10)
 * npm run guy:jutsu — assets/naruto-source/nu/guy/_src/jutsu/frame_*.png (16f Asa Kujaku)
 * lookType 9006 é identidade client-only.
 */
export const GUY_CURATED_LOOK_TYPE = 9006;

const GUY_IDLE: SpriteSheetDef = {
  key: 'guy-idle',
  url: '/sprites/player/guy/idle.png',
  // npm run guy:idle — 6f breath; alpha-only
  frameWidth: 28,
  frameHeight: 49,
  frameCount: 6,
  contentHeight: 48,
};

const GUY_WALK: SpriteSheetDef = {
  key: 'guy-walk',
  url: '/sprites/player/guy/walk.png',
  frameWidth: 25,
  frameHeight: 50,
  frameCount: 6,
  contentHeight: 48,
};

const GUY_COMBO_1: SpriteSheetDef = {
  key: 'guy-combo1',
  url: '/sprites/player/guy/combo1.png',
  // frame_001…005 — hit 1
  frameWidth: 49,
  frameHeight: 59,
  frameCount: 5,
  contentHeight: 48,
};

const GUY_COMBO_2: SpriteSheetDef = {
  key: 'guy-combo2',
  url: '/sprites/player/guy/combo2.png',
  // frame_006…010 — hit 2
  frameWidth: 49,
  frameHeight: 59,
  frameCount: 5,
  contentHeight: 48,
};

const GUY_COMBO_3: SpriteSheetDef = {
  key: 'guy-combo3',
  url: '/sprites/player/guy/combo3.png',
  // frame_011…020 — finisher
  frameWidth: 49,
  frameHeight: 59,
  frameCount: 10,
  contentHeight: 48,
};

const GUY_ATTACK_CHAIN = [GUY_COMBO_1, GUY_COMBO_2, GUY_COMBO_3] as const;

const GUY_JUTSU_ANIMS: Record<string, CharacterSkillAnimDef> = {
  // Asa Kujaku — morning peacock flaming strikes (npm run guy:jutsu)
  'skill-asa-kujaku': {
    key: 'guy-asa-kujaku',
    url: '/sprites/player/guy/asa-kujaku.png',
    frameWidth: 58,
    frameHeight: 54,
    frameCount: 16,
    contentHeight: 48,
    frameRate: 14,
    durationMs: 1143,
    // Last frame only: (frameCount - 1) / frameRate * 1000
    hitDelayMs: 1071,
  },
};

const GUY_PACK: CharacterPack = {
  id: 'guy',
  walk: GUY_WALK,
  idle: GUY_IDLE,
  attack: GUY_COMBO_1,
  attackChain: GUY_ATTACK_CHAIN,
  skillAnims: GUY_JUTSU_ANIMS,
  hotbarSkillIds: ['skill-asa-kujaku'],
};

/**
 * Ino Yamanaka — idle + walk + combo + hurt/death + Shinranshin jutsu.
 * npm run ino:idle   — assets/naruto-source/nu/ino/idle/frame_*.png (alpha-only)
 * npm run ino:walk   — assets/naruto-source/nu/ino/walk/frame_*.png
 * npm run ino:combo  — assets/naruto-source/nu/ino/combo/frame_*.png (14f → 5+5+4)
 * npm run ino:damage — assets/naruto-source/nu/ino/damage/frame_*.png (2 hurt + 3 death)
 * npm run ino:jutsu  — assets/naruto-source/nu/ino/jutsu/frame_*.png (body-lock pack)
 * lookType 9007 é identidade client-only; 1169 = vocation WONSR legada.
 */
export const INO_CURATED_LOOK_TYPE = 9007;
/** Vocation WONSR + identidade curada. */
export const INO_LOOK_TYPES = [1169, INO_CURATED_LOOK_TYPE] as const;

const INO_IDLE: SpriteSheetDef = {
  key: 'ino-idle',
  url: '/sprites/player/ino/idle.png',
  // npm run ino:idle — 6f breath; alpha-only
  frameWidth: 24,
  frameHeight: 51,
  frameCount: 6,
  contentHeight: 48,
};

const INO_WALK: SpriteSheetDef = {
  key: 'ino-walk',
  url: '/sprites/player/ino/walk.png',
  frameWidth: 30,
  frameHeight: 51,
  frameCount: 6,
  contentHeight: 48,
};

const INO_COMBO_1: SpriteSheetDef = {
  key: 'ino-combo1',
  url: '/sprites/player/ino/combo1.png',
  // frame_001…005 — hit 1
  frameWidth: 55,
  frameHeight: 52,
  frameCount: 5,
  contentHeight: 48,
};

const INO_COMBO_2: SpriteSheetDef = {
  key: 'ino-combo2',
  url: '/sprites/player/ino/combo2.png',
  // frame_006…010 — hit 2
  frameWidth: 55,
  frameHeight: 52,
  frameCount: 5,
  contentHeight: 48,
};

const INO_COMBO_3: SpriteSheetDef = {
  key: 'ino-combo3',
  url: '/sprites/player/ino/combo3.png',
  // frame_011…014 — finisher
  frameWidth: 55,
  frameHeight: 52,
  frameCount: 4,
  contentHeight: 48,
};

const INO_ATTACK_CHAIN = [INO_COMBO_1, INO_COMBO_2, INO_COMBO_3] as const;

/** npm run ino:damage — frames 1–2 hit reaction. */
const INO_HURT: CharacterReactionAnimDef = {
  key: 'ino-hurt',
  url: '/sprites/player/ino/hurt.png',
  frameWidth: 49,
  frameHeight: 49,
  frameCount: 2,
  contentHeight: 48,
  frameRate: 9,
};

/** npm run ino:damage — frames 3–5 death, hold last. */
const INO_DEATH: CharacterReactionAnimDef = {
  key: 'ino-death',
  url: '/sprites/player/ino/death.png',
  frameWidth: 49,
  frameHeight: 49,
  frameCount: 3,
  contentHeight: 48,
  frameRate: 8,
};

/**
 * Shinranshin (Mind Transfer) — cast strip + beam FX on target.
 * npm run ino:jutsu — 17f alpha sequence; body-lock pack (feetY + bodyCx fixed;
 * pink beam expands). Legacy 3f beam FX kept for target hit.
 */
const INO_JUTSU_ANIMS: Record<string, CharacterSkillAnimDef> = {
  'skill-shinranshin': {
    key: 'ino-shinranshin',
    url: '/sprites/player/ino/shinranshin.png',
    frameWidth: 174,
    frameHeight: 152,
    frameCount: 17,
    contentHeight: 48,
    frameRate: 12,
    durationMs: 1417,
    // Peak starburst late in beam expansion
    hitDelayMs: 1162,
    fx: {
      key: 'ino-shinranshin-fx',
      url: '/sprites/player/ino/shinranshin-fx.png',
      frameWidth: 81,
      frameHeight: 14,
      frameCount: 3,
      contentHeight: 14,
    },
  },
};

const INO_PACK: CharacterPack = {
  id: 'ino',
  walk: INO_WALK,
  idle: INO_IDLE,
  attack: INO_COMBO_1,
  attackChain: INO_ATTACK_CHAIN,
  hurt: INO_HURT,
  death: INO_DEATH,
  skillAnims: INO_JUTSU_ANIMS,
  hotbarSkillIds: ['skill-shinranshin'],
};

/**
 * Hatake Kakashi — idle + walk + combo + hurt/death + Raikiri jutsu.
 * npm run kakashi:idle   — assets/naruto-source/nu/kakashi/idle/frame_*.png (alpha-only, walk-matched scale)
 * npm run kakashi:walk   — assets/naruto-source/nu/kakashi/walk/frame_*.png (alpha-only, max contentH→48)
 * npm run kakashi:combo  — assets/naruto-source/nu/kakashi/combo/frame_*.png (alpha-only, 5+4+4, lanczos3 body-match→48)
 * npm run kakashi:damage — assets/naruto-source/nu/kakashi/damage/frame_*.png (2 hurt + 3 death)
 * npm run kakashi:jutsu  — assets/naruto-source/nu/kakashi/jutsu/frame_*.png (body-lock pack)
 * lookType 9008 é identidade client-only.
 */
export const KAKASHI_CURATED_LOOK_TYPE = 9008;

const KAKASHI_IDLE: SpriteSheetDef = {
  key: 'kakashi-idle',
  url: '/sprites/player/kakashi/idle.png',
  // npm run kakashi:idle — 6f breath; alpha-only; nearest walk-matched; body-lock torso+feet
  frameWidth: 31,
  frameHeight: 48,
  frameCount: 6,
  contentHeight: 48,
};

const KAKASHI_WALK: SpriteSheetDef = {
  key: 'kakashi-walk',
  url: '/sprites/player/kakashi/walk.png',
  // npm run kakashi:walk — 6f side walk; alpha-only; nearest max→48; feet+torso lock
  frameWidth: 26,
  frameHeight: 49,
  frameCount: 6,
  contentHeight: 48,
};

const KAKASHI_COMBO_1: SpriteSheetDef = {
  key: 'kakashi-combo1',
  url: '/sprites/player/kakashi/combo1.png',
  // npm run kakashi:combo — hit 1; alpha-only; lanczos3 body-match→48 (soft HQ); 5+4+4
  frameWidth: 56,
  frameHeight: 57,
  frameCount: 5,
  contentHeight: 48,
};

const KAKASHI_COMBO_2: SpriteSheetDef = {
  key: 'kakashi-combo2',
  url: '/sprites/player/kakashi/combo2.png',
  // hit 2
  frameWidth: 56,
  frameHeight: 57,
  frameCount: 4,
  contentHeight: 48,
};

const KAKASHI_COMBO_3: SpriteSheetDef = {
  key: 'kakashi-combo3',
  url: '/sprites/player/kakashi/combo3.png',
  // finisher
  frameWidth: 56,
  frameHeight: 57,
  frameCount: 4,
  contentHeight: 48,
};

const KAKASHI_ATTACK_CHAIN = [KAKASHI_COMBO_1, KAKASHI_COMBO_2, KAKASHI_COMBO_3] as const;

/** npm run kakashi:damage — frames 1–2 hit reaction. */
const KAKASHI_HURT: CharacterReactionAnimDef = {
  key: 'kakashi-hurt',
  url: '/sprites/player/kakashi/hurt.png',
  frameWidth: 68,
  frameHeight: 51,
  frameCount: 2,
  contentHeight: 48,
  frameRate: 9,
};

/** npm run kakashi:damage — frames 3–5 death, hold last. */
const KAKASHI_DEATH: CharacterReactionAnimDef = {
  key: 'kakashi-death',
  url: '/sprites/player/kakashi/death.png',
  frameWidth: 68,
  frameHeight: 51,
  frameCount: 3,
  contentHeight: 48,
  frameRate: 8,
};

/**
 * Raikiri (Lightning Blade) — 26f cast strip with expanding thunder VFX.
 * npm run kakashi:jutsu — alpha-only body-lock + lanczos3 body-match upright→48.
 */
const KAKASHI_JUTSU_ANIMS: Record<string, CharacterSkillAnimDef> = {
  'skill-raikiri': {
    key: 'kakashi-raikiri',
    url: '/sprites/player/kakashi/raikiri.png',
    frameWidth: 73,
    frameHeight: 53,
    frameCount: 26,
    contentHeight: 48,
    frameRate: 12,
    durationMs: 2167,
    // Peak VFX discharge (frame 18 / 26) — combat dash lands near peak.
    hitDelayMs: 1417,
  },
};

const KAKASHI_PACK: CharacterPack = {
  id: 'kakashi',
  walk: KAKASHI_WALK,
  idle: KAKASHI_IDLE,
  attack: KAKASHI_COMBO_1,
  attackChain: KAKASHI_ATTACK_CHAIN,
  hurt: KAKASHI_HURT,
  death: KAKASHI_DEATH,
  skillAnims: KAKASHI_JUTSU_ANIMS,
  hotbarSkillIds: ['skill-raikiri'],
};

/**
 * Naruto Sage Mode (Sennin) — pack legado (walk only).
 * lookType 9001 é identidade client-only.
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
  idle: NARUTO_SENNIN_WALK,
  attack: NARUTO_SENNIN_WALK,
  skillAnims: NARUTO_JUTSU_ANIMS,
  hotbarSkillIds: ['skill-rasengan'],
};

/**
 * Naruto Kyūbi cloak — full lateral pack.
 * npm run packs:batch-6 — assets/naruto-source/nu/naruto-kyubi/
 * lookType 9020 client-only.
 */
export const NARUTO_KYUBI_CURATED_LOOK_TYPE = 9020;

const NARUTO_KYUBI_WALK: SpriteSheetDef = {
  key: 'naruto-kyubi-walk',
  url: '/sprites/player/naruto-kyubi/walk.png',
  frameWidth: 52,
  frameHeight: 52,
  frameCount: 6,
  contentHeight: 48,
};

const NARUTO_KYUBI_IDLE: SpriteSheetDef = {
  key: 'naruto-kyubi-idle',
  url: '/sprites/player/naruto-kyubi/idle.png',
  frameWidth: 56,
  frameHeight: 52,
  frameCount: 6,
  contentHeight: 48,
};

const NARUTO_KYUBI_COMBO_1: SpriteSheetDef = {
  key: 'naruto-kyubi-combo1',
  url: '/sprites/player/naruto-kyubi/combo1.png',
  frameWidth: 67,
  frameHeight: 52,
  frameCount: 4,
  contentHeight: 48,
};

const NARUTO_KYUBI_COMBO_2: SpriteSheetDef = {
  key: 'naruto-kyubi-combo2',
  url: '/sprites/player/naruto-kyubi/combo2.png',
  frameWidth: 67,
  frameHeight: 52,
  frameCount: 4,
  contentHeight: 48,
};

const NARUTO_KYUBI_COMBO_3: SpriteSheetDef = {
  key: 'naruto-kyubi-combo3',
  url: '/sprites/player/naruto-kyubi/combo3.png',
  frameWidth: 67,
  frameHeight: 52,
  frameCount: 5,
  contentHeight: 48,
};

const NARUTO_KYUBI_ATTACK_CHAIN = [
  NARUTO_KYUBI_COMBO_1,
  NARUTO_KYUBI_COMBO_2,
  NARUTO_KYUBI_COMBO_3,
] as const;

const NARUTO_KYUBI_HURT: CharacterReactionAnimDef = {
  key: 'naruto-kyubi-hurt',
  url: '/sprites/player/naruto-kyubi/hurt.png',
  frameWidth: 54,
  frameHeight: 52,
  frameCount: 2,
  contentHeight: 48,
  frameRate: 10,
};

const NARUTO_KYUBI_DEATH: CharacterReactionAnimDef = {
  key: 'naruto-kyubi-death',
  url: '/sprites/player/naruto-kyubi/death.png',
  frameWidth: 54,
  frameHeight: 52,
  frameCount: 5,
  contentHeight: 48,
  frameRate: 8,
};

const NARUTO_KYUBI_JUTSU_ANIMS: Record<string, CharacterSkillAnimDef> = {
  'skill-kurama-mode': {
    key: 'naruto-kyuubi',
    url: '/sprites/player/naruto-kyubi/kyuubi.png',
    frameWidth: 161,
    frameHeight: 108,
    frameCount: 36,
    contentHeight: 48,
    frameRate: 12,
    durationMs: 3000,
    hitDelayMs: 2000,
  },
};

const NARUTO_KYUBI_PACK: CharacterPack = {
  id: 'naruto-kyubi',
  walk: NARUTO_KYUBI_WALK,
  idle: NARUTO_KYUBI_IDLE,
  attack: NARUTO_KYUBI_COMBO_1,
  attackChain: NARUTO_KYUBI_ATTACK_CHAIN,
  hurt: NARUTO_KYUBI_HURT,
  death: NARUTO_KYUBI_DEATH,
  skillAnims: NARUTO_KYUBI_JUTSU_ANIMS,
  hotbarSkillIds: ['skill-kurama-mode'],
};

/**
 * Uchiha Itachi — full lateral pack (alpha-only clean sources).
 * npm run itachi:all — assets/naruto-source/nu/itachi/{idle,walk,combo,damage,jutsu}
 * Black hair: alpha-only only (never black chroma key).
 * Walk+combo share absoluteScale (walk max contentH → 48). contentH 48 / display 52.
 *
 * lookType 9002 é identidade client-only (não vem do DAT/SPR WONSR).
 */
export const UCHIHA_ITACHI_LOOK_TYPE = 9002;

const UCHIHA_ITACHI_IDLE: SpriteSheetDef = {
  key: 'itachi-idle',
  url: '/sprites/player/itachi/idle.png',
  // npm run itachi:idle — 4f breath; alpha-only body-lock + walk absoluteScale
  frameWidth: 24,
  frameHeight: 49,
  frameCount: 4,
  contentHeight: 48,
};

const UCHIHA_ITACHI_WALK: SpriteSheetDef = {
  key: 'itachi-walk',
  url: '/sprites/player/itachi/walk.png',
  // npm run itachi:walk — 6f side walk; uniform global scale (max contentH → 48)
  frameWidth: 26,
  frameHeight: 52,
  frameCount: 6,
  contentHeight: 48,
};

const UCHIHA_ITACHI_COMBO_1: SpriteSheetDef = {
  key: 'itachi-combo1',
  url: '/sprites/player/itachi/combo1.png',
  // npm run itachi:combo — hit 1; scale matched to walk
  frameWidth: 54,
  frameHeight: 52,
  frameCount: 5,
  contentHeight: 48,
};

const UCHIHA_ITACHI_COMBO_2: SpriteSheetDef = {
  key: 'itachi-combo2',
  url: '/sprites/player/itachi/combo2.png',
  // hit 2
  frameWidth: 54,
  frameHeight: 52,
  frameCount: 5,
  contentHeight: 48,
};

const UCHIHA_ITACHI_COMBO_3: SpriteSheetDef = {
  key: 'itachi-combo3',
  url: '/sprites/player/itachi/combo3.png',
  // finisher
  frameWidth: 54,
  frameHeight: 52,
  frameCount: 3,
  contentHeight: 48,
};

const UCHIHA_ITACHI_ATTACK_CHAIN = [
  UCHIHA_ITACHI_COMBO_1,
  UCHIHA_ITACHI_COMBO_2,
  UCHIHA_ITACHI_COMBO_3,
] as const;

/** npm run itachi:damage — frames 1–2 hit reaction. */
const UCHIHA_ITACHI_HURT: CharacterReactionAnimDef = {
  key: 'itachi-hurt',
  url: '/sprites/player/itachi/hurt.png',
  frameWidth: 59,
  frameHeight: 51,
  frameCount: 2,
  contentHeight: 48,
  frameRate: 9,
};

/** npm run itachi:damage — frames 3–5 death, hold last. */
const UCHIHA_ITACHI_DEATH: CharacterReactionAnimDef = {
  key: 'itachi-death',
  url: '/sprites/player/itachi/death.png',
  frameWidth: 59,
  frameHeight: 51,
  frameCount: 3,
  contentHeight: 48,
  frameRate: 8,
};

/**
 * Amaterasu — 12f body cast + separate black-flame FX on target.
 * npm run itachi:jutsu + itachi:amaterasu-fx
 * FX spawns at hitDelay−80 (combat-system playPackFx on target).
 */
const UCHIHA_ITACHI_JUTSU_ANIMS: Record<string, CharacterSkillAnimDef> = {
  'skill-amaterasu': {
    key: 'itachi-amaterasu',
    url: '/sprites/player/itachi/amaterasu.png',
    frameWidth: 23,
    frameHeight: 49,
    frameCount: 12,
    contentHeight: 48,
    frameRate: 12,
    durationMs: 1000,
    hitDelayMs: 917,
    fx: {
      key: 'itachi-amaterasu-fx',
      url: '/sprites/player/itachi/amaterasu-fx.png',
      frameWidth: 44,
      frameHeight: 52,
      frameCount: 19,
      contentHeight: 52,
    },
  },
};

const UCHIHA_ITACHI_PACK: CharacterPack = {
  id: 'uchiha-itachi',
  walk: UCHIHA_ITACHI_WALK,
  idle: UCHIHA_ITACHI_IDLE,
  attack: UCHIHA_ITACHI_COMBO_1,
  attackChain: UCHIHA_ITACHI_ATTACK_CHAIN,
  hurt: UCHIHA_ITACHI_HURT,
  death: UCHIHA_ITACHI_DEATH,
  skillAnims: UCHIHA_ITACHI_JUTSU_ANIMS,
  hotbarSkillIds: ['skill-amaterasu'],
};

/**
 * Jiraiya (Sannin) — pack completo (idle + walk + combo + hurt/death + kuchiyose).
 * npm run jiraiya:walk  — assets/naruto-source/nu/jiraiya/walk/frame_*.png
 * npm run jiraiya:idle  — assets/naruto-source/nu/jiraiya/idle/frame_*.png
 * npm run jiraiya:combo — assets/naruto-source/nu/jiraiya/combo/frame_*.png (18f → 5+5+8)
 * npm run jiraiya:damage — hurt 3f + death 4f
 * npm run jiraiya:jutsu — Kuchiyose 23f body-lock (toad + oil-flame)
 * Alpha-only (clean transparent); contentH=48; residualGreen 0; white hair preserved.
 * lookType 9009 é identidade client-only; 1402 = vocation WONSR base; 150 = outfit Saga 6 / NPC / Edo.
 *
 * Scale: walk max→48 shared with idle; combo body-match nearest→48 so baseScale matches.
 */
export const JIRAIYA_CURATED_LOOK_TYPE = 9009;
/** Vocation WONSR + outfits legados + identidade curada. */
export const JIRAIYA_LOOK_TYPES = [1402, 150, JIRAIYA_CURATED_LOOK_TYPE] as const;

const JIRAIYA_IDLE: SpriteSheetDef = {
  key: 'jiraiya-idle',
  url: '/sprites/player/jiraiya/idle.png',
  // npm run jiraiya:idle — 6f breath; alpha-only; nearest walk-matched; body-lock torso+feet
  frameWidth: 29,
  frameHeight: 49,
  frameCount: 6,
  contentHeight: 48,
};

const JIRAIYA_WALK: SpriteSheetDef = {
  key: 'jiraiya-walk',
  url: '/sprites/player/jiraiya/walk.png',
  // npm run jiraiya:walk — 6f side walk; alpha-only; nearest max→48; feet+torso lock
  frameWidth: 28,
  frameHeight: 49,
  frameCount: 6,
  contentHeight: 48,
};

const JIRAIYA_COMBO_1: SpriteSheetDef = {
  key: 'jiraiya-combo1',
  url: '/sprites/player/jiraiya/combo1.png',
  // npm run jiraiya:combo — hit 1; alpha-only; nearest body-match→48; 5+5+8
  frameWidth: 53,
  frameHeight: 59,
  frameCount: 5,
  contentHeight: 48,
};

const JIRAIYA_COMBO_2: SpriteSheetDef = {
  key: 'jiraiya-combo2',
  url: '/sprites/player/jiraiya/combo2.png',
  // mid combo
  frameWidth: 53,
  frameHeight: 59,
  frameCount: 5,
  contentHeight: 48,
};

const JIRAIYA_COMBO_3: SpriteSheetDef = {
  key: 'jiraiya-combo3',
  url: '/sprites/player/jiraiya/combo3.png',
  // overhead finisher + recovery
  frameWidth: 53,
  frameHeight: 59,
  frameCount: 8,
  contentHeight: 48,
};

const JIRAIYA_ATTACK_CHAIN = [JIRAIYA_COMBO_1, JIRAIYA_COMBO_2, JIRAIYA_COMBO_3] as const;

/** npm run jiraiya:damage — frames 1–3 hit reaction. */
const JIRAIYA_HURT: CharacterReactionAnimDef = {
  key: 'jiraiya-hurt',
  url: '/sprites/player/jiraiya/hurt.png',
  frameWidth: 50,
  frameHeight: 51,
  frameCount: 3,
  contentHeight: 48,
  frameRate: 9,
};

/** npm run jiraiya:damage — frames 4–7 death, hold last. */
const JIRAIYA_DEATH: CharacterReactionAnimDef = {
  key: 'jiraiya-death',
  url: '/sprites/player/jiraiya/death.png',
  frameWidth: 50,
  frameHeight: 51,
  frameCount: 4,
  contentHeight: 48,
  frameRate: 8,
};

/**
 * Kuchiyose no Jutsu — 23f cast (seals → toad → oil-flame).
 * npm run jiraiya:jutsu — body-lock pack (feetY fixed; fire expands).
 */
const JIRAIYA_JUTSU_ANIMS: Record<string, CharacterSkillAnimDef> = {
  'skill-kuchiyose': {
    key: 'jiraiya-kuchiyose',
    url: '/sprites/player/jiraiya/kuchiyose.png',
    frameWidth: 151,
    frameHeight: 69,
    frameCount: 23,
    contentHeight: 48,
    frameRate: 12,
    durationMs: 1917,
    // Flame peak ~frame 18 — combat applies hit in the last third of the cast.
    hitDelayMs: 1481,
  },
};

const JIRAIYA_PACK: CharacterPack = {
  id: 'jiraiya',
  walk: JIRAIYA_WALK,
  idle: JIRAIYA_IDLE,
  attack: JIRAIYA_COMBO_1,
  attackChain: JIRAIYA_ATTACK_CHAIN,
  hurt: JIRAIYA_HURT,
  death: JIRAIYA_DEATH,
  skillAnims: JIRAIYA_JUTSU_ANIMS,
  hotbarSkillIds: ['skill-kuchiyose'],
};

/**
 * Jirobo (Sound Four) — idle + walk + combo + hurt/death + Doton jutsu.
 * npm run jirobo:all — assets/naruto-source/nu/jirobo/{idle,walk,combo,damage,jutsu}/
 * lookType 9010 é identidade client-only; 536 / 763 = monstros WONSR Jiroubou.
 */
export const JIROBO_CURATED_LOOK_TYPE = 9010;
/** lookTypes WONSR de caça/saga + identidade curada (substituem outfit 4-dir). */
export const JIROBO_LOOK_TYPES = [536, 763, JIROBO_CURATED_LOOK_TYPE] as const;

/** lookTypes de caça/selamento para starters (sem vocation WONSR). */
export const NARUTO_CLASSIC_LOOK_TYPE = 9011;
export const SASUKE_CLASSIC_LOOK_TYPE = 9012;
export const ROCK_LEE_LOOK_TYPE = 9013;

const JIROBO_IDLE: SpriteSheetDef = {
  key: 'jirobo-idle',
  url: '/sprites/player/jirobo/idle.png',
  frameWidth: 39,
  frameHeight: 50,
  frameCount: 6,
  contentHeight: 48,
};

const JIROBO_WALK: SpriteSheetDef = {
  key: 'jirobo-walk',
  url: '/sprites/player/jirobo/walk.png',
  frameWidth: 33,
  frameHeight: 49,
  frameCount: 6,
  contentHeight: 48,
};

const JIROBO_COMBO_1: SpriteSheetDef = {
  key: 'jirobo-combo1',
  url: '/sprites/player/jirobo/combo1.png',
  frameWidth: 56,
  frameHeight: 52,
  frameCount: 6,
  contentHeight: 48,
};

const JIROBO_COMBO_2: SpriteSheetDef = {
  key: 'jirobo-combo2',
  url: '/sprites/player/jirobo/combo2.png',
  frameWidth: 56,
  frameHeight: 52,
  frameCount: 5,
  contentHeight: 48,
};

const JIROBO_COMBO_3: SpriteSheetDef = {
  key: 'jirobo-combo3',
  url: '/sprites/player/jirobo/combo3.png',
  frameWidth: 56,
  frameHeight: 52,
  frameCount: 5,
  contentHeight: 48,
};

const JIROBO_ATTACK_CHAIN = [JIROBO_COMBO_1, JIROBO_COMBO_2, JIROBO_COMBO_3] as const;

const JIROBO_HURT: CharacterReactionAnimDef = {
  key: 'jirobo-hurt',
  url: '/sprites/player/jirobo/hurt.png',
  frameWidth: 65,
  frameHeight: 52,
  frameCount: 3,
  contentHeight: 48,
  frameRate: 9,
};

const JIROBO_DEATH: CharacterReactionAnimDef = {
  key: 'jirobo-death',
  url: '/sprites/player/jirobo/death.png',
  frameWidth: 65,
  frameHeight: 52,
  frameCount: 3,
  contentHeight: 48,
  frameRate: 8,
};

const JIROBO_JUTSU_ANIMS: Record<string, CharacterSkillAnimDef> = {
  'skill-doryuheki': {
    key: 'jirobo-doryuheki',
    url: '/sprites/player/jirobo/doryuheki.png',
    frameWidth: 90,
    frameHeight: 75,
    frameCount: 11,
    contentHeight: 48,
    frameRate: 12,
    // Cast holds the rock overhead through ~f9; rock leaves body at f10.
    durationMs: 1000,
    // Damage when thrown rock reaches the target (after short flight).
    hitDelayMs: 920,
    // npm run jirobo:jutsu-fx — pedra em voo (2f loop) + impacto (10f)
    // Release only after lift wind-up (frame 10 @ 12fps ≈ 750ms).
    fxFlightFrameCount: 2,
    fxReleaseMs: 750,
    fx: {
      key: 'jirobo-doryuheki-fx',
      url: '/sprites/player/jirobo/doryuheki-fx.png',
      frameWidth: 48,
      frameHeight: 34,
      frameCount: 12,
      contentHeight: 34,
    },
  },
};

const JIROBO_PACK: CharacterPack = {
  id: 'jirobo',
  walk: JIROBO_WALK,
  idle: JIROBO_IDLE,
  attack: JIROBO_COMBO_1,
  attackChain: JIROBO_ATTACK_CHAIN,
  hurt: JIROBO_HURT,
  death: JIROBO_DEATH,
  skillAnims: JIROBO_JUTSU_ANIMS,
  hotbarSkillIds: ['skill-doryuheki'],
};

/**
 * Yakushi Kabuto — idle + walk + combo + hurt/death + Senpō Hakugeki.
 * npm run kabuto:all — assets/naruto-source/nu/kabuto/
 */
export const KABUTO_CURATED_LOOK_TYPE = 9014;

const KABUTO_WALK: SpriteSheetDef = {
  key: 'kabuto-walk',
  url: '/sprites/player/kabuto/walk.png',
  frameWidth: 40,
  frameHeight: 52,
  frameCount: 5,
  contentHeight: 48,
};

const KABUTO_IDLE: SpriteSheetDef = {
  key: 'kabuto-idle',
  url: '/sprites/player/kabuto/idle.png',
  frameWidth: 29,
  frameHeight: 64,
  frameCount: 13,
  contentHeight: 48,
};

const KABUTO_COMBO_1: SpriteSheetDef = {
  key: 'kabuto-combo1',
  url: '/sprites/player/kabuto/combo1.png',
  frameWidth: 60,
  frameHeight: 54,
  frameCount: 4,
  contentHeight: 48,
};

const KABUTO_COMBO_2: SpriteSheetDef = {
  key: 'kabuto-combo2',
  url: '/sprites/player/kabuto/combo2.png',
  frameWidth: 60,
  frameHeight: 54,
  frameCount: 4,
  contentHeight: 48,
};

const KABUTO_COMBO_3: SpriteSheetDef = {
  key: 'kabuto-combo3',
  url: '/sprites/player/kabuto/combo3.png',
  frameWidth: 60,
  frameHeight: 54,
  frameCount: 5,
  contentHeight: 48,
};

const KABUTO_ATTACK_CHAIN = [KABUTO_COMBO_1, KABUTO_COMBO_2, KABUTO_COMBO_3] as const;

const KABUTO_HURT: CharacterReactionAnimDef = {
  key: 'kabuto-hurt',
  url: '/sprites/player/kabuto/hurt.png',
  frameWidth: 51,
  frameHeight: 50,
  frameCount: 2,
  contentHeight: 48,
  frameRate: 10,
};

const KABUTO_DEATH: CharacterReactionAnimDef = {
  key: 'kabuto-death',
  url: '/sprites/player/kabuto/death.png',
  frameWidth: 51,
  frameHeight: 50,
  frameCount: 3,
  contentHeight: 48,
  frameRate: 8,
};

const KABUTO_JUTSU_ANIMS: Record<string, CharacterSkillAnimDef> = {
  'skill-senpo-hakugeki': {
    key: 'kabuto-senpo-hakugeki',
    url: '/sprites/player/kabuto/senpo-hakugeki.png',
    frameWidth: 70,
    frameHeight: 64,
    frameCount: 54,
    contentHeight: 48,
    frameRate: 14,
    durationMs: 3857,
    hitDelayMs: 3143,
  },
};

const KABUTO_PACK: CharacterPack = {
  id: 'kabuto',
  walk: KABUTO_WALK,
  idle: KABUTO_IDLE,
  attack: KABUTO_COMBO_1,
  attackChain: KABUTO_ATTACK_CHAIN,
  hurt: KABUTO_HURT,
  death: KABUTO_DEATH,
  skillAnims: KABUTO_JUTSU_ANIMS,
  hotbarSkillIds: ['skill-senpo-hakugeki'],
};

/**
 * Tsunade — idle + walk + combo + hurt/death + Tsūtenkyaku.
 * npm run tsunade:all — assets/naruto-source/nu/tsunade/
 */
export const TSUNADE_CURATED_LOOK_TYPE = 9015;

const TSUNADE_WALK: SpriteSheetDef = {
  key: 'tsunade-walk',
  url: '/sprites/player/tsunade/walk.png',
  frameWidth: 26,
  frameHeight: 52,
  frameCount: 6,
  contentHeight: 48,
};

const TSUNADE_IDLE: SpriteSheetDef = {
  key: 'tsunade-idle',
  url: '/sprites/player/tsunade/idle.png',
  frameWidth: 28,
  frameHeight: 53,
  frameCount: 6,
  contentHeight: 48,
};

const TSUNADE_COMBO_1: SpriteSheetDef = {
  key: 'tsunade-combo1',
  url: '/sprites/player/tsunade/combo1.png',
  frameWidth: 47,
  frameHeight: 52,
  frameCount: 5,
  contentHeight: 48,
};

const TSUNADE_COMBO_2: SpriteSheetDef = {
  key: 'tsunade-combo2',
  url: '/sprites/player/tsunade/combo2.png',
  frameWidth: 47,
  frameHeight: 52,
  frameCount: 5,
  contentHeight: 48,
};

const TSUNADE_COMBO_3: SpriteSheetDef = {
  key: 'tsunade-combo3',
  url: '/sprites/player/tsunade/combo3.png',
  frameWidth: 47,
  frameHeight: 52,
  frameCount: 4,
  contentHeight: 48,
};

const TSUNADE_ATTACK_CHAIN = [TSUNADE_COMBO_1, TSUNADE_COMBO_2, TSUNADE_COMBO_3] as const;

const TSUNADE_HURT: CharacterReactionAnimDef = {
  key: 'tsunade-hurt',
  url: '/sprites/player/tsunade/hurt.png',
  frameWidth: 49,
  frameHeight: 49,
  frameCount: 2,
  contentHeight: 48,
  frameRate: 10,
};

const TSUNADE_DEATH: CharacterReactionAnimDef = {
  key: 'tsunade-death',
  url: '/sprites/player/tsunade/death.png',
  frameWidth: 49,
  frameHeight: 49,
  frameCount: 3,
  contentHeight: 48,
  frameRate: 8,
};

const TSUNADE_JUTSU_ANIMS: Record<string, CharacterSkillAnimDef> = {
  'skill-tsutenkyaku': {
    key: 'tsunade-tsutenkyaku',
    url: '/sprites/player/tsunade/tsutenkyaku.png',
    frameWidth: 118,
    frameHeight: 81,
    frameCount: 20,
    contentHeight: 48,
    frameRate: 12,
    durationMs: 1667,
    hitDelayMs: 667,
  },
};

const TSUNADE_PACK: CharacterPack = {
  id: 'tsunade',
  walk: TSUNADE_WALK,
  idle: TSUNADE_IDLE,
  attack: TSUNADE_COMBO_1,
  attackChain: TSUNADE_ATTACK_CHAIN,
  hurt: TSUNADE_HURT,
  death: TSUNADE_DEATH,
  skillAnims: TSUNADE_JUTSU_ANIMS,
  hotbarSkillIds: ['skill-tsutenkyaku'],
};

/**
 * Kiba Inuzuka — idle + walk + combo + hurt/death + Gatsuuga.
 * npm run kiba:all — assets/naruto-source/nu/kiba/
 */
export const KIBA_CURATED_LOOK_TYPE = 9016;

const KIBA_WALK: SpriteSheetDef = {
  key: 'kiba-walk',
  url: '/sprites/player/kiba/walk.png',
  frameWidth: 40,
  frameHeight: 52,
  frameCount: 6,
  contentHeight: 48,
};

const KIBA_IDLE: SpriteSheetDef = {
  key: 'kiba-idle',
  url: '/sprites/player/kiba/idle.png',
  frameWidth: 39,
  frameHeight: 52,
  frameCount: 6,
  contentHeight: 48,
};

const KIBA_COMBO_1: SpriteSheetDef = {
  key: 'kiba-combo1',
  url: '/sprites/player/kiba/combo1.png',
  frameWidth: 52,
  frameHeight: 51,
  frameCount: 4,
  contentHeight: 48,
};

const KIBA_COMBO_2: SpriteSheetDef = {
  key: 'kiba-combo2',
  url: '/sprites/player/kiba/combo2.png',
  frameWidth: 52,
  frameHeight: 51,
  frameCount: 4,
  contentHeight: 48,
};

const KIBA_COMBO_3: SpriteSheetDef = {
  key: 'kiba-combo3',
  url: '/sprites/player/kiba/combo3.png',
  frameWidth: 52,
  frameHeight: 51,
  frameCount: 5,
  contentHeight: 48,
};

const KIBA_ATTACK_CHAIN = [KIBA_COMBO_1, KIBA_COMBO_2, KIBA_COMBO_3] as const;

const KIBA_HURT: CharacterReactionAnimDef = {
  key: 'kiba-hurt',
  url: '/sprites/player/kiba/hurt.png',
  frameWidth: 59,
  frameHeight: 51,
  frameCount: 2,
  contentHeight: 48,
  frameRate: 10,
};

const KIBA_DEATH: CharacterReactionAnimDef = {
  key: 'kiba-death',
  url: '/sprites/player/kiba/death.png',
  frameWidth: 59,
  frameHeight: 51,
  frameCount: 3,
  contentHeight: 48,
  frameRate: 8,
};

const KIBA_JUTSU_ANIMS: Record<string, CharacterSkillAnimDef> = {
  'skill-gatsuuga': {
    key: 'kiba-gatsuuga',
    url: '/sprites/player/kiba/gatsuuga.png',
    frameWidth: 218,
    frameHeight: 128,
    frameCount: 32,
    contentHeight: 48,
    frameRate: 12,
    durationMs: 2667,
    hitDelayMs: 1750,
  },
};

const KIBA_PACK: CharacterPack = {
  id: 'kiba',
  walk: KIBA_WALK,
  idle: KIBA_IDLE,
  attack: KIBA_COMBO_1,
  attackChain: KIBA_ATTACK_CHAIN,
  hurt: KIBA_HURT,
  death: KIBA_DEATH,
  skillAnims: KIBA_JUTSU_ANIMS,
  hotbarSkillIds: ['skill-gatsuuga'],
};

/**
 * Kimimaro — idle + walk + combo + hurt/death + Tessenka no Mai.
 * npm run kimimaro:all — assets/naruto-source/nu/kimimaro/
 */
export const KIMIMARO_CURATED_LOOK_TYPE = 9017;

const KIMIMARO_WALK: SpriteSheetDef = {
  key: 'kimimaro-walk',
  url: '/sprites/player/kimimaro/walk.png',
  frameWidth: 25,
  frameHeight: 52,
  frameCount: 6,
  contentHeight: 48,
};

const KIMIMARO_IDLE: SpriteSheetDef = {
  key: 'kimimaro-idle',
  url: '/sprites/player/kimimaro/idle.png',
  frameWidth: 27,
  frameHeight: 52,
  frameCount: 6,
  contentHeight: 48,
};

const KIMIMARO_COMBO_1: SpriteSheetDef = {
  key: 'kimimaro-combo1',
  url: '/sprites/player/kimimaro/combo1.png',
  frameWidth: 60,
  frameHeight: 52,
  frameCount: 4,
  contentHeight: 48,
};

const KIMIMARO_COMBO_2: SpriteSheetDef = {
  key: 'kimimaro-combo2',
  url: '/sprites/player/kimimaro/combo2.png',
  frameWidth: 60,
  frameHeight: 52,
  frameCount: 4,
  contentHeight: 48,
};

const KIMIMARO_COMBO_3: SpriteSheetDef = {
  key: 'kimimaro-combo3',
  url: '/sprites/player/kimimaro/combo3.png',
  frameWidth: 60,
  frameHeight: 52,
  frameCount: 3,
  contentHeight: 48,
};

const KIMIMARO_ATTACK_CHAIN = [KIMIMARO_COMBO_1, KIMIMARO_COMBO_2, KIMIMARO_COMBO_3] as const;

const KIMIMARO_HURT: CharacterReactionAnimDef = {
  key: 'kimimaro-hurt',
  url: '/sprites/player/kimimaro/hurt.png',
  frameWidth: 58,
  frameHeight: 47,
  frameCount: 2,
  contentHeight: 48,
  frameRate: 10,
};

const KIMIMARO_DEATH: CharacterReactionAnimDef = {
  key: 'kimimaro-death',
  url: '/sprites/player/kimimaro/death.png',
  frameWidth: 58,
  frameHeight: 47,
  frameCount: 4,
  contentHeight: 48,
  frameRate: 8,
};

const KIMIMARO_JUTSU_ANIMS: Record<string, CharacterSkillAnimDef> = {
  'skill-tessenka-no-mai': {
    key: 'kimimaro-tessenka-no-mai',
    url: '/sprites/player/kimimaro/tessenka-no-mai.png',
    frameWidth: 134,
    frameHeight: 52,
    frameCount: 17,
    contentHeight: 48,
    frameRate: 12,
    durationMs: 1417,
    hitDelayMs: 917,
    // Bone impact VFX: spawn near hit so peak covers frame ~12 body contact
    fxReleaseMs: 750,
    fxAttach: 'target',
    fx: {
      key: 'kimimaro-tessenka-no-mai-fx',
      url: '/sprites/player/kimimaro/tessenka-no-mai-fx.png',
      frameWidth: 46,
      frameHeight: 60,
      frameCount: 6,
      contentHeight: 56,
    },
  },
};

const KIMIMARO_PACK: CharacterPack = {
  id: 'kimimaro',
  walk: KIMIMARO_WALK,
  idle: KIMIMARO_IDLE,
  attack: KIMIMARO_COMBO_1,
  attackChain: KIMIMARO_ATTACK_CHAIN,
  hurt: KIMIMARO_HURT,
  death: KIMIMARO_DEATH,
  skillAnims: KIMIMARO_JUTSU_ANIMS,
  hotbarSkillIds: ['skill-tessenka-no-mai'],
};

/**
 * Uchiha Sasuke (Cursed Seal) — full pack.
 * npm run packs:batch-6 — assets/naruto-source/nu/sasuke-cursed/
 */
export const SASUKE_CURSED_CURATED_LOOK_TYPE = 9018;

const SASUKE_CURSED_WALK: SpriteSheetDef = {
  key: 'sasuke-cursed-walk',
  url: '/sprites/player/sasuke-cursed/walk.png',
  frameWidth: 36,
  frameHeight: 52,
  frameCount: 8,
  contentHeight: 48,
};

const SASUKE_CURSED_IDLE: SpriteSheetDef = {
  key: 'sasuke-cursed-idle',
  url: '/sprites/player/sasuke-cursed/idle.png',
  frameWidth: 36,
  frameHeight: 52,
  frameCount: 6,
  contentHeight: 48,
};

const SASUKE_CURSED_COMBO_1: SpriteSheetDef = {
  key: 'sasuke-cursed-combo1',
  url: '/sprites/player/sasuke-cursed/combo1.png',
  frameWidth: 55,
  frameHeight: 52,
  frameCount: 6,
  contentHeight: 48,
};

const SASUKE_CURSED_COMBO_2: SpriteSheetDef = {
  key: 'sasuke-cursed-combo2',
  url: '/sprites/player/sasuke-cursed/combo2.png',
  frameWidth: 55,
  frameHeight: 52,
  frameCount: 6,
  contentHeight: 48,
};

const SASUKE_CURSED_COMBO_3: SpriteSheetDef = {
  key: 'sasuke-cursed-combo3',
  url: '/sprites/player/sasuke-cursed/combo3.png',
  frameWidth: 55,
  frameHeight: 52,
  frameCount: 6,
  contentHeight: 48,
};

const SASUKE_CURSED_ATTACK_CHAIN = [
  SASUKE_CURSED_COMBO_1,
  SASUKE_CURSED_COMBO_2,
  SASUKE_CURSED_COMBO_3,
] as const;

const SASUKE_CURSED_HURT: CharacterReactionAnimDef = {
  key: 'sasuke-cursed-hurt',
  url: '/sprites/player/sasuke-cursed/hurt.png',
  frameWidth: 44,
  frameHeight: 51,
  frameCount: 2,
  contentHeight: 48,
  frameRate: 10,
};

const SASUKE_CURSED_DEATH: CharacterReactionAnimDef = {
  key: 'sasuke-cursed-death',
  url: '/sprites/player/sasuke-cursed/death.png',
  frameWidth: 44,
  frameHeight: 51,
  frameCount: 4,
  contentHeight: 48,
  frameRate: 8,
};

const SASUKE_CURSED_JUTSU_ANIMS: Record<string, CharacterSkillAnimDef> = {
  'skill-chidori-nagashi': {
    key: 'sasuke-cursed-chidori-nagashi',
    url: '/sprites/player/sasuke-cursed/chidori-nagashi.png',
    frameWidth: 75,
    frameHeight: 59,
    frameCount: 38,
    contentHeight: 48,
    frameRate: 12,
    durationMs: 3167,
    hitDelayMs: 2083,
  },
};

const SASUKE_CURSED_PACK: CharacterPack = {
  id: 'sasuke-cursed',
  walk: SASUKE_CURSED_WALK,
  idle: SASUKE_CURSED_IDLE,
  attack: SASUKE_CURSED_COMBO_1,
  attackChain: SASUKE_CURSED_ATTACK_CHAIN,
  hurt: SASUKE_CURSED_HURT,
  death: SASUKE_CURSED_DEATH,
  skillAnims: SASUKE_CURSED_JUTSU_ANIMS,
  hotbarSkillIds: ['skill-chidori-nagashi'],
};

/**
 * Orochimaru — full lateral pack (sem sheet de jutsu na fonte).
 * npm run packs:batch-6 — assets/naruto-source/nu/orochimaru/
 */
export const OROCHIMARU_CURATED_LOOK_TYPE = 9019;

const OROCHIMARU_WALK: SpriteSheetDef = {
  key: 'orochimaru-walk',
  url: '/sprites/player/orochimaru/walk.png',
  frameWidth: 24,
  frameHeight: 52,
  frameCount: 6,
  contentHeight: 48,
};

const OROCHIMARU_IDLE: SpriteSheetDef = {
  key: 'orochimaru-idle',
  url: '/sprites/player/orochimaru/idle.png',
  frameWidth: 25,
  frameHeight: 52,
  frameCount: 4,
  contentHeight: 48,
};

const OROCHIMARU_COMBO_1: SpriteSheetDef = {
  key: 'orochimaru-combo1',
  url: '/sprites/player/orochimaru/combo1.png',
  frameWidth: 63,
  frameHeight: 52,
  frameCount: 5,
  contentHeight: 48,
};

const OROCHIMARU_COMBO_2: SpriteSheetDef = {
  key: 'orochimaru-combo2',
  url: '/sprites/player/orochimaru/combo2.png',
  frameWidth: 63,
  frameHeight: 52,
  frameCount: 5,
  contentHeight: 48,
};

const OROCHIMARU_COMBO_3: SpriteSheetDef = {
  key: 'orochimaru-combo3',
  url: '/sprites/player/orochimaru/combo3.png',
  frameWidth: 63,
  frameHeight: 52,
  frameCount: 5,
  contentHeight: 48,
};

const OROCHIMARU_ATTACK_CHAIN = [
  OROCHIMARU_COMBO_1,
  OROCHIMARU_COMBO_2,
  OROCHIMARU_COMBO_3,
] as const;

const OROCHIMARU_HURT: CharacterReactionAnimDef = {
  key: 'orochimaru-hurt',
  url: '/sprites/player/orochimaru/hurt.png',
  frameWidth: 51,
  frameHeight: 49,
  frameCount: 2,
  contentHeight: 48,
  frameRate: 10,
};

const OROCHIMARU_DEATH: CharacterReactionAnimDef = {
  key: 'orochimaru-death',
  url: '/sprites/player/orochimaru/death.png',
  frameWidth: 51,
  frameHeight: 49,
  frameCount: 4,
  contentHeight: 48,
  frameRate: 8,
};

const OROCHIMARU_PACK: CharacterPack = {
  id: 'orochimaru',
  walk: OROCHIMARU_WALK,
  idle: OROCHIMARU_IDLE,
  attack: OROCHIMARU_COMBO_1,
  attackChain: OROCHIMARU_ATTACK_CHAIN,
  hurt: OROCHIMARU_HURT,
  death: OROCHIMARU_DEATH,
  skillAnims: {},
  hotbarSkillIds: [],
};

/**
 * Kisame Hoshigaki — full pack + Suiton: Suiryūdan.
 * npm run packs:batch-6 — assets/naruto-source/nu/kisame/
 */
export const KISAME_CURATED_LOOK_TYPE = 9021;

const KISAME_WALK: SpriteSheetDef = {
  key: 'kisame-walk',
  url: '/sprites/player/kisame/walk.png',
  frameWidth: 28,
  frameHeight: 52,
  frameCount: 6,
  contentHeight: 48,
};

const KISAME_IDLE: SpriteSheetDef = {
  key: 'kisame-idle',
  url: '/sprites/player/kisame/idle.png',
  frameWidth: 39,
  frameHeight: 52,
  frameCount: 4,
  contentHeight: 48,
};

const KISAME_COMBO_1: SpriteSheetDef = {
  key: 'kisame-combo1',
  url: '/sprites/player/kisame/combo1.png',
  frameWidth: 74,
  frameHeight: 52,
  frameCount: 4,
  contentHeight: 48,
};

const KISAME_COMBO_2: SpriteSheetDef = {
  key: 'kisame-combo2',
  url: '/sprites/player/kisame/combo2.png',
  frameWidth: 74,
  frameHeight: 52,
  frameCount: 4,
  contentHeight: 48,
};

const KISAME_COMBO_3: SpriteSheetDef = {
  key: 'kisame-combo3',
  url: '/sprites/player/kisame/combo3.png',
  frameWidth: 74,
  frameHeight: 52,
  frameCount: 5,
  contentHeight: 48,
};

const KISAME_ATTACK_CHAIN = [KISAME_COMBO_1, KISAME_COMBO_2, KISAME_COMBO_3] as const;

const KISAME_HURT: CharacterReactionAnimDef = {
  key: 'kisame-hurt',
  url: '/sprites/player/kisame/hurt.png',
  frameWidth: 56,
  frameHeight: 52,
  frameCount: 2,
  contentHeight: 48,
  frameRate: 10,
};

const KISAME_DEATH: CharacterReactionAnimDef = {
  key: 'kisame-death',
  url: '/sprites/player/kisame/death.png',
  frameWidth: 56,
  frameHeight: 52,
  frameCount: 3,
  contentHeight: 48,
  frameRate: 8,
};

const KISAME_JUTSU_ANIMS: Record<string, CharacterSkillAnimDef> = {
  'skill-suiton-suiryudan': {
    key: 'kisame-suiryudan',
    url: '/sprites/player/kisame/suiryudan.png',
    frameWidth: 68,
    frameHeight: 110,
    frameCount: 19,
    contentHeight: 48,
    frameRate: 12,
    durationMs: 1583,
    hitDelayMs: 1000,
  },
};

const KISAME_PACK: CharacterPack = {
  id: 'kisame',
  walk: KISAME_WALK,
  idle: KISAME_IDLE,
  attack: KISAME_COMBO_1,
  attackChain: KISAME_ATTACK_CHAIN,
  hurt: KISAME_HURT,
  death: KISAME_DEATH,
  skillAnims: KISAME_JUTSU_ANIMS,
  hotbarSkillIds: ['skill-suiton-suiryudan'],
};

/** Deidara — lookType 9022. npm run deidara:reslice (2-row content islands; batch-6b alone re-cuts badly) */
export const DEIDARA_CURATED_LOOK_TYPE = 9022;
const DEIDARA_WALK: SpriteSheetDef = { key: 'deidara-walk', url: '/sprites/player/deidara/walk.png', frameWidth: 29, frameHeight: 52, frameCount: 6, contentHeight: 48 };
const DEIDARA_IDLE: SpriteSheetDef = { key: 'deidara-idle', url: '/sprites/player/deidara/idle.png', frameWidth: 26, frameHeight: 52, frameCount: 4, contentHeight: 48 };
const DEIDARA_COMBO_1: SpriteSheetDef = { key: 'deidara-combo1', url: '/sprites/player/deidara/combo1.png', frameWidth: 55, frameHeight: 46, frameCount: 8, contentHeight: 48 };
const DEIDARA_COMBO_2: SpriteSheetDef = { key: 'deidara-combo2', url: '/sprites/player/deidara/combo2.png', frameWidth: 55, frameHeight: 46, frameCount: 8, contentHeight: 48 };
const DEIDARA_COMBO_3: SpriteSheetDef = { key: 'deidara-combo3', url: '/sprites/player/deidara/combo3.png', frameWidth: 55, frameHeight: 46, frameCount: 9, contentHeight: 48 };
const DEIDARA_ATTACK_CHAIN = [DEIDARA_COMBO_1, DEIDARA_COMBO_2, DEIDARA_COMBO_3] as const;
const DEIDARA_HURT: CharacterReactionAnimDef = { key: 'deidara-hurt', url: '/sprites/player/deidara/hurt.png', frameWidth: 55, frameHeight: 47, frameCount: 2, contentHeight: 48, frameRate: 10 };
const DEIDARA_DEATH: CharacterReactionAnimDef = { key: 'deidara-death', url: '/sprites/player/deidara/death.png', frameWidth: 55, frameHeight: 47, frameCount: 3, contentHeight: 48, frameRate: 8 };
const DEIDARA_JUTSU_ANIMS: Record<string, CharacterSkillAnimDef> = {
  'skill-c2-dragon': { key: 'deidara-kijutsu', url: '/sprites/player/deidara/kijutsu.png', frameWidth: 37, frameHeight: 52, frameCount: 7, contentHeight: 48, frameRate: 12, durationMs: 583, hitDelayMs: 333 },
};
const DEIDARA_PACK: CharacterPack = {
  id: 'deidara', walk: DEIDARA_WALK, idle: DEIDARA_IDLE, attack: DEIDARA_COMBO_1, attackChain: DEIDARA_ATTACK_CHAIN,
  hurt: DEIDARA_HURT, death: DEIDARA_DEATH, skillAnims: DEIDARA_JUTSU_ANIMS, hotbarSkillIds: ['skill-c2-dragon'],
};

/** Sakura Shippuden — lookType 9023. */
export const SAKURA_SHIPPUDEN_CURATED_LOOK_TYPE = 9023;
const SAKURA_SHIP_WALK: SpriteSheetDef = { key: 'sakura-shippuden-walk', url: '/sprites/player/sakura-shippuden/walk.png', frameWidth: 35, frameHeight: 52, frameCount: 6, contentHeight: 48 };
const SAKURA_SHIP_IDLE: SpriteSheetDef = { key: 'sakura-shippuden-idle', url: '/sprites/player/sakura-shippuden/idle.png', frameWidth: 33, frameHeight: 50, frameCount: 5, contentHeight: 48 };
const SAKURA_SHIP_COMBO_1: SpriteSheetDef = { key: 'sakura-shippuden-combo1', url: '/sprites/player/sakura-shippuden/combo1.png', frameWidth: 54, frameHeight: 52, frameCount: 4, contentHeight: 48 };
const SAKURA_SHIP_COMBO_2: SpriteSheetDef = { key: 'sakura-shippuden-combo2', url: '/sprites/player/sakura-shippuden/combo2.png', frameWidth: 54, frameHeight: 52, frameCount: 4, contentHeight: 48 };
const SAKURA_SHIP_COMBO_3: SpriteSheetDef = { key: 'sakura-shippuden-combo3', url: '/sprites/player/sakura-shippuden/combo3.png', frameWidth: 54, frameHeight: 52, frameCount: 5, contentHeight: 48 };
const SAKURA_SHIP_ATTACK_CHAIN = [SAKURA_SHIP_COMBO_1, SAKURA_SHIP_COMBO_2, SAKURA_SHIP_COMBO_3] as const;
const SAKURA_SHIP_HURT: CharacterReactionAnimDef = { key: 'sakura-shippuden-hurt', url: '/sprites/player/sakura-shippuden/hurt.png', frameWidth: 51, frameHeight: 45, frameCount: 2, contentHeight: 48, frameRate: 10 };
const SAKURA_SHIP_DEATH: CharacterReactionAnimDef = { key: 'sakura-shippuden-death', url: '/sprites/player/sakura-shippuden/death.png', frameWidth: 51, frameHeight: 45, frameCount: 3, contentHeight: 48, frameRate: 8 };
const SAKURA_SHIP_JUTSU_ANIMS: Record<string, CharacterSkillAnimDef> = {
  'skill-chou-tsubo': {
    key: 'sakura-shippuden-chou-tsubo',
    url: '/sprites/player/sakura-shippuden/chou-tsubo.png',
    frameWidth: 42,
    frameHeight: 87,
    frameCount: 22,
    contentHeight: 48,
    frameRate: 12,
    durationMs: 1833,
    hitDelayMs: 1167,
    // Ground slam rock burst on target — start so peak covers body hit.
    fxReleaseMs: 1000,
    fxAttach: 'target',
    fxGround: true,
    fx: {
      key: 'sakura-shippuden-chou-tsubo-fx',
      url: '/sprites/player/sakura-shippuden/chou-tsubo-fx.png',
      frameWidth: 209,
      frameHeight: 59,
      frameCount: 13,
      contentHeight: 56,
    },
  },
};
const SAKURA_SHIPPUDEN_PACK: CharacterPack = {
  id: 'sakura-shippuden', walk: SAKURA_SHIP_WALK, idle: SAKURA_SHIP_IDLE, attack: SAKURA_SHIP_COMBO_1, attackChain: SAKURA_SHIP_ATTACK_CHAIN,
  hurt: SAKURA_SHIP_HURT, death: SAKURA_SHIP_DEATH, skillAnims: SAKURA_SHIP_JUTSU_ANIMS, hotbarSkillIds: ['skill-chou-tsubo'],
};

/** Tenten — lookType 9024. */
export const TENTEN_CURATED_LOOK_TYPE = 9024;
const TENTEN_WALK: SpriteSheetDef = { key: 'tenten-walk', url: '/sprites/player/tenten/walk.png', frameWidth: 30, frameHeight: 52, frameCount: 6, contentHeight: 48 };
const TENTEN_IDLE: SpriteSheetDef = { key: 'tenten-idle', url: '/sprites/player/tenten/idle.png', frameWidth: 38, frameHeight: 49, frameCount: 6, contentHeight: 48 };
const TENTEN_COMBO_1: SpriteSheetDef = { key: 'tenten-combo1', url: '/sprites/player/tenten/combo1.png', frameWidth: 49, frameHeight: 52, frameCount: 5, contentHeight: 48 };
const TENTEN_COMBO_2: SpriteSheetDef = { key: 'tenten-combo2', url: '/sprites/player/tenten/combo2.png', frameWidth: 49, frameHeight: 52, frameCount: 5, contentHeight: 48 };
const TENTEN_COMBO_3: SpriteSheetDef = { key: 'tenten-combo3', url: '/sprites/player/tenten/combo3.png', frameWidth: 49, frameHeight: 52, frameCount: 6, contentHeight: 48 };
const TENTEN_ATTACK_CHAIN = [TENTEN_COMBO_1, TENTEN_COMBO_2, TENTEN_COMBO_3] as const;
const TENTEN_HURT: CharacterReactionAnimDef = { key: 'tenten-hurt', url: '/sprites/player/tenten/hurt.png', frameWidth: 54, frameHeight: 48, frameCount: 2, contentHeight: 48, frameRate: 10 };
const TENTEN_DEATH: CharacterReactionAnimDef = { key: 'tenten-death', url: '/sprites/player/tenten/death.png', frameWidth: 54, frameHeight: 48, frameCount: 4, contentHeight: 48, frameRate: 8 };
const TENTEN_JUTSU_ANIMS: Record<string, CharacterSkillAnimDef> = {
  'skill-soushuriken': {
    key: 'tenten-soushuriken',
    url: '/sprites/player/tenten/soushuriken.png',
    frameWidth: 107,
    frameHeight: 206,
    frameCount: 31,
    contentHeight: 48,
    frameRate: 12,
    durationMs: 2583,
    hitDelayMs: 1583,
    // 16 spin/fly frames → 5 impact frames on the strip.
    fxFlightFrameCount: 16,
    // Release when arms throw (~72% of hit → ~1140; pin a bit earlier).
    fxReleaseMs: 1100,
    fx: {
      key: 'tenten-soushuriken-fx',
      url: '/sprites/player/tenten/soushuriken-fx.png',
      frameWidth: 35,
      frameHeight: 42,
      frameCount: 21,
      contentHeight: 40,
    },
  },
};
const TENTEN_PACK: CharacterPack = {
  id: 'tenten', walk: TENTEN_WALK, idle: TENTEN_IDLE, attack: TENTEN_COMBO_1, attackChain: TENTEN_ATTACK_CHAIN,
  hurt: TENTEN_HURT, death: TENTEN_DEATH, skillAnims: TENTEN_JUTSU_ANIMS, hotbarSkillIds: ['skill-soushuriken'],
};

/** Temari — lookType 9025. */
export const TEMARI_CURATED_LOOK_TYPE = 9025;
const TEMARI_WALK: SpriteSheetDef = { key: 'temari-walk', url: '/sprites/player/temari/walk.png', frameWidth: 42, frameHeight: 52, frameCount: 8, contentHeight: 48 };
const TEMARI_IDLE: SpriteSheetDef = { key: 'temari-idle', url: '/sprites/player/temari/idle.png', frameWidth: 44, frameHeight: 52, frameCount: 6, contentHeight: 48 };
const TEMARI_COMBO_1: SpriteSheetDef = { key: 'temari-combo1', url: '/sprites/player/temari/combo1.png', frameWidth: 50, frameHeight: 52, frameCount: 5, contentHeight: 48 };
const TEMARI_COMBO_2: SpriteSheetDef = { key: 'temari-combo2', url: '/sprites/player/temari/combo2.png', frameWidth: 50, frameHeight: 52, frameCount: 5, contentHeight: 48 };
const TEMARI_COMBO_3: SpriteSheetDef = { key: 'temari-combo3', url: '/sprites/player/temari/combo3.png', frameWidth: 50, frameHeight: 52, frameCount: 6, contentHeight: 48 };
const TEMARI_ATTACK_CHAIN = [TEMARI_COMBO_1, TEMARI_COMBO_2, TEMARI_COMBO_3] as const;
const TEMARI_HURT: CharacterReactionAnimDef = { key: 'temari-hurt', url: '/sprites/player/temari/hurt.png', frameWidth: 61, frameHeight: 49, frameCount: 2, contentHeight: 48, frameRate: 10 };
const TEMARI_DEATH: CharacterReactionAnimDef = { key: 'temari-death', url: '/sprites/player/temari/death.png', frameWidth: 61, frameHeight: 49, frameCount: 3, contentHeight: 48, frameRate: 8 };
const TEMARI_JUTSU_ANIMS: Record<string, CharacterSkillAnimDef> = {
  'skill-kamaitachi': {
    key: 'temari-kamaitachi',
    url: '/sprites/player/temari/kamaitachi.png',
    frameWidth: 78,
    frameHeight: 59,
    frameCount: 14,
    contentHeight: 48,
    frameRate: 12,
    durationMs: 1167,
    hitDelayMs: 750,
    // Wind slash on target — appear just before body hit.
    fxReleaseMs: 550,
    fxAttach: 'target',
    fx: {
      key: 'temari-kamaitachi-fx',
      url: '/sprites/player/temari/kamaitachi-fx.png',
      frameWidth: 88,
      frameHeight: 52,
      frameCount: 13,
      contentHeight: 48,
    },
  },
};
const TEMARI_PACK: CharacterPack = {
  id: 'temari', walk: TEMARI_WALK, idle: TEMARI_IDLE, attack: TEMARI_COMBO_1, attackChain: TEMARI_ATTACK_CHAIN,
  hurt: TEMARI_HURT, death: TEMARI_DEATH, skillAnims: TEMARI_JUTSU_ANIMS, hotbarSkillIds: ['skill-kamaitachi'],
};

/** Tayuya — lookType 9026. */
export const TAYUYA_CURATED_LOOK_TYPE = 9026;
const TAYUYA_WALK: SpriteSheetDef = { key: 'tayuya-walk', url: '/sprites/player/tayuya/walk.png', frameWidth: 39, frameHeight: 52, frameCount: 8, contentHeight: 48 };
const TAYUYA_IDLE: SpriteSheetDef = { key: 'tayuya-idle', url: '/sprites/player/tayuya/idle.png', frameWidth: 42, frameHeight: 50, frameCount: 6, contentHeight: 48 };
const TAYUYA_COMBO_1: SpriteSheetDef = { key: 'tayuya-combo1', url: '/sprites/player/tayuya/combo1.png', frameWidth: 54, frameHeight: 50, frameCount: 5, contentHeight: 48 };
const TAYUYA_COMBO_2: SpriteSheetDef = { key: 'tayuya-combo2', url: '/sprites/player/tayuya/combo2.png', frameWidth: 54, frameHeight: 50, frameCount: 5, contentHeight: 48 };
const TAYUYA_COMBO_3: SpriteSheetDef = { key: 'tayuya-combo3', url: '/sprites/player/tayuya/combo3.png', frameWidth: 54, frameHeight: 50, frameCount: 5, contentHeight: 48 };
const TAYUYA_ATTACK_CHAIN = [TAYUYA_COMBO_1, TAYUYA_COMBO_2, TAYUYA_COMBO_3] as const;
const TAYUYA_HURT: CharacterReactionAnimDef = { key: 'tayuya-hurt', url: '/sprites/player/tayuya/hurt.png', frameWidth: 55, frameHeight: 51, frameCount: 2, contentHeight: 48, frameRate: 10 };
const TAYUYA_DEATH: CharacterReactionAnimDef = { key: 'tayuya-death', url: '/sprites/player/tayuya/death.png', frameWidth: 55, frameHeight: 51, frameCount: 3, contentHeight: 48, frameRate: 8 };
const TAYUYA_JUTSU_ANIMS: Record<string, CharacterSkillAnimDef> = {
  'skill-magen-mateki': {
    key: 'tayuya-magen-mateki',
    url: '/sprites/player/tayuya/magen-mateki.png',
    frameWidth: 90,
    frameHeight: 95,
    frameCount: 18,
    contentHeight: 48,
    frameRate: 12,
    durationMs: 1500,
    hitDelayMs: 917,
    // Pink note spins while flying caster → target (all 4 frames = flight loop).
    fxFlightFrameCount: 4,
    fxReleaseMs: 660,
    fx: {
      key: 'tayuya-magen-mateki-fx',
      url: '/sprites/player/tayuya/magen-mateki-fx.png',
      frameWidth: 34,
      frameHeight: 44,
      frameCount: 4,
      contentHeight: 40,
    },
  },
};
const TAYUYA_PACK: CharacterPack = {
  id: 'tayuya', walk: TAYUYA_WALK, idle: TAYUYA_IDLE, attack: TAYUYA_COMBO_1, attackChain: TAYUYA_ATTACK_CHAIN,
  hurt: TAYUYA_HURT, death: TAYUYA_DEATH, skillAnims: TAYUYA_JUTSU_ANIMS, hotbarSkillIds: ['skill-magen-mateki'],
};

/** Shino Aburame — lookType 9027. */
export const SHINO_CURATED_LOOK_TYPE = 9027;
const SHINO_WALK: SpriteSheetDef = { key: 'shino-walk', url: '/sprites/player/shino/walk.png', frameWidth: 25, frameHeight: 52, frameCount: 6, contentHeight: 48 };
const SHINO_IDLE: SpriteSheetDef = { key: 'shino-idle', url: '/sprites/player/shino/idle.png', frameWidth: 25, frameHeight: 51, frameCount: 7, contentHeight: 48 };
const SHINO_COMBO_1: SpriteSheetDef = { key: 'shino-combo1', url: '/sprites/player/shino/combo1.png', frameWidth: 34, frameHeight: 33, frameCount: 5, contentHeight: 48 };
const SHINO_COMBO_2: SpriteSheetDef = { key: 'shino-combo2', url: '/sprites/player/shino/combo2.png', frameWidth: 34, frameHeight: 33, frameCount: 5, contentHeight: 48 };
const SHINO_COMBO_3: SpriteSheetDef = { key: 'shino-combo3', url: '/sprites/player/shino/combo3.png', frameWidth: 34, frameHeight: 33, frameCount: 6, contentHeight: 48 };
const SHINO_ATTACK_CHAIN = [SHINO_COMBO_1, SHINO_COMBO_2, SHINO_COMBO_3] as const;
const SHINO_HURT: CharacterReactionAnimDef = { key: 'shino-hurt', url: '/sprites/player/shino/hurt.png', frameWidth: 51, frameHeight: 49, frameCount: 2, contentHeight: 48, frameRate: 10 };
const SHINO_DEATH: CharacterReactionAnimDef = { key: 'shino-death', url: '/sprites/player/shino/death.png', frameWidth: 51, frameHeight: 49, frameCount: 3, contentHeight: 48, frameRate: 8 };
const SHINO_JUTSU_ANIMS: Record<string, CharacterSkillAnimDef> = {
  'skill-kikaichu': {
    key: 'shino-kikaichu',
    url: '/sprites/player/shino/kikaichu.png',
    frameWidth: 34,
    frameHeight: 32,
    frameCount: 13,
    contentHeight: 48,
    frameRate: 12,
    durationMs: 1083,
    hitDelayMs: 667,
    // Insect swarm: appear on target slightly before cast hit.
    fxReleaseMs: 500,
    fxAttach: 'target',
    fx: {
      key: 'shino-kikaichu-fx',
      url: '/sprites/player/shino/kikaichu-fx.png',
      frameWidth: 67,
      frameHeight: 60,
      frameCount: 18,
      contentHeight: 56,
    },
  },
};
const SHINO_PACK: CharacterPack = {
  id: 'shino', walk: SHINO_WALK, idle: SHINO_IDLE, attack: SHINO_COMBO_1, attackChain: SHINO_ATTACK_CHAIN,
  hurt: SHINO_HURT, death: SHINO_DEATH, skillAnims: SHINO_JUTSU_ANIMS, hotbarSkillIds: ['skill-kikaichu'],
};

/** Momo Hinamori — lookType 9028. */
export const MOMO_HINAMORI_CURATED_LOOK_TYPE = 9028;
const MOMO_WALK: SpriteSheetDef = { key: 'momo-hinamori-walk', url: '/sprites/player/momo-hinamori/walk.png', frameWidth: 46, frameHeight: 52, frameCount: 5, contentHeight: 48 };
const MOMO_IDLE: SpriteSheetDef = { key: 'momo-hinamori-idle', url: '/sprites/player/momo-hinamori/idle.png', frameWidth: 51, frameHeight: 51, frameCount: 8, contentHeight: 48 };
const MOMO_COMBO_1: SpriteSheetDef = { key: 'momo-hinamori-combo1', url: '/sprites/player/momo-hinamori/combo1.png', frameWidth: 59, frameHeight: 62, frameCount: 4, contentHeight: 48 };
const MOMO_COMBO_2: SpriteSheetDef = { key: 'momo-hinamori-combo2', url: '/sprites/player/momo-hinamori/combo2.png', frameWidth: 59, frameHeight: 62, frameCount: 4, contentHeight: 48 };
const MOMO_COMBO_3: SpriteSheetDef = { key: 'momo-hinamori-combo3', url: '/sprites/player/momo-hinamori/combo3.png', frameWidth: 59, frameHeight: 62, frameCount: 3, contentHeight: 48 };
const MOMO_ATTACK_CHAIN = [MOMO_COMBO_1, MOMO_COMBO_2, MOMO_COMBO_3] as const;
const MOMO_HURT: CharacterReactionAnimDef = { key: 'momo-hinamori-hurt', url: '/sprites/player/momo-hinamori/hurt.png', frameWidth: 74, frameHeight: 52, frameCount: 2, contentHeight: 48, frameRate: 10 };
const MOMO_DEATH: CharacterReactionAnimDef = { key: 'momo-hinamori-death', url: '/sprites/player/momo-hinamori/death.png', frameWidth: 74, frameHeight: 52, frameCount: 5, contentHeight: 48, frameRate: 8 };
const MOMO_JUTSU_ANIMS: Record<string, CharacterSkillAnimDef> = {
  'skill-tobiume': {
    key: 'momo-hinamori-tobiume',
    url: '/sprites/player/momo-hinamori/tobiume.png',
    frameWidth: 171,
    frameHeight: 55,
    frameCount: 12,
    contentHeight: 48,
    frameRate: 12,
    durationMs: 1000,
    hitDelayMs: 500,
  },
};
const MOMO_HINAMORI_PACK: CharacterPack = {
  id: 'momo-hinamori', walk: MOMO_WALK, idle: MOMO_IDLE, attack: MOMO_COMBO_1, attackChain: MOMO_ATTACK_CHAIN,
  hurt: MOMO_HURT, death: MOMO_DEATH, skillAnims: MOMO_JUTSU_ANIMS, hotbarSkillIds: ['skill-tobiume'],
};

/** Toshiro Hitsugaya — lookType 9029. */
export const HITSUGAYA_CURATED_LOOK_TYPE = 9029;
const HITSUGAYA_WALK: SpriteSheetDef = {
  key: 'hitsugaya-walk',
  url: '/sprites/player/hitsugaya/walk.png',
  frameWidth: 98,
  frameHeight: 52,
  frameCount: 6,
  contentHeight: 48,
  // Heavy blade / long stride — default 12 looks rushed.
  frameRate: 8,
};
const HITSUGAYA_IDLE: SpriteSheetDef = {
  key: 'hitsugaya-idle',
  url: '/sprites/player/hitsugaya/idle.png',
  frameWidth: 60,
  frameHeight: 52,
  frameCount: 6,
  contentHeight: 48,
  frameRate: 6,
};
const HITSUGAYA_COMBO_1: SpriteSheetDef = {
  key: 'hitsugaya-combo1',
  url: '/sprites/player/hitsugaya/combo1.png',
  frameWidth: 107,
  frameHeight: 94,
  frameCount: 5,
  contentHeight: 48,
  frameRate: 8,
};
const HITSUGAYA_COMBO_2: SpriteSheetDef = {
  key: 'hitsugaya-combo2',
  url: '/sprites/player/hitsugaya/combo2.png',
  frameWidth: 107,
  frameHeight: 94,
  frameCount: 5,
  contentHeight: 48,
  frameRate: 8,
};
const HITSUGAYA_COMBO_3: SpriteSheetDef = {
  key: 'hitsugaya-combo3',
  url: '/sprites/player/hitsugaya/combo3.png',
  frameWidth: 107,
  frameHeight: 94,
  frameCount: 4,
  contentHeight: 48,
  frameRate: 8,
};
const HITSUGAYA_ATTACK_CHAIN = [HITSUGAYA_COMBO_1, HITSUGAYA_COMBO_2, HITSUGAYA_COMBO_3] as const;
const HITSUGAYA_HURT: CharacterReactionAnimDef = {
  key: 'hitsugaya-hurt',
  url: '/sprites/player/hitsugaya/hurt.png',
  frameWidth: 101,
  frameHeight: 67,
  frameCount: 2,
  contentHeight: 48,
  frameRate: 10,
};
const HITSUGAYA_DEATH: CharacterReactionAnimDef = {
  key: 'hitsugaya-death',
  url: '/sprites/player/hitsugaya/death.png',
  frameWidth: 101,
  frameHeight: 67,
  frameCount: 2,
  contentHeight: 48,
  frameRate: 8,
};
const HITSUGAYA_JUTSU_ANIMS: Record<string, CharacterSkillAnimDef> = {
  'skill-daiguren-hyorinmaru': {
    key: 'hitsugaya-daiguren-hyorinmaru',
    url: '/sprites/player/hitsugaya/daiguren-hyorinmaru.png',
    frameWidth: 100,
    frameHeight: 104,
    frameCount: 7,
    contentHeight: 48,
    frameRate: 10,
    durationMs: 700,
    hitDelayMs: 400,
    // Ice fan on target at slash peak.
    fxReleaseMs: 320,
    fxAttach: 'target',
    fx: {
      key: 'hitsugaya-daiguren-hyorinmaru-fx',
      url: '/sprites/player/hitsugaya/daiguren-hyorinmaru-fx.png',
      frameWidth: 38,
      frameHeight: 68,
      frameCount: 5,
      contentHeight: 64,
    },
  },
};
const HITSUGAYA_PACK: CharacterPack = {
  id: 'hitsugaya',
  walk: HITSUGAYA_WALK,
  idle: HITSUGAYA_IDLE,
  attack: HITSUGAYA_COMBO_1,
  attackChain: HITSUGAYA_ATTACK_CHAIN,
  hurt: HITSUGAYA_HURT,
  death: HITSUGAYA_DEATH,
  skillAnims: HITSUGAYA_JUTSU_ANIMS,
  hotbarSkillIds: ['skill-daiguren-hyorinmaru'],
  // Long blade + haori footprint is much wider than Naruto packs; slight X squish.
  displayScaleX: 0.88,
};

const PACKS: Record<StarterCharacterId, CharacterPack> = {
  'naruto-classic': NARUTO_PACK,
  'sasuke-classic': SASUKE_PACK,
  'rock-lee': ROCK_LEE_PACK,
};

/** Packs curados para personagens selados (substituem outfit 4-dir WONSR). */
const CURATED_BY_SLUG: Record<string, CharacterPack> = {
  naruto: NARUTO_PACK,
  'uzumaki-naruto': NARUTO_PACK,
  'uzumaki naruto': NARUTO_PACK,
  sasuke: SASUKE_PACK,
  'uchiha-sasuke': SASUKE_PACK,
  'uchiha sasuke': SASUKE_PACK,
  lee: ROCK_LEE_PACK,
  'rock-lee': ROCK_LEE_PACK,
  'rock lee': ROCK_LEE_PACK,
  shikamaru: SHIKAMARU_PACK,
  neji: NEJI_PACK,
  gaara: GAARA_PACK,
  sakura: SAKURA_PACK,
  chouji: CHOUJI_PACK,
  choji: CHOUJI_PACK,
  hinata: HINATA_PACK,
  'hinata-hyuga': HINATA_PACK,
  guy: GUY_PACK,
  'might-guy': GUY_PACK,
  ino: INO_PACK,
  'ino-yamanaka': INO_PACK,
  kakashi: KAKASHI_PACK,
  'hatake-kakashi': KAKASHI_PACK,
  'naruto-sennin': NARUTO_SENNIN_PACK,
  itachi: UCHIHA_ITACHI_PACK,
  'uchiha-itachi': UCHIHA_ITACHI_PACK,
  jiraiya: JIRAIYA_PACK,
  jiraya: JIRAIYA_PACK,
  jirobo: JIROBO_PACK,
  jiroubou: JIROBO_PACK,
  'jirou bou': JIROBO_PACK,
  kabuto: KABUTO_PACK,
  'yakushi-kabuto': KABUTO_PACK,
  tsunade: TSUNADE_PACK,
  kiba: KIBA_PACK,
  'inuzuka-kiba': KIBA_PACK,
  kimimaro: KIMIMARO_PACK,
  'sasuke-cursed': SASUKE_CURSED_PACK,
  'uchiha-sasuke-cursed': SASUKE_CURSED_PACK,
  orochimaru: OROCHIMARU_PACK,
  'naruto-kyubi': NARUTO_KYUBI_PACK,
  'naruto-kyuubi': NARUTO_KYUBI_PACK,
  kisame: KISAME_PACK,
  deidara: DEIDARA_PACK,
  'sakura-shippuden': SAKURA_SHIPPUDEN_PACK,
  tenten: TENTEN_PACK,
  temari: TEMARI_PACK,
  tayuya: TAYUYA_PACK,
  shino: SHINO_PACK,
  'aburame-shino': SHINO_PACK,
  'momo-hinamori': MOMO_HINAMORI_PACK,
  momo: MOMO_HINAMORI_PACK,
  hinamori: MOMO_HINAMORI_PACK,
  hitsugaya: HITSUGAYA_PACK,
  'toshiro-hitsugaya': HITSUGAYA_PACK,
  toshiro: HITSUGAYA_PACK,
};

const CURATED_BY_LOOK_TYPE: Record<number, CharacterPack> = {
  [NARUTO_CLASSIC_LOOK_TYPE]: NARUTO_PACK,
  [SASUKE_CLASSIC_LOOK_TYPE]: SASUKE_PACK,
  [ROCK_LEE_LOOK_TYPE]: ROCK_LEE_PACK,
  [SHIKAMARU_LOOK_TYPE]: SHIKAMARU_PACK,
  ...Object.fromEntries(NEJI_LOOK_TYPES.map((look) => [look, NEJI_PACK])),
  [NEJI_CURATED_LOOK_TYPE]: NEJI_PACK,
  ...Object.fromEntries(GAARA_LOOK_TYPES.map((look) => [look, GAARA_PACK])),
  ...Object.fromEntries(SAKURA_LOOK_TYPES.map((look) => [look, SAKURA_PACK])),
  [CHOUJI_CURATED_LOOK_TYPE]: CHOUJI_PACK,
  [HINATA_CURATED_LOOK_TYPE]: HINATA_PACK,
  [GUY_CURATED_LOOK_TYPE]: GUY_PACK,
  ...Object.fromEntries(INO_LOOK_TYPES.map((look) => [look, INO_PACK])),
  [KAKASHI_CURATED_LOOK_TYPE]: KAKASHI_PACK,
  [NARUTO_SENNIN_LOOK_TYPE]: NARUTO_SENNIN_PACK,
  [UCHIHA_ITACHI_LOOK_TYPE]: UCHIHA_ITACHI_PACK,
  ...Object.fromEntries(JIRAIYA_LOOK_TYPES.map((look) => [look, JIRAIYA_PACK])),
  ...Object.fromEntries(JIROBO_LOOK_TYPES.map((look) => [look, JIROBO_PACK])),
  [KABUTO_CURATED_LOOK_TYPE]: KABUTO_PACK,
  [TSUNADE_CURATED_LOOK_TYPE]: TSUNADE_PACK,
  [KIBA_CURATED_LOOK_TYPE]: KIBA_PACK,
  [KIMIMARO_CURATED_LOOK_TYPE]: KIMIMARO_PACK,
  [SASUKE_CURSED_CURATED_LOOK_TYPE]: SASUKE_CURSED_PACK,
  [OROCHIMARU_CURATED_LOOK_TYPE]: OROCHIMARU_PACK,
  [NARUTO_KYUBI_CURATED_LOOK_TYPE]: NARUTO_KYUBI_PACK,
  [KISAME_CURATED_LOOK_TYPE]: KISAME_PACK,
  [DEIDARA_CURATED_LOOK_TYPE]: DEIDARA_PACK,
  [SAKURA_SHIPPUDEN_CURATED_LOOK_TYPE]: SAKURA_SHIPPUDEN_PACK,
  [TENTEN_CURATED_LOOK_TYPE]: TENTEN_PACK,
  [TEMARI_CURATED_LOOK_TYPE]: TEMARI_PACK,
  [TAYUYA_CURATED_LOOK_TYPE]: TAYUYA_PACK,
  [SHINO_CURATED_LOOK_TYPE]: SHINO_PACK,
  [MOMO_HINAMORI_CURATED_LOOK_TYPE]: MOMO_HINAMORI_PACK,
  [HITSUGAYA_CURATED_LOOK_TYPE]: HITSUGAYA_PACK,
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
 * Escala do personagem no mundo (walk → jutsus).
 * Y = altura padrão; X = Y × displayScaleX (esmaga silhuetas largas).
 */
export function characterDisplayScale(pack: CharacterPack): { x: number; y: number } {
  const height = pack.walk.contentHeight ?? pack.walk.frameHeight;
  const y =
    (height > 0 ? CHARACTER_DISPLAY_HEIGHT / height : 1) * (pack.displayScale ?? 1);
  const x = y * (pack.displayScaleX ?? 1);
  return { x, y };
}

/** Escala uniforme legada (média X/Y se diferem). Preferir `characterDisplayScale`. */
export function characterBaseScale(pack: CharacterPack): number {
  const { x, y } = characterDisplayScale(pack);
  return (x + y) / 2;
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
  scene.load.once(PHASER_LOADER_COMPLETE, () => {
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
    if (anim.fxSecondary) sheets.push(anim.fxSecondary);
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
    scene.textures.get(key).setFilter(PHASER_TEXTURE_FILTER_NEAREST);
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
    scene.load.once(PHASER_LOADER_COMPLETE, () => {
      applyNearestFilter(scene, queued);
      resolve();
    });
    scene.load.start();
  });
}
