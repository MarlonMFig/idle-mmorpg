import type * as Phaser from 'phaser';
import { CHARACTER_DISPLAY_HEIGHT } from '@/constants/sprites';
import { JUMP_FORCE_BY_LOOK_TYPE, JUMP_FORCE_BY_SLUG } from '@/data/jump-force-packs';
import { getVfxDefinition, sharedVfxToSheet } from '@/data/vfx/registry';
import { isSequenceVfx } from '@/data/vfx/types';
import { applyDevPackOverlay } from '@/lib/dev/dev-runtime-registry';
import type { CombatAffinityFields, DamageElement } from '@/data/damage-elements';
import type { SkillAiConfig } from '@/data/skill-ai-def';
import type { SkillExecutionDef } from '@/data/skill-execution-def';
import type { SkillStatusApplication } from '@/data/status-effect-def';
import type { SkillVfxTargetMode } from '@/data/skill-vfx-targeting';
import { SKILL_VFX_TARGET_MODES } from '@/data/skill-vfx-targeting';
import type { WonsrDirection } from '@/data/wonsr-sprites';
import type { SpriteAlignmentConfig } from '@/lib/sprite-alignment';
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
  /**
   * Origin X (0–1) quando a folha trava os pés (ex.: jutsu com beam).
   * Sem valor: 0.5.
   */
  originX?: number;
  /**
   * Origin Y (0–1+). Sem valor: pés (`1`) ou hover de `fly`.
   * Por animação — idle/walk/special podem diferir.
   */
  originY?: number;
  /**
   * Deslocamento em px da folha (0 = sem mudança).
   * X positivo = para a frente do personagem; Y positivo = para baixo.
   */
  offsetX?: number;
  offsetY?: number;
  /**
   * Sequência de imagens (um PNG por quadro). Sem isto, `url` é spritesheet.
   * Usado sobretudo em poses de Skill no Test Lab.
   */
  frames?: readonly string[];
  /** Se a animação da folha faz loop. Default false nas skills. */
  loop?: boolean;
  loopMode?: 'none' | 'full' | 'range' | 'persistent-range';
  loopStartFrame?: number;
  loopEndFrame?: number;
  loopDurationMs?: number;
  loopUntilSkillEnd?: boolean;
  flipX?: boolean;
  flipY?: boolean;
  /** FX opcional do golpe (slash / spark no caster). */
  fx?: SpriteSheetDef;
  /** Âncora do FX. Default `'caster'`. */
  fxAttach?: 'caster' | 'target';
  /** Delay (ms) até spawnar o FX; default ~55% da duração do golpe. */
  fxReleaseMs?: number;
  /** `true` = origin nos pés. Default true quando attach=caster. */
  fxGround?: boolean;
  /** Blend do FX (slash Mugen AfterFX → `'add'`). */
  fxBlend?: 'normal' | 'add';
  /** Multiplicador extra de escala do FX (1 = default). */
  fxScale?: number;
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
   * Se o projétil rotaciona na direção do voo. Default true (pedra / bola de fogo).
   * Orbes com rastro vertical (ex.: água da Noelle) devem ficar `false`.
   */
  fxFlightRotate?: boolean;
  /** Espelha o projétil no eixo X conforme a direção do voo (pássaro / seta). */
  fxFlightFlip?: boolean;
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
  /** Multiplicador visual do FX sem alterar a resolução nativa da sprite. */
  fxScale?: number;
  /**
   * Se `true`, o FX não herda a escala da sprite do personagem
   * (só `fxScale` × escala do mapa). Default `false` = comportamento atual.
   */
  fxIndependentScale?: boolean;
  /**
   * Segundo FX sem voo (ex.: impacto no chão no hitDelay enquanto `fx` é kick-off).
   * Timing: `fxSecondaryReleaseMs` (default = hitDelay). Âncora: `fxSecondaryAttach`.
   */
  fxSecondary?: SpriteSheetDef;
  fxSecondaryReleaseMs?: number;
  fxSecondaryAttach?: 'caster' | 'target';
  /** FPS do FX secundário; padrão 12. */
  fxSecondaryFrameRate?: number;
  /**
   * Comportamento oficial do VFX em relação ao alvo.
   * Ausente = legado (`fxAttach` / `fxFlightFrameCount`). Não quebra skills antigas.
   */
  targeting?: SkillVfxTargeting;
  /**
   * ID no VfxRegistry (`src/data/vfx`). Sem isto, usa `fx` inline (legado).
   * Este campo é o **VFX Efeito** da Skill.
   */
  vfxId?: string;
  /** Offset visual desta skill sobre o VFX de catálogo. Ignorado sem `vfxId`. */
  vfxOffsetX?: number;
  vfxOffsetY?: number;
  vfxLoopMode?: 'none' | 'full' | 'range' | 'persistent-range';
  vfxLoopStartFrame?: number;
  vfxLoopEndFrame?: number;
  vfxLoopDurationMs?: number;
  vfxLoopUntilSkillEnd?: boolean;
  /** Espelho visual do VFX. Não usa scale negativo. */
  vfxFlipX?: boolean;
  vfxFlipY?: boolean;
  /**
   * Pose / cast: animação do personagem e/ou VFX de preparação.
   * Nenhum dos dois é obrigatório.
   */
  cast?: SkillCastVisual;
  /** Delay (ms) entre o início da pose e o lançamento do efeito. Independente de travelSpeed. */
  castDelayMs?: number;
  /**
   * Quando o dano é aplicado. Ausente = `hit-delay` (legado).
   * Não migrar skills antigas em massa.
   */
  damageTrigger?: SkillDamageTrigger;
  /**
   * Tipo de execução avançada. Ausente = `single-hit` (comportamento atual).
   * Não migrar Skills automaticamente.
   */
  execution?: SkillExecutionDef;
  /**
   * Status Effects desta Skill no pack. Ausente = usa SkillDefinition.statusEffects.
   * Não migrar automaticamente.
   */
  statusEffects?: SkillStatusApplication[];
  /**
   * Overlay de elemento desta Skill no pack. Ausente = SkillDefinition.element
   * ou `neutral`. Não inferir pelo VFX.
   */
  element?: DamageElement;
  /**
   * IA deste personagem nesta Skill. Ausente = autoUse on, prioridade = slot.
   * Segue o skillId ao reordenar slots.
   */
  ai?: SkillAiConfig;
}

/** Pose / preparação da Skill (folha do personagem). Não causa dano. */
export interface SkillCastVisual {
  /** Slot ou key de animação do personagem (`special1`, `idle`, …). */
  animationId?: string;
  /**
   * VFX de carga opcional (camada futura). NÃO é a animação corporal da pose.
   */
  vfxId?: string;
  scale?: number;
  scaleX?: number;
  scaleY?: number;
  offsetX?: number;
  offsetY?: number;
  loop?: boolean;
  /** Ausente = `loop ? 'full' : 'none'`. */
  loopMode?: 'none' | 'full' | 'range' | 'persistent-range';
  /** 1-based inclusive. Persistent loop após first pass. */
  loopStartFrame?: number;
  loopEndFrame?: number;
  loopDurationMs?: number;
  loopUntilSkillEnd?: boolean;
  flipX?: boolean;
  flipY?: boolean;
}

export { SKILL_VFX_TARGET_MODES };
export type { SkillVfxTargetMode };

export const SKILL_DAMAGE_TRIGGERS = ['hit-delay', 'on-arrival', 'on-effect-start'] as const;
export type SkillDamageTrigger = (typeof SKILL_DAMAGE_TRIGGERS)[number];

/** Trajetória do VFX (por skill). Separado da escala/offset visual do asset. */
export interface SkillVfxTargeting {
  mode: SkillVfxTargetMode;
  /** Velocidade em px/s. Só usada em `travel-to-target`. */
  travelSpeed?: number;
  spawnOffsetX?: number;
  spawnOffsetY?: number;
  targetOffsetX?: number;
  targetOffsetY?: number;
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
  /** Hotbar oficial: índice 0 = Slot 1 … índice 3 = Slot 4. `null` = slot vazio (não desloca os demais). */
  hotbarSkillIds: readonly (string | null)[];
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
  /**
   * Locomoção visual. `fly` = sheet de movimento é voo (não passada no chão);
   * o sprite fica elevado por `flightHoverPx` com origin abaixo dos pés.
   */
  locomotion?: 'walk' | 'fly';
  /** Elevação em px de mundo quando `locomotion: 'fly'` (padrão 14). */
  flightHoverPx?: number;
  /**
   * Alignment visual global (Hub / Hunt). Offset de renderização do personagem
   * inteiro — aplica a idle/walk/skills/poses via origin. Não é progresso do
   * jogador; não altera hitbox, PNG nem offsets específicos de Skill/VFX.
   */
  spriteAlignment?: SpriteAlignmentConfig;
  /**
   * Resistências / imunidades do personagem. Ausente = vazio (dano normal).
   * Não preencher packs existentes automaticamente.
   */
  resistances?: CombatAffinityFields['resistances'];
  immunities?: CombatAffinityFields['immunities'];
  statusResistances?: CombatAffinityFields['statusResistances'];
  statusImmunities?: CombatAffinityFields['statusImmunities'];
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
  /**
   * Rasengan — frames do rasengan.zip, pés traseiros fixos, contentHeight = idle (81).
   * Gerado por: node scripts/process-naruto-rasengan-zip.js
   */
  'skill-rasengan': {
    key: 'naruto-rasengan-dash',
    url: '/sprites/player/naruto/rasengan-dash.png',
    frameWidth: 274,
    frameHeight: 165,
    frameCount: 16,
    contentHeight: 81,
    frameRate: 12,
    durationMs: 1333,
    hitDelayMs: 750,
    originX: 0.1898,
    // Mesmo offset do idle/walk — evita “pulo” vertical no cast.
    offsetY: 4,
    element: 'yang',
    ai: {
      autoUse: true,
      priority: 1,
      energyCost: 22,
    },
  },
  /**
   * Chakra da Kyūbi — pose idle + aura animada (fogo → cabeça da raposa).
   * Sheet: `kyuubi.png` (NU). Cabeça estática (`kurama-head-fx`) fica de reserva.
   */
  'skill-kyuubi': {
    key: 'naruto-idle',
    url: '/sprites/player/naruto/idle.png',
    frameWidth: 61,
    frameHeight: 85,
    frameCount: 6,
    contentHeight: 81,
    frameRate: 15,
    // Cobre a folha FX (37f @ 12fps ≈ 3083ms)
    durationMs: 400,
    // Cabeça da raposa no pico (~f10)
    hitDelayMs: 833,
    fxReleaseMs: 0,
    fxAttach: 'caster',
    fxGround: true,
    fxScale: 2,
    fxIndependentScale: true,
    castDelayMs: 0,
    targeting: {
      mode: 'caster',
      travelSpeed: 600,
      spawnOffsetX: 0,
      spawnOffsetY: 0,
      targetOffsetX: 0,
      targetOffsetY: 0,
    },
    fx: {
      key: 'naruto-kyuubi-fx',
      url: '/sprites/player/naruto/kyuubi.png',
      frameWidth: 136,
      frameHeight: 136,
      frameCount: 37,
      contentHeight: 40,
      frameRate: 12,
      originX: 0.5,
      originY: 1,
      offsetX: 0,
      offsetY: 150,
    },
    element: 'fire',
    ai: {
      autoUse: true,
      priority: 2,
      energyCost: 35,
    },
    loopMode: 'none',
    loopUntilSkillEnd: false,
    flipX: false,
    flipY: false,
    cast: {
      scaleX: 1,
      scaleY: 1,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      loopMode: 'none',
      loopUntilSkillEnd: false,
      flipX: false,
      flipY: false,
    },
    vfxLoopMode: 'none',
    vfxLoopStartFrame: 1,
    vfxLoopEndFrame: 1,
    vfxLoopDurationMs: 3000,
    vfxLoopUntilSkillEnd: false,
    vfxFlipX: false,
    vfxFlipY: false,
  },
};

const NARUTO_WALK: SpriteSheetDef = {
  key: 'naruto-walk',
  url: '/sprites/player/naruto/walk.png',
  frameWidth: 55,
  frameHeight: 86,
  frameCount: 6,
  contentHeight: 81,
  offsetY: 4,
};

const NARUTO_IDLE: SpriteSheetDef = {
  key: 'naruto-idle',
  url: '/sprites/player/naruto/idle.png',
  frameWidth: 61,
  frameHeight: 85,
  frameCount: 6,
  contentHeight: 81,
  offsetY: 4,
};

const NARUTO_COMBO_1: SpriteSheetDef = {
  key: 'naruto-combo1',
  url: '/sprites/player/naruto/combo1.png',
  frameWidth: 86,
  frameHeight: 83,
  frameCount: 4,
  contentHeight: 81,
};

const NARUTO_COMBO_2: SpriteSheetDef = {
  key: 'naruto-combo2',
  url: '/sprites/player/naruto/combo2.png',
  frameWidth: 86,
  frameHeight: 83,
  frameCount: 4,
  contentHeight: 81,
};

const NARUTO_COMBO_3: SpriteSheetDef = {
  key: 'naruto-combo3',
  url: '/sprites/player/naruto/combo3.png',
  frameWidth: 86,
  frameHeight: 83,
  frameCount: 4,
  contentHeight: 81,
};

const NARUTO_ATTACK_CHAIN = [NARUTO_COMBO_1, NARUTO_COMBO_2, NARUTO_COMBO_3] as const;

const NARUTO_HURT: CharacterReactionAnimDef = {
  key: 'naruto-hurt',
  url: '/sprites/player/naruto/hurt.png',
  frameWidth: 97,
  frameHeight: 85,
  frameCount: 2,
  contentHeight: 81,
  frameRate: 10,
};

const NARUTO_DEATH: CharacterReactionAnimDef = {
  key: 'naruto-death',
  url: '/sprites/player/naruto/death.png',
  frameWidth: 97,
  frameHeight: 85,
  frameCount: 3,
  contentHeight: 81,
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
  hotbarSkillIds: [
    'skill-rasengan',
    'skill-kyuubi',
    null,
    null,
  ],
};

const SASUKE_WALK: SpriteSheetDef = {
  key: 'sasuke-walk',
  url: '/sprites/player/sasuke/walk.png',
  // npm run sasuke:all — assets/naruto-source/nu/sasuke/walk
  frameWidth: 99,
  frameHeight: 115,
  frameCount: 6,
  contentHeight: 111,
};

const SASUKE_IDLE: SpriteSheetDef = {
  key: 'sasuke-idle',
  url: '/sprites/player/sasuke/idle.png',
  frameWidth: 86,
  frameHeight: 115,
  frameCount: 6,
  contentHeight: 111,
};

const SASUKE_COMBO_1: SpriteSheetDef = {
  key: 'sasuke-combo1',
  url: '/sprites/player/sasuke/combo1.png',
  frameWidth: 136,
  frameHeight: 116,
  frameCount: 4,
  contentHeight: 111,
};

const SASUKE_COMBO_2: SpriteSheetDef = {
  key: 'sasuke-combo2',
  url: '/sprites/player/sasuke/combo2.png',
  frameWidth: 136,
  frameHeight: 116,
  frameCount: 4,
  contentHeight: 111,
};

const SASUKE_COMBO_3: SpriteSheetDef = {
  key: 'sasuke-combo3',
  url: '/sprites/player/sasuke/combo3.png',
  frameWidth: 136,
  frameHeight: 116,
  frameCount: 5,
  contentHeight: 111,
};

const SASUKE_ATTACK_CHAIN = [SASUKE_COMBO_1, SASUKE_COMBO_2, SASUKE_COMBO_3] as const;

const SASUKE_HURT: CharacterReactionAnimDef = {
  key: 'sasuke-hurt',
  url: '/sprites/player/sasuke/hurt.png',
  frameWidth: 145,
  frameHeight: 115,
  frameCount: 2,
  contentHeight: 111,
  frameRate: 10,
};

const SASUKE_DEATH: CharacterReactionAnimDef = {
  key: 'sasuke-death',
  url: '/sprites/player/sasuke/death.png',
  frameWidth: 145,
  frameHeight: 115,
  frameCount: 3,
  contentHeight: 111,
  frameRate: 8,
};

const SASUKE_JUTSU_ANIMS: Record<string, CharacterSkillAnimDef> = {
  // Katon Goukakyuu — 17f body cast + fire VFX (flight→impact)
  // npm run sasuke:all && npm run sasuke:gokakyu-fx
  'skill-katon-gokakyu': {
    key: 'sasuke-gokakyu',
    url: '/sprites/player/sasuke/sasuke-gokakyu.png',
    frameWidth: 130,
    frameHeight: 120,
    frameCount: 17,
    contentHeight: 111,
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
      frameWidth: 171,
      frameHeight: 109,
      frameCount: 12,
      contentHeight: 105,
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
  hotbarSkillIds: ['skill-katon-gokakyu', 'character-sasuke-skill-3', 'character-sasuke-skill-4'],
};

const ROCK_LEE_WALK: SpriteSheetDef = {
  key: 'rock-lee-walk',
  url: '/sprites/player/rock-lee/walk.png',
  // npm run rock-lee:all — assets/naruto-source/nu/rock-lee/walk
  frameWidth: 76,
  frameHeight: 134,
  frameCount: 6,
  contentHeight: 127,
};

const ROCK_LEE_IDLE: SpriteSheetDef = {
  key: 'rock-lee-idle',
  url: '/sprites/player/rock-lee/idle.png',
  // npm run rock-lee:all — assets/naruto-source/nu/rock-lee/idle
  frameWidth: 80,
  frameHeight: 131,
  frameCount: 6,
  contentHeight: 127,
};

const ROCK_LEE_COMBO_1: SpriteSheetDef = {
  key: 'rock-lee-combo1',
  url: '/sprites/player/rock-lee/combo1.png',
  // 22f combo → 7+7+8 (npm run rock-lee:all)
  frameWidth: 145,
  frameHeight: 130,
  frameCount: 7,
  contentHeight: 127,
};

const ROCK_LEE_COMBO_2: SpriteSheetDef = {
  key: 'rock-lee-combo2',
  url: '/sprites/player/rock-lee/combo2.png',
  frameWidth: 145,
  frameHeight: 130,
  frameCount: 7,
  contentHeight: 127,
};

const ROCK_LEE_COMBO_3: SpriteSheetDef = {
  key: 'rock-lee-combo3',
  url: '/sprites/player/rock-lee/combo3.png',
  frameWidth: 145,
  frameHeight: 130,
  frameCount: 8,
  contentHeight: 127,
};

const ROCK_LEE_ATTACK_CHAIN = [ROCK_LEE_COMBO_1, ROCK_LEE_COMBO_2, ROCK_LEE_COMBO_3] as const;

const ROCK_LEE_HURT: CharacterReactionAnimDef = {
  key: 'rock-lee-hurt',
  url: '/sprites/player/rock-lee/hurt.png',
  frameWidth: 136,
  frameHeight: 116,
  frameCount: 2,
  contentHeight: 127,
  frameRate: 10,
};

const ROCK_LEE_DEATH: CharacterReactionAnimDef = {
  key: 'rock-lee-death',
  url: '/sprites/player/rock-lee/death.png',
  frameWidth: 136,
  frameHeight: 116,
  frameCount: 3,
  contentHeight: 127,
  frameRate: 8,
};

const ROCK_LEE_JUTSU_ANIMS: Record<string, CharacterSkillAnimDef> = {
  // Omote Renge — 20f @ 14fps: f1 jump · f2–15 air · f16 ground hit
  'skill-omote-renge': {
    key: 'rock-lee-omote-renge',
    url: '/sprites/player/rock-lee/omote-renge.png',
    frameWidth: 201,
    frameHeight: 216,
    frameCount: 20,
    contentHeight: 127,
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
      frameWidth: 129,
      frameHeight: 110,
      frameCount: 1,
      contentHeight: 106,
    },
    // Ground slam dust (frame 16) — 5f strip
    fxSecondaryReleaseMs: 1071,
    fxSecondaryAttach: 'caster',
    fxSecondaryFrameRate: 14,
    fxSecondary: {
      key: 'rock-lee-omote-renge-impact-fx',
      url: '/sprites/player/rock-lee/omote-renge-impact-fx.png',
      frameWidth: 237,
      frameHeight: 195,
      frameCount: 5,
      contentHeight: 191,
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
  hotbarSkillIds: ['skill-omote-renge', 'character-lee-skill-3', 'character-lee-skill-4'],
};

/**
 * Shikamaru Nara — G6_Shikamaru NUN5 MUGEN (HQ nativo).
 * node scripts/process-shikamaru-g6.js
 * lookType 1426 (WONSR vocation).
 */
const SHIKAMARU_IDLE: SpriteSheetDef = {
  key: 'shikamaru-idle',
  url: '/sprites/player/shikamaru/idle.png',
  frameWidth: 33,
  frameHeight: 85,
  frameCount: 6,
  contentHeight: 81,
  originX: 0.515,
  frameRate: 8,
};

const SHIKAMARU_WALK: SpriteSheetDef = {
  key: 'shikamaru-walk',
  url: '/sprites/player/shikamaru/walk.png',
  frameWidth: 65,
  frameHeight: 68,
  frameCount: 6,
  contentHeight: 81,
  originX: 0.385,
  frameRate: 12,
};

const SHIKAMARU_COMBO_1: SpriteSheetDef = {
  key: 'shikamaru-combo1',
  url: '/sprites/player/shikamaru/combo1.png',
  frameWidth: 77,
  frameHeight: 81,
  frameCount: 4,
  contentHeight: 81,
  originX: 0.312,
  frameRate: 12,
};

const SHIKAMARU_COMBO_2: SpriteSheetDef = {
  key: 'shikamaru-combo2',
  url: '/sprites/player/shikamaru/combo2.png',
  frameWidth: 70,
  frameHeight: 82,
  frameCount: 4,
  contentHeight: 81,
  originX: 0.329,
  frameRate: 12,
};

const SHIKAMARU_COMBO_3: SpriteSheetDef = {
  key: 'shikamaru-combo3',
  url: '/sprites/player/shikamaru/combo3.png',
  frameWidth: 87,
  frameHeight: 83,
  frameCount: 9,
  contentHeight: 81,
  originX: 0.437,
  frameRate: 12,
};

const SHIKAMARU_ATTACK_CHAIN = [SHIKAMARU_COMBO_1, SHIKAMARU_COMBO_2, SHIKAMARU_COMBO_3] as const;

const SHIKAMARU_HURT: CharacterReactionAnimDef = {
  key: 'shikamaru-hurt',
  url: '/sprites/player/shikamaru/hurt.png',
  frameWidth: 39,
  frameHeight: 84,
  frameCount: 3,
  contentHeight: 81,
  originX: 0.564,
  frameRate: 10,
};

const SHIKAMARU_DEATH: CharacterReactionAnimDef = {
  key: 'shikamaru-death',
  url: '/sprites/player/shikamaru/death.png',
  frameWidth: 87,
  frameHeight: 45,
  frameCount: 3,
  contentHeight: 81,
  originX: 0.517,
  frameRate: 8,
};

/**
 * Kunai Explosiva — Bakushiki Shojin (G6) corpo + FX explosão/fogo.
 * node scripts/process-shikamaru-g6.js
 */
const SHIKAMARU_JUTSU_ANIMS: Record<string, CharacterSkillAnimDef> = {
  'skill-explosion-kunai': {
    key: 'shikamaru-explosion-kunai',
    url: '/sprites/player/shikamaru/explosion-kunai.png',
    frameWidth: 73,
    frameHeight: 81,
    frameCount: 11,
    contentHeight: 81,
    frameRate: 18,
    durationMs: 611,
    hitDelayMs: 750,
    originX: 0.6027,
    fxReleaseMs: 750,
    fxAttach: 'target',
    fxGround: true,
    fxIndependentScale: true,
    fxScale: 1.05,
    fxBlend: 'add',
    fx: {
      key: 'shikamaru-explosion-kunai-fx',
      url: '/sprites/player/shikamaru/explosion-kunai-fx.png',
      frameWidth: 171,
      frameHeight: 169,
      frameCount: 12,
      contentHeight: 165,
      originX: 0.5,
      frameRate: 8,
      offsetX: 0,
      offsetY: 0,
    },
    targeting: {
      mode: 'instant-target',
      travelSpeed: 600,
      spawnOffsetX: 0,
      spawnOffsetY: 0,
      targetOffsetX: 0,
      targetOffsetY: 0,
    },
    execution: {
      type: 'area',
      radius: 200,
    },
    element: 'fire',
    ai: {
      autoUse: true,
      priority: 1,
      energyCost: 40,
    },
    offsetX: 0,
    offsetY: 0,
    loopMode: 'none',
    loopUntilSkillEnd: false,
    flipX: false,
    flipY: false,
    cast: {
      scaleX: 1,
      scaleY: 1,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      loopMode: 'none',
    },
    castDelayMs: 0,
    vfxLoopMode: 'none',
    vfxLoopStartFrame: 1,
    vfxLoopEndFrame: 1,
    vfxLoopDurationMs: 3000,
    vfxLoopUntilSkillEnd: false,
    vfxFlipX: false,
    vfxFlipY: false,
  },
  'shikamaru-jutsu-2': {
    key: 'shikamaru-idle',
    url: '/sprites/player/shikamaru/idle.png',
    frameWidth: 33,
    frameHeight: 85,
    frameCount: 6,
    contentHeight: 81,
    frameRate: 8,
    offsetX: 0,
    offsetY: 0,
    durationMs: 750,
    hitDelayMs: 280,
    vfxId: 'jutsu-1',
    fxScale: 3,
    vfxOffsetX: 0,
    vfxOffsetY: 0,
    vfxLoopMode: 'none',
    vfxLoopStartFrame: 1,
    vfxLoopEndFrame: 1,
    vfxLoopDurationMs: 3000,
    loopMode: 'none',
    castDelayMs: 0,
    targeting: {
      mode: 'instant-target',
      travelSpeed: 600,
      spawnOffsetX: 0,
      spawnOffsetY: 0,
      targetOffsetX: 0,
      targetOffsetY: 0,
    },
    cast: {
      scaleX: 1,
      scaleY: 1,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      loopMode: 'none',
      loopUntilSkillEnd: false,
      flipX: false,
      flipY: false,
    },
    loopUntilSkillEnd: false,
    flipX: false,
    flipY: false,
    vfxLoopUntilSkillEnd: false,
    vfxFlipX: false,
    vfxFlipY: false,
    element: 'neutral',
        ai: {
      autoUse: true,
      priority: 2,
      energyCost: 40,
    },
  },
  'shikamaru-jutsu-3': {
    key: 'shikamaru-frame-001',
    url: '/sprites/player/shikamaru/poses/frame-001/frame-001.png',
    frames: ['/sprites/player/shikamaru/poses/frame-001/frame-001.png', '/sprites/player/shikamaru/poses/frame-001/frame-002.png'],
    frameWidth: 120,
    frameHeight: 240,
    frameCount: 2,
    frameRate: 10,
    offsetX: 0,
    offsetY: 0,
    durationMs: 200,
    hitDelayMs: 280,
    vfxId: 'jutsu-3',
    fxScale: 5.55,
    vfxOffsetX: 0,
    vfxOffsetY: 0,
    vfxLoopMode: 'none',
    vfxLoopStartFrame: 1,
    vfxLoopEndFrame: 1,
    vfxLoopDurationMs: 3000,
    loopMode: 'none',
    castDelayMs: 0,
    targeting: {
      mode: 'instant-target',
      travelSpeed: 600,
      spawnOffsetX: 0,
      spawnOffsetY: 0,
      targetOffsetX: 0,
      targetOffsetY: 0,
    },
    cast: {
      scaleX: 0.4,
      scaleY: 0.4,
      scale: 0.4,
      offsetX: 0,
      offsetY: 0,
      loopMode: 'none',
      loopUntilSkillEnd: false,
      flipX: false,
      flipY: false,
    },
    loopUntilSkillEnd: false,
    flipX: false,
    flipY: false,
    vfxLoopUntilSkillEnd: false,
    vfxFlipX: false,
    vfxFlipY: false,
    element: 'neutral',
        ai: {
      autoUse: true,
      priority: 1,
      energyCost: 40,
    },
  },
  'shikamaru-jutsu-4': {
    key: 'shikamaru-frame-001',
    url: '/sprites/player/shikamaru/poses/frame-001/frame-001.png',
    frames: [
      '/sprites/player/shikamaru/poses/frame-001/frame-001.png',
      '/sprites/player/shikamaru/poses/frame-001/frame-002.png',
    ],
    frameWidth: 120,
    frameHeight: 240,
    frameCount: 2,
    frameRate: 10,
    offsetX: 0,
    offsetY: 0,
    durationMs: 200,
    hitDelayMs: 280,
    vfxId: 'jutsu-4',
    fxScale: 4,
    vfxOffsetX: 0,
    vfxOffsetY: 0,
    vfxLoopMode: 'none',
    vfxLoopStartFrame: 1,
    vfxLoopEndFrame: 1,
    vfxLoopDurationMs: 3000,
    loopMode: 'none',
    castDelayMs: 0,
    targeting: {
      mode: 'instant-target',
      travelSpeed: 600,
      spawnOffsetX: 0,
      spawnOffsetY: 0,
      targetOffsetX: 0,
      targetOffsetY: 0,
    },
    execution: {
      type: 'area',
      radius: 1000,
    },
    cast: {
      scaleX: 0.35,
      scaleY: 0.35,
      scale: 0.35,
      offsetX: 0,
      offsetY: 0,
    },
  },
};

const SHIKAMARU_PACK: CharacterPack = {
  id: 'shikamaru',
  walk: SHIKAMARU_WALK,
  idle: SHIKAMARU_IDLE,
  attack: SHIKAMARU_COMBO_1,
  attackChain: SHIKAMARU_ATTACK_CHAIN,
  hurt: SHIKAMARU_HURT,
  death: SHIKAMARU_DEATH,
  skillAnims: SHIKAMARU_JUTSU_ANIMS,
  hotbarSkillIds: ['skill-explosion-kunai', 'shikamaru-jutsu-2', 'shikamaru-jutsu-3', 'shikamaru-jutsu-4'],
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
  frameWidth: 91,
  frameHeight: 115,
  frameCount: 6,
  contentHeight: 117,
};

/** npm run neji:walk — assets/naruto-source/nu/neji/walk (6f alpha) */
const NEJI_WALK: SpriteSheetDef = {
  key: 'neji-walk',
  url: '/sprites/player/neji/walk.png',
  frameWidth: 61,
  frameHeight: 121,
  frameCount: 6,
  contentHeight: 117,
};

/** npm run neji:combo — 19f alpha → 5+5+9 (same absoluteScale as walk) */
const NEJI_COMBO_1: SpriteSheetDef = {
  key: 'neji-combo1',
  url: '/sprites/player/neji/combo1.png',
  frameWidth: 131,
  frameHeight: 121,
  frameCount: 5,
  contentHeight: 117,
};

const NEJI_COMBO_2: SpriteSheetDef = {
  key: 'neji-combo2',
  url: '/sprites/player/neji/combo2.png',
  frameWidth: 131,
  frameHeight: 121,
  frameCount: 5,
  contentHeight: 117,
};

const NEJI_COMBO_3: SpriteSheetDef = {
  key: 'neji-combo3',
  url: '/sprites/player/neji/combo3.png',
  frameWidth: 131,
  frameHeight: 121,
  frameCount: 9,
  contentHeight: 117,
};

const NEJI_ATTACK_CHAIN = [NEJI_COMBO_1, NEJI_COMBO_2, NEJI_COMBO_3] as const;

const NEJI_PALM_FX: SpriteSheetDef = {
  key: 'neji-hakke-palm-fx',
  url: '/sprites/player/hinata/hakke-shou-fx.png',
  frameWidth: 56,
  frameHeight: 67,
  frameCount: 4,
  contentHeight: 63,
};

/** WONSR Hyūga (pasta hinata) — Neji não tem vocação própria no spells.xml. npm run neji:jutsu */
const NEJI_KAITEN_ANIM: CharacterSkillAnimDef = {
  key: 'neji-kaiten',
  url: '/sprites/player/neji/kaiten.png',
  frameWidth: 342,
  frameHeight: 222,
  frameCount: 18,
  contentHeight: 117,
  frameRate: 12,
  durationMs: 1500,
  hitDelayMs: 333,
  fxReleaseMs: 333,
  fxAttach: 'caster',
  fxGround: true,
  fx: NEJI_PALM_FX,
};

const NEJI_JUUKEN_ANIM: CharacterSkillAnimDef = {
  key: 'neji-juuken',
  url: '/sprites/player/neji/combo1.png',
  frameWidth: 131,
  frameHeight: 121,
  frameCount: 5,
  contentHeight: 117,
  frameRate: 12,
  durationMs: 417,
  hitDelayMs: 200,
  fxReleaseMs: 200,
  fxAttach: 'target',
  fxGround: true,
  fx: NEJI_PALM_FX,
};

const NEJI_KUSHOU_ANIM: CharacterSkillAnimDef = {
  key: 'neji-juuken-kushou',
  url: '/sprites/player/neji/combo2.png',
  frameWidth: 131,
  frameHeight: 121,
  frameCount: 5,
  contentHeight: 117,
  frameRate: 12,
  durationMs: 417,
  hitDelayMs: 200,
  fxReleaseMs: 200,
  fxAttach: 'target',
  fx: NEJI_PALM_FX,
};

const NEJI_SOSHI_ANIM: CharacterSkillAnimDef = {
  key: 'neji-juhou-soshiken',
  url: '/sprites/player/neji/combo3.png',
  frameWidth: 131,
  frameHeight: 121,
  frameCount: 9,
  contentHeight: 117,
  frameRate: 12,
  durationMs: 750,
  hitDelayMs: 400,
  fxReleaseMs: 400,
  fxAttach: 'target',
  fxGround: true,
  fx: NEJI_PALM_FX,
};

const NEJI_JUTSU_ANIMS: Record<string, CharacterSkillAnimDef> = {
  'skill-juuken': NEJI_JUUKEN_ANIM,
  'skill-juuken-kushou': NEJI_KUSHOU_ANIM,
  'skill-hakke-kaiten': NEJI_KAITEN_ANIM,
  'skill-juhou-soshiken': NEJI_SOSHI_ANIM,
  'character-neji-skill-1': NEJI_JUUKEN_ANIM,
  'character-neji-skill-2': NEJI_KUSHOU_ANIM,
  'character-neji-skill-3': NEJI_SOSHI_ANIM,
  'character-neji-skill-4': NEJI_KAITEN_ANIM,
};

const NEJI_PACK: CharacterPack = {
  id: 'neji',
  walk: NEJI_WALK,
  idle: NEJI_IDLE,
  attack: NEJI_COMBO_1,
  attackChain: NEJI_ATTACK_CHAIN,
  skillAnims: NEJI_JUTSU_ANIMS,
  hotbarSkillIds: [
    null,
    null,
    'skill-hakke-kaiten',
    'skill-juhou-soshiken',
  ],
};

/** Gaara (vocation 1395 + variantes de mapa). npm run gaara:all */
export const GAARA_LOOK_TYPES = [1395, 41, 42, 710] as const;

const GAARA_IDLE: SpriteSheetDef = {
  key: 'gaara-idle',
  url: '/sprites/player/gaara/idle.png',
  frameWidth: 59,
  frameHeight: 124,
  frameCount: 4,
  contentHeight: 120,
};

const GAARA_WALK: SpriteSheetDef = {
  key: 'gaara-walk',
  url: '/sprites/player/gaara/walk.png',
  frameWidth: 64,
  frameHeight: 125,
  frameCount: 6,
  contentHeight: 120,
};

const GAARA_COMBO_1: SpriteSheetDef = {
  key: 'gaara-combo1',
  url: '/sprites/player/gaara/combo1.png',
  frameWidth: 194,
  frameHeight: 171,
  frameCount: 5,
  contentHeight: 120,
};

const GAARA_COMBO_2: SpriteSheetDef = {
  key: 'gaara-combo2',
  url: '/sprites/player/gaara/combo2.png',
  frameWidth: 194,
  frameHeight: 171,
  frameCount: 5,
  contentHeight: 120,
};

const GAARA_COMBO_3: SpriteSheetDef = {
  key: 'gaara-combo3',
  url: '/sprites/player/gaara/combo3.png',
  frameWidth: 194,
  frameHeight: 171,
  frameCount: 5,
  contentHeight: 120,
};

const GAARA_ATTACK_CHAIN = [GAARA_COMBO_1, GAARA_COMBO_2, GAARA_COMBO_3] as const;

/** npm run gaara:damage — frames 1–2 do strip damage-source. */
const GAARA_HURT: CharacterReactionAnimDef = {
  key: 'gaara-hurt',
  url: '/sprites/player/gaara/hurt.png',
  frameWidth: 143,
  frameHeight: 126,
  frameCount: 2,
  contentHeight: 120,
  frameRate: 9,
};

/** npm run gaara:damage — frames 3–5 death, hold last. */
const GAARA_DEATH: CharacterReactionAnimDef = {
  key: 'gaara-death',
  url: '/sprites/player/gaara/death.png',
  frameWidth: 143,
  frameHeight: 126,
  frameCount: 3,
  contentHeight: 120,
  frameRate: 8,
};

const GAARA_JUTSU_ANIMS: Record<string, CharacterSkillAnimDef> = {
  'skill-sand-prison': {
    key: 'gaara-sand-prison',
    url: '/sprites/player/gaara/sand-prison.png',
    frameWidth: 494,
    frameHeight: 430,
    frameCount: 25,
    contentHeight: 120,
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
  frameWidth: 54,
  frameHeight: 130,
  frameCount: 4,
  contentHeight: 123,
};

const SAKURA_WALK: SpriteSheetDef = {
  key: 'sakura-walk',
  url: '/sprites/player/sakura/walk.png',
  frameWidth: 130,
  frameHeight: 134,
  frameCount: 6,
  contentHeight: 123,
};

const SAKURA_COMBO_1: SpriteSheetDef = {
  key: 'sakura-combo1',
  url: '/sprites/player/sakura/combo1.png',
  frameWidth: 119,
  frameHeight: 129,
  frameCount: 2,
  contentHeight: 123,
};

const SAKURA_COMBO_2: SpriteSheetDef = {
  key: 'sakura-combo2',
  url: '/sprites/player/sakura/combo2.png',
  frameWidth: 119,
  frameHeight: 129,
  frameCount: 2,
  contentHeight: 123,
};

const SAKURA_COMBO_3: SpriteSheetDef = {
  key: 'sakura-combo3',
  url: '/sprites/player/sakura/combo3.png',
  frameWidth: 119,
  frameHeight: 129,
  frameCount: 1,
  contentHeight: 123,
};

const SAKURA_ATTACK_CHAIN = [SAKURA_COMBO_1, SAKURA_COMBO_2, SAKURA_COMBO_3] as const;

const SAKURA_HURT: CharacterReactionAnimDef = {
  key: 'sakura-hurt',
  url: '/sprites/player/sakura/hurt.png',
  frameWidth: 191,
  frameHeight: 117,
  frameCount: 2,
  contentHeight: 123,
  frameRate: 10,
};

const SAKURA_DEATH: CharacterReactionAnimDef = {
  key: 'sakura-death',
  url: '/sprites/player/sakura/death.png',
  frameWidth: 191,
  frameHeight: 117,
  frameCount: 3,
  contentHeight: 123,
  frameRate: 8,
};

const SAKURA_JUTSU_ANIMS: Record<string, CharacterSkillAnimDef> = {
  'skill-chou-bakou': {
    key: 'sakura-chou-bakou',
    url: '/sprites/player/sakura/chou-bakou.png',
    frameWidth: 119,
    frameHeight: 129,
    frameCount: 13,
    contentHeight: 123,
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
 * Chouji Akimichi (Part I / Kid) — NUN5 MUGEN `Choji_Kid` (HQ nativo).
 * node scripts/process-chouji-kid.js
 * lookType 9004 é identidade client-only.
 */
export const CHOUJI_CURATED_LOOK_TYPE = 9004;

const CHOUJI_IDLE: SpriteSheetDef = {
  key: 'chouji-idle',
  url: '/sprites/player/chouji/idle.png',
  frameWidth: 35,
  frameHeight: 60,
  frameCount: 5,
  contentHeight: 56,
  originX: 0.571,
  frameRate: 8,
};

const CHOUJI_WALK: SpriteSheetDef = {
  key: 'chouji-walk',
  url: '/sprites/player/chouji/walk.png',
  frameWidth: 37,
  frameHeight: 61,
  frameCount: 6,
  contentHeight: 56,
  originX: 0.541,
  frameRate: 12,
};

const CHOUJI_COMBO_1: SpriteSheetDef = {
  key: 'chouji-combo1',
  url: '/sprites/player/chouji/combo1.png',
  frameWidth: 48,
  frameHeight: 60,
  frameCount: 4,
  contentHeight: 56,
  originX: 0.438,
  frameRate: 12,
};

const CHOUJI_COMBO_2: SpriteSheetDef = {
  key: 'chouji-combo2',
  url: '/sprites/player/chouji/combo2.png',
  frameWidth: 59,
  frameHeight: 61,
  frameCount: 5,
  contentHeight: 56,
  originX: 0.424,
  frameRate: 12,
};

const CHOUJI_COMBO_3: SpriteSheetDef = {
  key: 'chouji-combo3',
  url: '/sprites/player/chouji/combo3.png',
  frameWidth: 62,
  frameHeight: 62,
  frameCount: 12,
  contentHeight: 56,
  originX: 0.435,
  frameRate: 12,
};

const CHOUJI_ATTACK_CHAIN = [CHOUJI_COMBO_1, CHOUJI_COMBO_2, CHOUJI_COMBO_3] as const;

const CHOUJI_HURT: CharacterReactionAnimDef = {
  key: 'chouji-hurt',
  url: '/sprites/player/chouji/hurt.png',
  frameWidth: 43,
  frameHeight: 58,
  frameCount: 3,
  contentHeight: 56,
  originX: 0.488,
  frameRate: 10,
};

const CHOUJI_DEATH: CharacterReactionAnimDef = {
  key: 'chouji-death',
  url: '/sprites/player/chouji/death.png',
  frameWidth: 59,
  frameHeight: 57,
  frameCount: 3,
  contentHeight: 56,
  originX: 0.492,
  frameRate: 8,
};

/**
 * Chouji Kid jutsus (NUN5) — melhores VFX do pack:
 * Nikudan (Baika bola), Chō Harite (mãos 1150), Baika Jishin (quake 1200), Bubun Baika (inflate 1100).
 */
const CHOUJI_JUTSU_ANIMS: Record<string, CharacterSkillAnimDef> = {
  'skill-nikudan-sensha': {
    key: 'chouji-nikudan-sensha',
    url: '/sprites/player/chouji/nikudan-sensha.png',
    frameWidth: 95,
    frameHeight: 85,
    frameCount: 26,
    contentHeight: 56,
    frameRate: 12,
    durationMs: 2167,
    hitDelayMs: 1917,
    originX: 0.5579,
    element: 'yang',
    ai: {
      autoUse: true,
      priority: 1,
      energyCost: 28,
    },
  },
  'skill-chou-harite': {
    key: 'chouji-chou-harite',
    url: '/sprites/player/chouji/chou-harite.png',
    frameWidth: 33,
    frameHeight: 60,
    frameCount: 6,
    contentHeight: 56,
    frameRate: 12,
    durationMs: 1000,
    hitDelayMs: 333,
    originX: 0.2424,
    fxReleaseMs: 333,
    fxAttach: 'target',
    fxGround: false,
    fxScale: 1.15,
    fx: {
      key: 'chouji-chou-harite-fx',
      url: '/sprites/player/chouji/chou-harite-fx.png',
      frameWidth: 161,
      frameHeight: 143,
      frameCount: 6,
      contentHeight: 139,
      originX: 0.5,
    },
    element: 'yang',
    ai: {
      autoUse: true,
      priority: 2,
      energyCost: 24,
    },
  },
  'skill-baika-jishin': {
    key: 'chouji-baika-jishin',
    url: '/sprites/player/chouji/baika-jishin.png',
    frameWidth: 146,
    frameHeight: 176,
    frameCount: 25,
    contentHeight: 56,
    frameRate: 12,
    durationMs: 2083,
    hitDelayMs: 833,
    originX: 0.3699,
    element: 'yang',
    ai: {
      autoUse: true,
      priority: 3,
      energyCost: 26,
    },
  },
  'skill-bubun-baika': {
    key: 'chouji-bubun-baika',
    url: '/sprites/player/chouji/bubun-baika.png',
    frameWidth: 92,
    frameHeight: 85,
    frameCount: 14,
    contentHeight: 56,
    frameRate: 12,
    durationMs: 1167,
    hitDelayMs: 583,
    originX: 0.5761,
    element: 'yang',
    ai: {
      autoUse: true,
      priority: 4,
      energyCost: 22,
    },
  },
};

const CHOUJI_PACK: CharacterPack = {
  id: 'chouji',
  walk: CHOUJI_WALK,
  idle: CHOUJI_IDLE,
  attack: CHOUJI_COMBO_1,
  attackChain: CHOUJI_ATTACK_CHAIN,
  hurt: CHOUJI_HURT,
  death: CHOUJI_DEATH,
  skillAnims: CHOUJI_JUTSU_ANIMS,
  hotbarSkillIds: [
    'skill-nikudan-sensha',
    'skill-chou-harite',
    'skill-baika-jishin',
    'skill-bubun-baika',
  ],
};

/**
 * Hinata Hyuga — idle + walk + palm combo + hurt/death + Hakke Shōhō (+ VFX).
 * npm run hinata:all — assets/naruto-source/nu/hinata/{idle,walk,combo,damage,jutsu,jutsu-vfx}
 * lookType 9005 é identidade client-only. HQ nativePixels (contentHeight 54).
 */
export const HINATA_CURATED_LOOK_TYPE = 9005;

const HINATA_IDLE: SpriteSheetDef = {
  key: 'hinata-idle',
  url: '/sprites/player/hinata/idle.png',
  frameWidth: 38,
  frameHeight: 58,
  frameCount: 5,
  contentHeight: 54,
};

const HINATA_WALK: SpriteSheetDef = {
  key: 'hinata-walk',
  url: '/sprites/player/hinata/walk.png',
  frameWidth: 30,
  frameHeight: 60,
  frameCount: 6,
  contentHeight: 54,
};

const HINATA_COMBO_1: SpriteSheetDef = {
  key: 'hinata-combo1',
  url: '/sprites/player/hinata/combo1.png',
  frameWidth: 56,
  frameHeight: 57,
  frameCount: 5,
  contentHeight: 54,
};

const HINATA_COMBO_2: SpriteSheetDef = {
  key: 'hinata-combo2',
  url: '/sprites/player/hinata/combo2.png',
  frameWidth: 56,
  frameHeight: 57,
  frameCount: 5,
  contentHeight: 54,
};

const HINATA_COMBO_3: SpriteSheetDef = {
  key: 'hinata-combo3',
  url: '/sprites/player/hinata/combo3.png',
  frameWidth: 56,
  frameHeight: 57,
  frameCount: 5,
  contentHeight: 54,
};

const HINATA_ATTACK_CHAIN = [HINATA_COMBO_1, HINATA_COMBO_2, HINATA_COMBO_3] as const;

const HINATA_HURT: CharacterReactionAnimDef = {
  key: 'hinata-hurt',
  url: '/sprites/player/hinata/hurt.png',
  frameWidth: 64,
  frameHeight: 59,
  frameCount: 2,
  contentHeight: 54,
  frameRate: 10,
};

const HINATA_DEATH: CharacterReactionAnimDef = {
  key: 'hinata-death',
  url: '/sprites/player/hinata/death.png',
  frameWidth: 64,
  frameHeight: 59,
  frameCount: 3,
  contentHeight: 54,
  frameRate: 8,
};

/** npm run hinata:all — Hakke Shōhō 27f body + 4f VFX spikes. */
const HINATA_JUTSU_ANIMS: Record<string, CharacterSkillAnimDef> = {
  'skill-hakke-shouhou': {
    key: 'hinata-hakke-shou',
    url: '/sprites/player/hinata/hakke-shou.png',
    frameWidth: 86,
    frameHeight: 85,
    frameCount: 27,
    contentHeight: 54,
    frameRate: 24,
    durationMs: 1125,
    // Frame 22 @ 12fps — palm impact after smear; handstand f26–27 is follow-up
    hitDelayMs: 1750,
    originX: 0.5,
    fxReleaseMs: 1750,
    fxAttach: 'target',
    fxGround: true,
    fx: {
      key: 'hinata-hakke-shou-fx',
      url: '/sprites/player/hinata/hakke-shou-fx.png',
      frameWidth: 56,
      frameHeight: 67,
      frameCount: 4,
      contentHeight: 63,
      offsetX: 0,
      offsetY: 0,
    },
    offsetX: 0,
    offsetY: 0,
    loop: true,
    loopMode: 'persistent-range',
    loopStartFrame: 1,
    loopEndFrame: 24,
    loopUntilSkillEnd: true,
    flipX: false,
    flipY: false,
    cast: {
      scaleX: 1,
      scaleY: 1,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      loop: true,
      loopMode: 'persistent-range',
      loopStartFrame: 1,
      loopEndFrame: 24,
      loopUntilSkillEnd: true,
      flipX: false,
      flipY: false,
    },
    fxScale: 2,
    castDelayMs: 0,
    vfxLoopMode: 'none',
    vfxLoopStartFrame: 1,
    vfxLoopEndFrame: 1,
    vfxLoopDurationMs: 3000,
    vfxLoopUntilSkillEnd: false,
    vfxFlipX: false,
    vfxFlipY: false,
    targeting: {
      mode: 'instant-target',
      travelSpeed: 600,
      spawnOffsetX: 0,
      spawnOffsetY: 0,
      targetOffsetX: 0,
      targetOffsetY: 0,
    },
    element: 'yang',
        ai: {
      autoUse: true,
      priority: 1,
      energyCost: 40,
    },
        execution: {
      type: 'persistent',
      duration: 1000,
      tickInterval: 1000,
      persistentAnchor: 'target',
    },
  },
};

const HINATA_PACK: CharacterPack = {
  id: 'hinata',
  walk: HINATA_WALK,
  idle: HINATA_IDLE,
  attack: HINATA_COMBO_1,
  attackChain: HINATA_ATTACK_CHAIN,
  hurt: HINATA_HURT,
  death: HINATA_DEATH,
  skillAnims: HINATA_JUTSU_ANIMS,
  hotbarSkillIds: [
    'skill-hakke-shouhou',
    null,
    null,
    null,
  ],
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
  frameWidth: 82,
  frameHeight: 144,
  frameCount: 6,
  contentHeight: 140,
};

const GUY_WALK: SpriteSheetDef = {
  key: 'guy-walk',
  url: '/sprites/player/guy/walk.png',
  frameWidth: 74,
  frameHeight: 147,
  frameCount: 6,
  contentHeight: 140,
};

const GUY_COMBO_1: SpriteSheetDef = {
  key: 'guy-combo1',
  url: '/sprites/player/guy/combo1.png',
  // frame_001…005 — hit 1
  frameWidth: 136,
  frameHeight: 163,
  frameCount: 5,
  contentHeight: 132,
};

const GUY_COMBO_2: SpriteSheetDef = {
  key: 'guy-combo2',
  url: '/sprites/player/guy/combo2.png',
  // frame_006…010 — hit 2
  frameWidth: 136,
  frameHeight: 163,
  frameCount: 5,
  contentHeight: 132,
};

const GUY_COMBO_3: SpriteSheetDef = {
  key: 'guy-combo3',
  url: '/sprites/player/guy/combo3.png',
  // frame_011…020 — finisher
  frameWidth: 136,
  frameHeight: 163,
  frameCount: 10,
  contentHeight: 132,
};

const GUY_ATTACK_CHAIN = [GUY_COMBO_1, GUY_COMBO_2, GUY_COMBO_3] as const;

const GUY_JUTSU_ANIMS: Record<string, CharacterSkillAnimDef> = {
  // Asa Kujaku — morning peacock flaming strikes (npm run guy:jutsu)
  'skill-asa-kujaku': {
    key: 'guy-asa-kujaku',
    url: '/sprites/player/guy/asa-kujaku.png',
    frameWidth: 170,
    frameHeight: 157,
    frameCount: 16,
    contentHeight: 140,
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
  frameWidth: 62,
  frameHeight: 130,
  frameCount: 6,
  contentHeight: 123,
};

const INO_WALK: SpriteSheetDef = {
  key: 'ino-walk',
  url: '/sprites/player/ino/walk.png',
  frameWidth: 76,
  frameHeight: 131,
  frameCount: 6,
  contentHeight: 123,
};

const INO_COMBO_1: SpriteSheetDef = {
  key: 'ino-combo1',
  url: '/sprites/player/ino/combo1.png',
  // frame_001…005 — hit 1
  frameWidth: 141,
  frameHeight: 134,
  frameCount: 5,
  contentHeight: 123,
};

const INO_COMBO_2: SpriteSheetDef = {
  key: 'ino-combo2',
  url: '/sprites/player/ino/combo2.png',
  // frame_006…010 — hit 2
  frameWidth: 141,
  frameHeight: 134,
  frameCount: 5,
  contentHeight: 123,
};

const INO_COMBO_3: SpriteSheetDef = {
  key: 'ino-combo3',
  url: '/sprites/player/ino/combo3.png',
  // frame_011…014 — finisher
  frameWidth: 141,
  frameHeight: 134,
  frameCount: 4,
  contentHeight: 123,
};

const INO_ATTACK_CHAIN = [INO_COMBO_1, INO_COMBO_2, INO_COMBO_3] as const;

/** npm run ino:damage — frames 1–2 hit reaction. */
const INO_HURT: CharacterReactionAnimDef = {
  key: 'ino-hurt',
  url: '/sprites/player/ino/hurt.png',
  frameWidth: 127,
  frameHeight: 127,
  frameCount: 2,
  contentHeight: 123,
  frameRate: 9,
};

/** npm run ino:damage — frames 3–5 death, hold last. */
const INO_DEATH: CharacterReactionAnimDef = {
  key: 'ino-death',
  url: '/sprites/player/ino/death.png',
  frameWidth: 127,
  frameHeight: 127,
  frameCount: 3,
  contentHeight: 123,
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
    frameWidth: 447,
    frameHeight: 390,
    frameCount: 17,
    contentHeight: 123,
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
 * npm run kakashi:pose-geral — assets/naruto-source/nu/kakashi/pose-geral/frame_*.png
 * lookType 9008 é identidade client-only.
 */
export const KAKASHI_CURATED_LOOK_TYPE = 9008;

const KAKASHI_IDLE: SpriteSheetDef = {
  key: 'kakashi-idle',
  url: '/sprites/player/kakashi/idle.png',
  // npm run kakashi:idle — 6f breath; alpha-only; nearest walk-matched; body-lock torso+feet
  frameWidth: 103,
  frameHeight: 160,
  frameCount: 6,
  contentHeight: 160,
};

const KAKASHI_WALK: SpriteSheetDef = {
  key: 'kakashi-walk',
  url: '/sprites/player/kakashi/walk.png',
  // npm run kakashi:walk — 6f side walk; alpha-only; nearest max→48; feet+torso lock
  frameWidth: 85,
  frameHeight: 164,
  frameCount: 6,
  contentHeight: 160,
};

const KAKASHI_COMBO_1: SpriteSheetDef = {
  key: 'kakashi-combo1',
  url: '/sprites/player/kakashi/combo1.png',
  // npm run kakashi:combo — hit 1; alpha-only; lanczos3 body-match→48 (soft HQ); 5+4+4
  frameWidth: 185,
  frameHeight: 191,
  frameCount: 5,
  contentHeight: 160,
};

const KAKASHI_COMBO_2: SpriteSheetDef = {
  key: 'kakashi-combo2',
  url: '/sprites/player/kakashi/combo2.png',
  // hit 2
  frameWidth: 185,
  frameHeight: 191,
  frameCount: 4,
  contentHeight: 160,
};

const KAKASHI_COMBO_3: SpriteSheetDef = {
  key: 'kakashi-combo3',
  url: '/sprites/player/kakashi/combo3.png',
  // finisher
  frameWidth: 185,
  frameHeight: 191,
  frameCount: 4,
  contentHeight: 160,
};

const KAKASHI_ATTACK_CHAIN = [KAKASHI_COMBO_1, KAKASHI_COMBO_2, KAKASHI_COMBO_3] as const;

/** npm run kakashi:damage — frames 1–2 hit reaction. */
const KAKASHI_HURT: CharacterReactionAnimDef = {
  key: 'kakashi-hurt',
  url: '/sprites/player/kakashi/hurt.png',
  frameWidth: 228,
  frameHeight: 171,
  frameCount: 2,
  contentHeight: 160,
  frameRate: 9,
};

/** npm run kakashi:damage — frames 3–5 death, hold last. */
const KAKASHI_DEATH: CharacterReactionAnimDef = {
  key: 'kakashi-death',
  url: '/sprites/player/kakashi/death.png',
  frameWidth: 228,
  frameHeight: 171,
  frameCount: 3,
  contentHeight: 160,
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
    frameWidth: 243,
    frameHeight: 176,
    frameCount: 26,
    contentHeight: 160,
    frameRate: 12,
    durationMs: 2167,
    // Peak VFX discharge (frame 18 / 26) — combat dash lands near peak.
    hitDelayMs: 1417,
  },
  'kakashi-pose-geral': {
    key: 'kakashi-pose-geral',
    url: '/sprites/player/kakashi/pose-geral.png',
    frameWidth: 146,
    frameHeight: 190,
    frameCount: 7,
    contentHeight: 160,
    frameRate: 12,
    durationMs: 583,
    hitDelayMs: 280,
    offsetX: 0,
    offsetY: 0,
    loopMode: 'none',
    loopUntilSkillEnd: false,
    flipX: false,
    flipY: false,
    cast: {
      scaleX: 1,
      scaleY: 1,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      loopMode: 'none',
      loopUntilSkillEnd: false,
      flipX: false,
      flipY: false,
    },
    fxScale: 5,
    castDelayMs: 0,
    vfxLoopMode: 'none',
    vfxLoopStartFrame: 1,
    vfxLoopEndFrame: 1,
    vfxLoopDurationMs: 3000,
    vfxLoopUntilSkillEnd: false,
    vfxFlipX: false,
    vfxFlipY: false,
    vfxId: 'dragon-water',
    targeting: {
      mode: 'instant-target',
      travelSpeed: 600,
      spawnOffsetX: 0,
      spawnOffsetY: 0,
      targetOffsetX: 0,
      targetOffsetY: 0,
    },
    element: 'neutral',
        ai: {
      autoUse: true,
      priority: 2,
      energyCost: 40,
    },
    vfxOffsetX: 0,
    vfxOffsetY: 0,
        execution: {
      type: 'persistent',
      duration: 1300,
      tickInterval: 1000,
      persistentAnchor: 'target',
    },
  },
  'kakashi-dragon-water-rage': {
    key: 'kakashi-pose-geral',
    url: '/sprites/player/kakashi/pose-geral.png',
    frameWidth: 146,
    frameHeight: 190,
    frameCount: 7,
    frameRate: 12,
    offsetX: 0,
    offsetY: 0,
    durationMs: 583,
    hitDelayMs: 280,
    vfxId: 'dragon-water-rage',
    fxScale: 2.55,
    vfxOffsetX: 0,
    vfxOffsetY: 0,
    vfxLoopMode: 'none',
    vfxLoopStartFrame: 1,
    vfxLoopEndFrame: 1,
    vfxLoopDurationMs: 3000,
    loopMode: 'none',
    castDelayMs: 0,
    targeting: {
      mode: 'travel-to-target',
      travelSpeed: 1000,
      spawnOffsetX: 0,
      spawnOffsetY: 0,
      targetOffsetX: 0,
      targetOffsetY: 0,
    },
    cast: {
      scaleX: 1,
      scaleY: 1,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      loopMode: 'none',
      loopUntilSkillEnd: false,
      flipX: false,
      flipY: false,
    },
    loopUntilSkillEnd: false,
    flipX: false,
    flipY: false,
    vfxLoopUntilSkillEnd: false,
    vfxFlipX: false,
    vfxFlipY: false,
    element: 'neutral',
        ai: {
      autoUse: true,
      priority: 3,
      energyCost: 40,
    },
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
  hotbarSkillIds: [
    'skill-raikiri',
    'kakashi-dragon-water-rage',
    'kakashi-pose-geral',
    null,
  ],
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
  frameWidth: 102,
  frameHeight: 102,
  frameCount: 6,
  contentHeight: 103,
};

const NARUTO_KYUBI_IDLE: SpriteSheetDef = {
  key: 'naruto-kyubi-idle',
  url: '/sprites/player/naruto-kyubi/idle.png',
  frameWidth: 115,
  frameHeight: 107,
  frameCount: 6,
  contentHeight: 103,
};

const NARUTO_KYUBI_COMBO_1: SpriteSheetDef = {
  key: 'naruto-kyubi-combo1',
  url: '/sprites/player/naruto-kyubi/combo1.png',
  frameWidth: 148,
  frameHeight: 113,
  frameCount: 4,
  contentHeight: 103,
};

const NARUTO_KYUBI_COMBO_2: SpriteSheetDef = {
  key: 'naruto-kyubi-combo2',
  url: '/sprites/player/naruto-kyubi/combo2.png',
  frameWidth: 148,
  frameHeight: 113,
  frameCount: 4,
  contentHeight: 103,
};

const NARUTO_KYUBI_COMBO_3: SpriteSheetDef = {
  key: 'naruto-kyubi-combo3',
  url: '/sprites/player/naruto-kyubi/combo3.png',
  frameWidth: 148,
  frameHeight: 113,
  frameCount: 5,
  contentHeight: 103,
};

const NARUTO_KYUBI_ATTACK_CHAIN = [
  NARUTO_KYUBI_COMBO_1,
  NARUTO_KYUBI_COMBO_2,
  NARUTO_KYUBI_COMBO_3,
] as const;

const NARUTO_KYUBI_HURT: CharacterReactionAnimDef = {
  key: 'naruto-kyubi-hurt',
  url: '/sprites/player/naruto-kyubi/hurt.png',
  frameWidth: 124,
  frameHeight: 107,
  frameCount: 2,
  contentHeight: 103,
  frameRate: 10,
};

const NARUTO_KYUBI_DEATH: CharacterReactionAnimDef = {
  key: 'naruto-kyubi-death',
  url: '/sprites/player/naruto-kyubi/death.png',
  frameWidth: 124,
  frameHeight: 107,
  frameCount: 5,
  contentHeight: 103,
  frameRate: 8,
};

const NARUTO_KYUBI_JUTSU_ANIMS: Record<string, CharacterSkillAnimDef> = {
  'skill-kurama-mode': {
    key: 'naruto-kyuubi',
    url: '/sprites/player/naruto-kyubi/kyuubi.png',
    frameWidth: 136,
    frameHeight: 136,
    frameCount: 37,
    contentHeight: 40,
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
  frameWidth: 67,
  frameHeight: 140,
  frameCount: 4,
  contentHeight: 136,
};

const UCHIHA_ITACHI_WALK: SpriteSheetDef = {
  key: 'itachi-walk',
  url: '/sprites/player/itachi/walk.png',
  // npm run itachi:walk — 6f side walk; uniform global scale (max contentH → 48)
  frameWidth: 67,
  frameHeight: 140,
  frameCount: 6,
  contentHeight: 136,
};

const UCHIHA_ITACHI_COMBO_1: SpriteSheetDef = {
  key: 'itachi-combo1',
  url: '/sprites/player/itachi/combo1.png',
  // npm run itachi:combo — hit 1; scale matched to walk
  frameWidth: 146,
  frameHeight: 139,
  frameCount: 5,
  contentHeight: 136,
};

const UCHIHA_ITACHI_COMBO_2: SpriteSheetDef = {
  key: 'itachi-combo2',
  url: '/sprites/player/itachi/combo2.png',
  // hit 2
  frameWidth: 146,
  frameHeight: 139,
  frameCount: 5,
  contentHeight: 136,
};

const UCHIHA_ITACHI_COMBO_3: SpriteSheetDef = {
  key: 'itachi-combo3',
  url: '/sprites/player/itachi/combo3.png',
  // finisher
  frameWidth: 146,
  frameHeight: 139,
  frameCount: 3,
  contentHeight: 136,
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
  frameWidth: 167,
  frameHeight: 144,
  frameCount: 2,
  contentHeight: 136,
  frameRate: 9,
};

/** npm run itachi:damage — frames 3–5 death, hold last. */
const UCHIHA_ITACHI_DEATH: CharacterReactionAnimDef = {
  key: 'itachi-death',
  url: '/sprites/player/itachi/death.png',
  frameWidth: 167,
  frameHeight: 144,
  frameCount: 3,
  contentHeight: 136,
  frameRate: 8,
};

/**
 * Amaterasu — 12f body cast + separate Sharingan/black-flame FX on target.
 * npm run itachi:jutsu + itachi:amaterasu-fx
 * FX spawns at hitDelay−80 (combat-system playPackFx on target).
 */
const UCHIHA_ITACHI_JUTSU_ANIMS: Record<string, CharacterSkillAnimDef> = {
  'skill-amaterasu': {
    key: 'itachi-amaterasu',
    url: '/sprites/player/itachi/amaterasu.png',
    frameWidth: 66,
    frameHeight: 140,
    frameCount: 12,
    contentHeight: 136,
    frameRate: 12,
    durationMs: 1000,
    hitDelayMs: 917,
    fx: {
      key: 'itachi-amaterasu-fx',
      url: '/sprites/player/itachi/amaterasu-fx.png',
      // npm run itachi:amaterasu-fx — 9f Sharingan + black flames; HQ ~1.17× idle
      frameWidth: 169,
      frameHeight: 159,
      frameCount: 9,
      contentHeight: 159,
    },
  },
  'skill-itachi-tsukuyomi': {
    key: 'itachi-amaterasu',
    url: '/sprites/player/itachi/amaterasu.png',
    frameWidth: 66,
    frameHeight: 140,
    frameCount: 12,
    contentHeight: 136,
    frameRate: 12,
    durationMs: 1000,
    hitDelayMs: 917,
    fxReleaseMs: 500,
    fxScale: 1.75,
    fx: {
      key: 'itachi-tsukuyomi-fx',
      url: '/sprites/wonsr/effects/274.png',
      frameWidth: 192,
      frameHeight: 192,
      frameCount: 6,
      contentHeight: 174,
    },
    offsetX: 0,
    offsetY: 0,
    cast: {
      scaleX: 1,
      scaleY: 1,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
    },
    castDelayMs: 0,
    vfxId: 'amaterasu',
    targeting: {
      mode: 'instant-target',
      travelSpeed: 600,
      spawnOffsetX: 0,
      spawnOffsetY: 0,
      targetOffsetX: 0,
      targetOffsetY: 0,
    },
        execution: {
      type: 'persistent',
      duration: 1000,
      tickInterval: 1000,
      persistentAnchor: 'target',
    },
    element: 'yin',
        ai: {
      autoUse: true,
      priority: 3,
    },
    vfxOffsetX: 0,
    vfxOffsetY: 0,
  },
  'skill-itachi-hosenka': {
    key: 'itachi-amaterasu',
    url: '/sprites/player/itachi/amaterasu.png',
    frameWidth: 66,
    frameHeight: 140,
    frameCount: 12,
    contentHeight: 136,
    frameRate: 12,
    durationMs: 1000,
    hitDelayMs: 917,
    fxReleaseMs: 350,
    fx: {
      key: 'itachi-hosenka-fx',
      url: '/sprites/wonsr/effects/896.png',
      frameWidth: 128,
      frameHeight: 224,
      frameCount: 10,
      contentHeight: 224,
    },
  },
  'skill-itachi-susano-kogeki': {
    key: 'itachi-amaterasu',
    url: '/sprites/player/itachi/amaterasu.png',
    frameWidth: 66,
    frameHeight: 140,
    frameCount: 12,
    contentHeight: 136,
    frameRate: 12,
    durationMs: 1000,
    hitDelayMs: 917,
    fxReleaseMs: 600,
    fxScale: 3.7,
    fx: {
      key: 'itachi-susano-kogeki-fx',
      url: '/sprites/wonsr/effects/335.png',
      frameWidth: 32,
      frameHeight: 32,
      frameCount: 4,
      contentHeight: 32,
    },
    vfxId: 'kamui',
    vfxOffsetY: -115,
    castDelayMs: 0,
    targeting: {
      mode: 'caster',
      travelSpeed: 600,
      spawnOffsetX: 0,
      spawnOffsetY: 0,
      targetOffsetX: 0,
      targetOffsetY: 0,
    },
        execution: {
      type: 'persistent',
      duration: 1500,
      tickInterval: 1000,
      persistentAnchor: 'target',
    },
    vfxOffsetX: 0,
    offsetX: 0,
    offsetY: 0,
    cast: {
      scaleX: 1,
      scaleY: 1,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
    },
        statusEffects: [
      {
        statusId: 'attack-down',
        chance: 1,
        target: 'target',
        application: 'on-end',
        applyMode: 'once-per-skill',
      },
    ],
    element: 'yin',
        ai: {
      autoUse: true,
      priority: 4,
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
  hotbarSkillIds: [
    null,
    'skill-itachi-susano-kogeki',
    'skill-itachi-tsukuyomi',
    'skill-itachi-hosenka',
  ],
};

/**
 * Uchiha Shisui — idle/walk/combo/hurt/death (sem jutsu ainda).
 * npm run shisui:import → shisui:all
 * Sources: Downloads/SPRITES JOGO/SHISUI or assets/naruto-source/nu/shisui/
 * lookType 9030 — identidade client-only (catálogo de caças curado).
 */
export const SHISUI_CURATED_LOOK_TYPE = 9030;
/** Identidade curada (sem monstro/outfit WONSR). */
export const SHISUI_LOOK_TYPES = [SHISUI_CURATED_LOOK_TYPE] as const;

const SHISUI_IDLE: SpriteSheetDef = {
  key: 'shisui-idle',
  url: '/sprites/player/shisui/idle.png',
  // npm run shisui:all — 6f breath
  frameWidth: 53,
  frameHeight: 114,
  frameCount: 6,
  contentHeight: 110,
};

const SHISUI_WALK: SpriteSheetDef = {
  key: 'shisui-walk',
  url: '/sprites/player/shisui/walk.png',
  // npm run shisui:all — 8f side walk (walk.zip correction)
  frameWidth: 59,
  frameHeight: 109,
  frameCount: 8,
  contentHeight: 110,
};

const SHISUI_COMBO_1: SpriteSheetDef = {
  key: 'shisui-combo1',
  url: '/sprites/player/shisui/combo1.png',
  frameWidth: 123,
  frameHeight: 120,
  frameCount: 6,
  contentHeight: 110,
};

const SHISUI_COMBO_2: SpriteSheetDef = {
  key: 'shisui-combo2',
  url: '/sprites/player/shisui/combo2.png',
  frameWidth: 123,
  frameHeight: 120,
  frameCount: 5,
  contentHeight: 110,
};

const SHISUI_COMBO_3: SpriteSheetDef = {
  key: 'shisui-combo3',
  url: '/sprites/player/shisui/combo3.png',
  frameWidth: 123,
  frameHeight: 120,
  frameCount: 6,
  contentHeight: 110,
};

const SHISUI_ATTACK_CHAIN = [SHISUI_COMBO_1, SHISUI_COMBO_2, SHISUI_COMBO_3] as const;

const SHISUI_HURT: CharacterReactionAnimDef = {
  key: 'shisui-hurt',
  url: '/sprites/player/shisui/hurt.png',
  frameWidth: 101,
  frameHeight: 114,
  frameCount: 6,
  contentHeight: 110,
  frameRate: 10,
};

const SHISUI_DEATH: CharacterReactionAnimDef = {
  key: 'shisui-death',
  url: '/sprites/player/shisui/death.png',
  frameWidth: 101,
  frameHeight: 114,
  frameCount: 6,
  contentHeight: 110,
  frameRate: 8,
};

const SHISUI_PACK: CharacterPack = {
  id: 'shisui',
  walk: SHISUI_WALK,
  idle: SHISUI_IDLE,
  attack: SHISUI_COMBO_1,
  attackChain: SHISUI_ATTACK_CHAIN,
  hurt: SHISUI_HURT,
  death: SHISUI_DEATH,
  skillAnims: {},
  hotbarSkillIds: [],
};

/**
 * Naruto Shippuden — pack lateral completo (idle/walk/combo/hurt/death/rasengan).
 * npm run naruto-shippuden:import → naruto-shippuden:all → naruto-shippuden:qa
 * Sources: Downloads/SPRITES JOGO/NARUTO SHIPUDEN or assets/naruto-source/nu/naruto-shippuden/
 * lookType 9031 — identidade client-only (catálogo de caças curado).
 */
export const NARUTO_SHIPPUDEN_CURATED_LOOK_TYPE = 9031;
export const NARUTO_SHIPPUDEN_LOOK_TYPES = [NARUTO_SHIPPUDEN_CURATED_LOOK_TYPE] as const;

const NARUTO_SHIPPUDEN_IDLE: SpriteSheetDef = {
  key: 'naruto-shippuden-idle',
  url: '/sprites/player/naruto-shippuden/idle.png',
  // npm run naruto-shippuden:all — 6f breath; feet-lock
  frameWidth: 83,
  frameHeight: 108,
  frameCount: 6,
  contentHeight: 104,
};

const NARUTO_SHIPPUDEN_WALK: SpriteSheetDef = {
  key: 'naruto-shippuden-walk',
  url: '/sprites/player/naruto-shippuden/walk.png',
  // npm run naruto-shippuden:all — 6f side walk; feet mass lock
  frameWidth: 91,
  frameHeight: 112,
  frameCount: 6,
  contentHeight: 104,
};

const NARUTO_SHIPPUDEN_COMBO_1: SpriteSheetDef = {
  key: 'naruto-shippuden-combo1',
  url: '/sprites/player/naruto-shippuden/combo1.png',
  frameWidth: 115,
  frameHeight: 108,
  frameCount: 4,
  contentHeight: 104,
};

const NARUTO_SHIPPUDEN_COMBO_2: SpriteSheetDef = {
  key: 'naruto-shippuden-combo2',
  url: '/sprites/player/naruto-shippuden/combo2.png',
  frameWidth: 115,
  frameHeight: 108,
  frameCount: 4,
  contentHeight: 104,
};

const NARUTO_SHIPPUDEN_COMBO_3: SpriteSheetDef = {
  key: 'naruto-shippuden-combo3',
  url: '/sprites/player/naruto-shippuden/combo3.png',
  frameWidth: 115,
  frameHeight: 108,
  frameCount: 4,
  contentHeight: 104,
};

const NARUTO_SHIPPUDEN_ATTACK_CHAIN = [
  NARUTO_SHIPPUDEN_COMBO_1,
  NARUTO_SHIPPUDEN_COMBO_2,
  NARUTO_SHIPPUDEN_COMBO_3,
] as const;

const NARUTO_SHIPPUDEN_HURT: CharacterReactionAnimDef = {
  key: 'naruto-shippuden-hurt',
  url: '/sprites/player/naruto-shippuden/hurt.png',
  frameWidth: 136,
  frameHeight: 102,
  frameCount: 2,
  contentHeight: 104,
  frameRate: 10,
};

const NARUTO_SHIPPUDEN_DEATH: CharacterReactionAnimDef = {
  key: 'naruto-shippuden-death',
  url: '/sprites/player/naruto-shippuden/death.png',
  frameWidth: 136,
  frameHeight: 102,
  frameCount: 3,
  contentHeight: 104,
  frameRate: 8,
};

const NARUTO_SHIPPUDEN_JUTSU_ANIMS: Record<string, CharacterSkillAnimDef> = {
  'skill-oodama-rasengan': {
    key: 'naruto-shippuden-rasengan',
    url: '/sprites/player/naruto-shippuden/rasengan-shippuden.png',
    // npm run naruto-shippuden:all - 38f loose JUTSU (lead-in + trailing dups trimmed); walk-scale body
    frameWidth: 319,
    frameHeight: 192,
    frameCount: 38,
    contentHeight: 104,
    frameRate: 12,
    durationMs: 3167,
    hitDelayMs: 3000,
  },
};

const NARUTO_SHIPPUDEN_PACK: CharacterPack = {
  id: 'naruto-shippuden',
  walk: NARUTO_SHIPPUDEN_WALK,
  idle: NARUTO_SHIPPUDEN_IDLE,
  attack: NARUTO_SHIPPUDEN_COMBO_1,
  attackChain: NARUTO_SHIPPUDEN_ATTACK_CHAIN,
  hurt: NARUTO_SHIPPUDEN_HURT,
  death: NARUTO_SHIPPUDEN_DEATH,
  skillAnims: NARUTO_SHIPPUDEN_JUTSU_ANIMS,
  hotbarSkillIds: ['skill-oodama-rasengan'],
};

/**
 * Son Goku — pack lateral completo (idle/fly/combo/hurt/death/kamehameha).
 * Locomoção: voa (sheet `walk` = dash/voo horizontal; idle = hover no ar).
 * npm run goku:import → goku:all
 * Sources: Downloads/SPRITES JOGO/GOKU or assets/dragon-ball-source/nu/goku/
 * lookType 9032 — identidade client-only (catálogo de caças curado).
 */
export const GOKU_CURATED_LOOK_TYPE = 9032;
export const GOKU_LOOK_TYPES = [GOKU_CURATED_LOOK_TYPE] as const;

const GOKU_IDLE: SpriteSheetDef = {
  key: 'goku-idle',
  url: '/sprites/player/goku/idle.png',
  // npm run goku:all — 4f hover breath; scaleRef idle
  frameWidth: 76,
  frameHeight: 129,
  frameCount: 4,
  contentHeight: 125,
};

const GOKU_WALK: SpriteSheetDef = {
  key: 'goku-walk',
  url: '/sprites/player/goku/walk.png',
  // npm run goku:all — 4f flight/dash; same density as idle
  frameWidth: 213,
  frameHeight: 129,
  frameCount: 4,
  contentHeight: 125,
};

const GOKU_COMBO_1: SpriteSheetDef = {
  key: 'goku-combo1',
  url: '/sprites/player/goku/combo1.png',
  frameWidth: 147,
  frameHeight: 129,
  frameCount: 11,
  contentHeight: 125,
};

const GOKU_COMBO_2: SpriteSheetDef = {
  key: 'goku-combo2',
  url: '/sprites/player/goku/combo2.png',
  frameWidth: 147,
  frameHeight: 129,
  frameCount: 11,
  contentHeight: 125,
};

const GOKU_COMBO_3: SpriteSheetDef = {
  key: 'goku-combo3',
  url: '/sprites/player/goku/combo3.png',
  frameWidth: 147,
  frameHeight: 129,
  frameCount: 10,
  contentHeight: 125,
};

const GOKU_ATTACK_CHAIN = [GOKU_COMBO_1, GOKU_COMBO_2, GOKU_COMBO_3] as const;

const GOKU_HURT: CharacterReactionAnimDef = {
  key: 'goku-hurt',
  url: '/sprites/player/goku/hurt.png',
  frameWidth: 205,
  frameHeight: 129,
  frameCount: 2,
  contentHeight: 125,
  frameRate: 10,
};

const GOKU_DEATH: CharacterReactionAnimDef = {
  key: 'goku-death',
  url: '/sprites/player/goku/death.png',
  frameWidth: 205,
  frameHeight: 129,
  frameCount: 3,
  contentHeight: 125,
  frameRate: 8,
};

const GOKU_JUTSU_ANIMS: Record<string, CharacterSkillAnimDef> = {
  'skill-kamehameha': {
    key: 'goku-kamehameha',
    url: '/sprites/player/goku/kamehameha.png',
    // npm run goku:all — 18f; bodyMatch early + feet lock (originX)
    frameWidth: 366,
    frameHeight: 132,
    frameCount: 18,
    contentHeight: 125,
    originX: 0.123,
    frameRate: 12,
    durationMs: 1500,
    hitDelayMs: 1083,
  },
};

const GOKU_PACK: CharacterPack = {
  id: 'goku',
  walk: GOKU_WALK,
  idle: GOKU_IDLE,
  attack: GOKU_COMBO_1,
  attackChain: GOKU_ATTACK_CHAIN,
  hurt: GOKU_HURT,
  death: GOKU_DEATH,
  skillAnims: GOKU_JUTSU_ANIMS,
  hotbarSkillIds: ['skill-kamehameha'],
  locomotion: 'fly',
  flightHoverPx: 14,
  // Arte DB um pouco mais “baixa” que outfits WONSR no mesmo contentH.
  displayScale: 1.28,
};

/**
 * Freeza (Final Form) — pack lateral completo (idle/fly/combo/hurt/death/death-ball).
 * Locomoção: voa (sheet `walk` = Fly.zip). Especial: Death Ball + VFX no alvo.
 * npm run freeza:import → freeza:all → freeza:qa
 * Sources: Downloads/SPRITES JOGO/freeza or assets/dragon-ball-source/nu/freeza/
 * lookType 9033 — identidade client-only (catálogo de caças curado).
 */
export const FREEZA_CURATED_LOOK_TYPE = 9033;
export const FREEZA_LOOK_TYPES = [FREEZA_CURATED_LOOK_TYPE] as const;

const FREEZA_IDLE: SpriteSheetDef = {
  key: 'freeza-idle',
  url: '/sprites/player/freeza/idle.png',
  // npm run freeza:all — native scale=1; contentHeight = idle body
  frameWidth: 90,
  frameHeight: 133,
  frameCount: 6,
  contentHeight: 129,
};

const FREEZA_WALK: SpriteSheetDef = {
  key: 'freeza-walk',
  url: '/sprites/player/freeza/walk.png',
  // npm run freeza:all — 4f flight (Fly.zip)
  frameWidth: 126,
  frameHeight: 133,
  frameCount: 4,
  contentHeight: 129,
};

const FREEZA_COMBO_1: SpriteSheetDef = {
  key: 'freeza-combo1',
  url: '/sprites/player/freeza/combo1.png',
  frameWidth: 153,
  frameHeight: 135,
  frameCount: 8,
  contentHeight: 129,
};

const FREEZA_COMBO_2: SpriteSheetDef = {
  key: 'freeza-combo2',
  url: '/sprites/player/freeza/combo2.png',
  frameWidth: 153,
  frameHeight: 135,
  frameCount: 8,
  contentHeight: 129,
};

const FREEZA_COMBO_3: SpriteSheetDef = {
  key: 'freeza-combo3',
  url: '/sprites/player/freeza/combo3.png',
  frameWidth: 153,
  frameHeight: 135,
  frameCount: 7,
  contentHeight: 129,
};

const FREEZA_ATTACK_CHAIN = [FREEZA_COMBO_1, FREEZA_COMBO_2, FREEZA_COMBO_3] as const;

const FREEZA_HURT: CharacterReactionAnimDef = {
  key: 'freeza-hurt',
  url: '/sprites/player/freeza/hurt.png',
  frameWidth: 248,
  frameHeight: 133,
  frameCount: 2,
  contentHeight: 129,
  frameRate: 10,
};

const FREEZA_DEATH: CharacterReactionAnimDef = {
  key: 'freeza-death',
  url: '/sprites/player/freeza/death.png',
  frameWidth: 248,
  frameHeight: 133,
  frameCount: 2,
  contentHeight: 129,
  frameRate: 8,
};

const FREEZA_JUTSU_ANIMS: Record<string, CharacterSkillAnimDef> = {
  'skill-death-ball': {
    key: 'freeza-death-ball',
    url: '/sprites/player/freeza/death-ball.png',
    // npm run freeza:all — Especial Death Ball.zip 10f charge→throw→point
    frameWidth: 182,
    frameHeight: 143,
    frameCount: 10,
    contentHeight: 129,
    originX: 0.375,
    frameRate: 12,
    durationMs: 833,
    // Orb leaves ~f8 (583ms); hits target ~450ms later.
    hitDelayMs: 1033,
    fxFlightFrameCount: 3,
    fxReleaseMs: 583,
    fx: {
      key: 'freeza-death-ball-fx',
      url: '/sprites/player/freeza/death-ball-fx.png',
      // 3f orb flight + 5f impact burst (native scale=1)
      frameWidth: 72,
      frameHeight: 76,
      frameCount: 8,
      contentHeight: 76,
    },
  },
};

const FREEZA_PACK: CharacterPack = {
  id: 'freeza',
  walk: FREEZA_WALK,
  idle: FREEZA_IDLE,
  attack: FREEZA_COMBO_1,
  attackChain: FREEZA_ATTACK_CHAIN,
  hurt: FREEZA_HURT,
  death: FREEZA_DEATH,
  skillAnims: FREEZA_JUTSU_ANIMS,
  hotbarSkillIds: ['skill-death-ball'],
  locomotion: 'fly',
  flightHoverPx: 12,
  // native contentHeight 129 → world size via displayScale (peer with Piccolo/Boo)
  displayScale: 1.22,
};

/**
 * Gotenks — pack lateral (idle/fly/combo/hurt/death/especial).
 * npm run gotenks:import → gotenks:all → gotenks:qa
 * Sources: Downloads/SPRITES JOGO/Gotenks
 * lookType 9034 — identidade client-only.
 */
export const GOTENKS_CURATED_LOOK_TYPE = 9034;
export const GOTENKS_LOOK_TYPES = [GOTENKS_CURATED_LOOK_TYPE] as const;

const GOTENKS_IDLE: SpriteSheetDef = {
  key: 'gotenks-idle',
  url: '/sprites/player/gotenks/idle.png',
  frameWidth: 65,
  frameHeight: 139,
  frameCount: 4,
  contentHeight: 135,
};

const GOTENKS_WALK: SpriteSheetDef = {
  key: 'gotenks-walk',
  url: '/sprites/player/gotenks/walk.png',
  frameWidth: 206,
  frameHeight: 139,
  frameCount: 4,
  contentHeight: 135,
};

const GOTENKS_COMBO_1: SpriteSheetDef = {
  key: 'gotenks-combo1',
  url: '/sprites/player/gotenks/combo1.png',
  frameWidth: 137,
  frameHeight: 132,
  frameCount: 7,
  contentHeight: 135,
};

const GOTENKS_COMBO_2: SpriteSheetDef = {
  key: 'gotenks-combo2',
  url: '/sprites/player/gotenks/combo2.png',
  frameWidth: 137,
  frameHeight: 132,
  frameCount: 7,
  contentHeight: 135,
};

const GOTENKS_COMBO_3: SpriteSheetDef = {
  key: 'gotenks-combo3',
  url: '/sprites/player/gotenks/combo3.png',
  frameWidth: 137,
  frameHeight: 132,
  frameCount: 6,
  contentHeight: 135,
};

const GOTENKS_ATTACK_CHAIN = [GOTENKS_COMBO_1, GOTENKS_COMBO_2, GOTENKS_COMBO_3] as const;

const GOTENKS_HURT: CharacterReactionAnimDef = {
  key: 'gotenks-hurt',
  url: '/sprites/player/gotenks/hurt.png',
  frameWidth: 229,
  frameHeight: 139,
  frameCount: 2,
  contentHeight: 135,
  frameRate: 10,
};

const GOTENKS_DEATH: CharacterReactionAnimDef = {
  key: 'gotenks-death',
  url: '/sprites/player/gotenks/death.png',
  frameWidth: 229,
  frameHeight: 139,
  frameCount: 2,
  contentHeight: 135,
  frameRate: 8,
};

const GOTENKS_JUTSU_ANIMS: Record<string, CharacterSkillAnimDef> = {
  'skill-gotenks-especial': {
    key: 'gotenks-especial',
    url: '/sprites/player/gotenks/especial.png',
    // npm run gotenks:all — body f1–16 (charge/ghost/point); ghost flies via FX
    frameWidth: 156,
    frameHeight: 167,
    frameCount: 16,
    contentHeight: 135,
    originX: 0.455,
    frameRate: 10,
    durationMs: 1600,
    // Ghost leaves on f14 (~1300ms); hits target ~500ms later.
    hitDelayMs: 1800,
    fxFlightFrameCount: 2,
    fxReleaseMs: 1300,
    fx: {
      key: 'gotenks-ghost-fx',
      url: '/sprites/player/gotenks/ghost-fx.png',
      frameWidth: 242,
      frameHeight: 242,
      frameCount: 7,
      contentHeight: 242,
    },
  },
};

const GOTENKS_PACK: CharacterPack = {
  id: 'gotenks',
  walk: GOTENKS_WALK,
  idle: GOTENKS_IDLE,
  attack: GOTENKS_COMBO_1,
  attackChain: GOTENKS_ATTACK_CHAIN,
  hurt: GOTENKS_HURT,
  death: GOTENKS_DEATH,
  skillAnims: GOTENKS_JUTSU_ANIMS,
  hotbarSkillIds: ['skill-gotenks-especial'],
  locomotion: 'fly',
  flightHoverPx: 14,
  displayScale: 1.28,
};

/**
 * Majin Boo (Kid Buu) — pack lateral (idle/fly/combo/hurt/death/especial).
 * npm run majin-boo:import → majin-boo:all → majin-boo:qa
 * Sources: Downloads/SPRITES JOGO/MAJIN BOO
 * lookType 9035 — identidade client-only.
 */
export const MAJIN_BOO_CURATED_LOOK_TYPE = 9035;
export const MAJIN_BOO_LOOK_TYPES = [MAJIN_BOO_CURATED_LOOK_TYPE] as const;

const MAJIN_BOO_IDLE: SpriteSheetDef = {
  key: 'majin-boo-idle',
  url: '/sprites/player/majin-boo/idle.png',
  // npm run majin-boo:all — native scale=1; contentHeight = idle body
  frameWidth: 98,
  frameHeight: 119,
  frameCount: 4,
  contentHeight: 115,
};

const MAJIN_BOO_WALK: SpriteSheetDef = {
  key: 'majin-boo-walk',
  url: '/sprites/player/majin-boo/walk.png',
  // Fly at native pixels (no downscale)
  frameWidth: 188,
  frameHeight: 119,
  frameCount: 4,
  contentHeight: 115,
};

const MAJIN_BOO_COMBO_1: SpriteSheetDef = {
  key: 'majin-boo-combo1',
  url: '/sprites/player/majin-boo/combo1.png',
  frameWidth: 267,
  frameHeight: 119,
  frameCount: 10,
  contentHeight: 115,
};

const MAJIN_BOO_COMBO_2: SpriteSheetDef = {
  key: 'majin-boo-combo2',
  url: '/sprites/player/majin-boo/combo2.png',
  frameWidth: 267,
  frameHeight: 119,
  frameCount: 9,
  contentHeight: 115,
};

const MAJIN_BOO_COMBO_3: SpriteSheetDef = {
  key: 'majin-boo-combo3',
  url: '/sprites/player/majin-boo/combo3.png',
  frameWidth: 267,
  frameHeight: 119,
  frameCount: 9,
  contentHeight: 115,
};

const MAJIN_BOO_ATTACK_CHAIN = [MAJIN_BOO_COMBO_1, MAJIN_BOO_COMBO_2, MAJIN_BOO_COMBO_3] as const;

const MAJIN_BOO_HURT: CharacterReactionAnimDef = {
  key: 'majin-boo-hurt',
  url: '/sprites/player/majin-boo/hurt.png',
  frameWidth: 180,
  frameHeight: 124,
  frameCount: 2,
  contentHeight: 115,
  frameRate: 10,
};

const MAJIN_BOO_DEATH: CharacterReactionAnimDef = {
  key: 'majin-boo-death',
  url: '/sprites/player/majin-boo/death.png',
  frameWidth: 180,
  frameHeight: 124,
  frameCount: 2,
  contentHeight: 115,
  frameRate: 8,
};

const MAJIN_BOO_JUTSU_ANIMS: Record<string, CharacterSkillAnimDef> = {
  'skill-majin-boo-especial': {
    key: 'majin-boo-especial',
    url: '/sprites/player/majin-boo/especial.png',
    // npm run majin-boo:all — 3f wind-up + 6f charge(vfx1–6) + 4f throw; flight in fx
    frameWidth: 110,
    frameHeight: 165,
    frameCount: 13,
    contentHeight: 115,
    originX: 0.336,
    frameRate: 10,
    durationMs: 1300,
    // Throw ~f10 (900ms); orb hits ~450ms later.
    hitDelayMs: 1350,
    fxFlightFrameCount: 3,
    fxReleaseMs: 900,
    fx: {
      key: 'majin-boo-especial-fx',
      url: '/sprites/player/majin-boo/especial-fx.png',
      // 3f orb flight (vfx f7/9/11) + 2f impact (f12–f13); native scale=1
      frameWidth: 95,
      frameHeight: 99,
      frameCount: 5,
      contentHeight: 99,
    },
  },
};

const MAJIN_BOO_PACK: CharacterPack = {
  id: 'majin-boo',
  walk: MAJIN_BOO_WALK,
  idle: MAJIN_BOO_IDLE,
  attack: MAJIN_BOO_COMBO_1,
  attackChain: MAJIN_BOO_ATTACK_CHAIN,
  hurt: MAJIN_BOO_HURT,
  death: MAJIN_BOO_DEATH,
  skillAnims: MAJIN_BOO_JUTSU_ANIMS,
  hotbarSkillIds: ['skill-majin-boo-especial'],
  locomotion: 'fly',
  flightHoverPx: 14,
  // native contentHeight 115 → compact Kid Boo vs Gotenks/Goku
  displayScale: 1.15,
};

/**
 * Piccolo — pack lateral (idle + fly + combo + hurt/death). Sem especial ainda.
 * npm run piccolo:import → piccolo:all → piccolo:qa
 * Namekian green preserved (no chroma punch-out). Native scale=1 (max quality).
 * lookType 9036 — identidade client-only.
 */
export const PICCOLO_CURATED_LOOK_TYPE = 9036;
export const PICCOLO_LOOK_TYPES = [PICCOLO_CURATED_LOOK_TYPE] as const;

const PICCOLO_IDLE: SpriteSheetDef = {
  key: 'piccolo-idle',
  url: '/sprites/player/piccolo/idle.png',
  // native scale=1 — max quality; contentHeight = idle body px
  frameWidth: 73,
  frameHeight: 67,
  frameCount: 4,
  contentHeight: 63,
};

const PICCOLO_WALK: SpriteSheetDef = {
  key: 'piccolo-walk',
  url: '/sprites/player/piccolo/walk.png',
  frameWidth: 96,
  frameHeight: 55,
  frameCount: 4,
  contentHeight: 63,
};

const PICCOLO_COMBO_1: SpriteSheetDef = {
  key: 'piccolo-combo1',
  url: '/sprites/player/piccolo/combo1.png',
  frameWidth: 151,
  frameHeight: 96,
  frameCount: 7,
  contentHeight: 63,
};

const PICCOLO_COMBO_2: SpriteSheetDef = {
  key: 'piccolo-combo2',
  url: '/sprites/player/piccolo/combo2.png',
  frameWidth: 151,
  frameHeight: 96,
  frameCount: 7,
  contentHeight: 63,
};

const PICCOLO_COMBO_3: SpriteSheetDef = {
  key: 'piccolo-combo3',
  url: '/sprites/player/piccolo/combo3.png',
  frameWidth: 151,
  frameHeight: 96,
  frameCount: 7,
  contentHeight: 63,
};

const PICCOLO_ATTACK_CHAIN = [PICCOLO_COMBO_1, PICCOLO_COMBO_2, PICCOLO_COMBO_3] as const;

const PICCOLO_HURT: CharacterReactionAnimDef = {
  key: 'piccolo-hurt',
  url: '/sprites/player/piccolo/hurt.png',
  frameWidth: 99,
  frameHeight: 67,
  frameCount: 1,
  contentHeight: 63,
  frameRate: 10,
};

const PICCOLO_DEATH: CharacterReactionAnimDef = {
  key: 'piccolo-death',
  url: '/sprites/player/piccolo/death.png',
  frameWidth: 99,
  frameHeight: 67,
  frameCount: 3,
  contentHeight: 63,
  frameRate: 8,
};

const PICCOLO_PACK: CharacterPack = {
  id: 'piccolo',
  walk: PICCOLO_WALK,
  idle: PICCOLO_IDLE,
  attack: PICCOLO_COMBO_1,
  attackChain: PICCOLO_ATTACK_CHAIN,
  hurt: PICCOLO_HURT,
  death: PICCOLO_DEATH,
  skillAnims: {},
  hotbarSkillIds: [],
  locomotion: 'fly',
  flightHoverPx: 14,
  // contentHeight 63 → displayScale ~1.15 ≈ ~48px world (same ballpark as peers)
  displayScale: 1.15,
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
  frameWidth: 136,
  frameHeight: 232,
  frameCount: 6,
  contentHeight: 225,
};

const JIRAIYA_WALK: SpriteSheetDef = {
  key: 'jiraiya-walk',
  url: '/sprites/player/jiraiya/walk.png',
  // npm run jiraiya:walk — 6f side walk; alpha-only; nearest max→48; feet+torso lock
  frameWidth: 133,
  frameHeight: 229,
  frameCount: 6,
  contentHeight: 225,
};

const JIRAIYA_COMBO_1: SpriteSheetDef = {
  key: 'jiraiya-combo1',
  url: '/sprites/player/jiraiya/combo1.png',
  // npm run jiraiya:combo — hit 1; HQ match idle contentH=225
  frameWidth: 247,
  frameHeight: 278,
  frameCount: 5,
  contentHeight: 225,
};

const JIRAIYA_COMBO_2: SpriteSheetDef = {
  key: 'jiraiya-combo2',
  url: '/sprites/player/jiraiya/combo2.png',
  // mid combo
  frameWidth: 247,
  frameHeight: 278,
  frameCount: 5,
  contentHeight: 225,
};

const JIRAIYA_COMBO_3: SpriteSheetDef = {
  key: 'jiraiya-combo3',
  url: '/sprites/player/jiraiya/combo3.png',
  // overhead finisher + recovery
  frameWidth: 247,
  frameHeight: 278,
  frameCount: 8,
  contentHeight: 225,
};

const JIRAIYA_ATTACK_CHAIN = [JIRAIYA_COMBO_1, JIRAIYA_COMBO_2, JIRAIYA_COMBO_3] as const;

/** npm run jiraiya:damage — frames 1–3 hit reaction. */
const JIRAIYA_HURT: CharacterReactionAnimDef = {
  key: 'jiraiya-hurt',
  url: '/sprites/player/jiraiya/hurt.png',
  frameWidth: 235,
  frameHeight: 238,
  frameCount: 3,
  contentHeight: 225,
  frameRate: 9,
};

/** npm run jiraiya:damage — frames 4–7 death, hold last. */
const JIRAIYA_DEATH: CharacterReactionAnimDef = {
  key: 'jiraiya-death',
  url: '/sprites/player/jiraiya/death.png',
  frameWidth: 235,
  frameHeight: 238,
  frameCount: 4,
  contentHeight: 225,
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
    frameWidth: 708,
    frameHeight: 324,
    frameCount: 23,
    contentHeight: 225,
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
  frameWidth: 107,
  frameHeight: 138,
  frameCount: 6,
  contentHeight: 132,
};

const JIROBO_WALK: SpriteSheetDef = {
  key: 'jirobo-walk',
  url: '/sprites/player/jirobo/walk.png',
  frameWidth: 90,
  frameHeight: 136,
  frameCount: 6,
  contentHeight: 132,
};

const JIROBO_COMBO_1: SpriteSheetDef = {
  key: 'jirobo-combo1',
  url: '/sprites/player/jirobo/combo1.png',
  frameWidth: 153,
  frameHeight: 144,
  frameCount: 6,
  contentHeight: 132,
};

const JIROBO_COMBO_2: SpriteSheetDef = {
  key: 'jirobo-combo2',
  url: '/sprites/player/jirobo/combo2.png',
  frameWidth: 153,
  frameHeight: 144,
  frameCount: 5,
  contentHeight: 132,
};

const JIROBO_COMBO_3: SpriteSheetDef = {
  key: 'jirobo-combo3',
  url: '/sprites/player/jirobo/combo3.png',
  frameWidth: 153,
  frameHeight: 144,
  frameCount: 5,
  contentHeight: 132,
};

const JIROBO_ATTACK_CHAIN = [JIROBO_COMBO_1, JIROBO_COMBO_2, JIROBO_COMBO_3] as const;

const JIROBO_HURT: CharacterReactionAnimDef = {
  key: 'jirobo-hurt',
  url: '/sprites/player/jirobo/hurt.png',
  frameWidth: 179,
  frameHeight: 142,
  frameCount: 3,
  contentHeight: 132,
  frameRate: 9,
};

const JIROBO_DEATH: CharacterReactionAnimDef = {
  key: 'jirobo-death',
  url: '/sprites/player/jirobo/death.png',
  frameWidth: 179,
  frameHeight: 142,
  frameCount: 3,
  contentHeight: 132,
  frameRate: 8,
};

const JIROBO_JUTSU_ANIMS: Record<string, CharacterSkillAnimDef> = {
  'skill-doryuheki': {
    key: 'jirobo-doryuheki',
    url: '/sprites/player/jirobo/doryuheki.png',
    frameWidth: 268,
    frameHeight: 223,
    frameCount: 11,
    contentHeight: 132,
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
      frameWidth: 132,
      frameHeight: 94,
      frameCount: 12,
      contentHeight: 94,
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
  frameWidth: 78,
  frameHeight: 128,
  frameCount: 5,
  contentHeight: 124,
};

const KABUTO_IDLE: SpriteSheetDef = {
  key: 'kabuto-idle',
  url: '/sprites/player/kabuto/idle.png',
  frameWidth: 57,
  frameHeight: 128,
  frameCount: 13,
  contentHeight: 124,
};

const KABUTO_COMBO_1: SpriteSheetDef = {
  key: 'kabuto-combo1',
  url: '/sprites/player/kabuto/combo1.png',
  frameWidth: 120,
  frameHeight: 128,
  frameCount: 4,
  contentHeight: 124,
};

const KABUTO_COMBO_2: SpriteSheetDef = {
  key: 'kabuto-combo2',
  url: '/sprites/player/kabuto/combo2.png',
  frameWidth: 120,
  frameHeight: 128,
  frameCount: 4,
  contentHeight: 124,
};

const KABUTO_COMBO_3: SpriteSheetDef = {
  key: 'kabuto-combo3',
  url: '/sprites/player/kabuto/combo3.png',
  frameWidth: 120,
  frameHeight: 128,
  frameCount: 5,
  contentHeight: 124,
};

const KABUTO_ATTACK_CHAIN = [KABUTO_COMBO_1, KABUTO_COMBO_2, KABUTO_COMBO_3] as const;

const KABUTO_HURT: CharacterReactionAnimDef = {
  key: 'kabuto-hurt',
  url: '/sprites/player/kabuto/hurt.png',
  frameWidth: 130,
  frameHeight: 128,
  frameCount: 2,
  contentHeight: 124,
  frameRate: 10,
};

const KABUTO_DEATH: CharacterReactionAnimDef = {
  key: 'kabuto-death',
  url: '/sprites/player/kabuto/death.png',
  frameWidth: 130,
  frameHeight: 128,
  frameCount: 3,
  contentHeight: 124,
  frameRate: 8,
};

const KABUTO_JUTSU_ANIMS: Record<string, CharacterSkillAnimDef> = {
  'skill-senpo-hakugeki': {
    key: 'kabuto-senpo-hakugeki',
    url: '/sprites/player/kabuto/senpo-hakugeki.png',
    frameWidth: 163,
    frameHeight: 130,
    frameCount: 54,
    contentHeight: 124,
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
  frameWidth: 64,
  frameHeight: 136,
  frameCount: 6,
  contentHeight: 136,
};

const TSUNADE_IDLE: SpriteSheetDef = {
  key: 'tsunade-idle',
  url: '/sprites/player/tsunade/idle.png',
  frameWidth: 75,
  frameHeight: 140,
  frameCount: 6,
  contentHeight: 136,
};

const TSUNADE_COMBO_1: SpriteSheetDef = {
  key: 'tsunade-combo1',
  url: '/sprites/player/tsunade/combo1.png',
  frameWidth: 121,
  frameHeight: 136,
  frameCount: 5,
  contentHeight: 136,
};

const TSUNADE_COMBO_2: SpriteSheetDef = {
  key: 'tsunade-combo2',
  url: '/sprites/player/tsunade/combo2.png',
  frameWidth: 121,
  frameHeight: 136,
  frameCount: 5,
  contentHeight: 136,
};

const TSUNADE_COMBO_3: SpriteSheetDef = {
  key: 'tsunade-combo3',
  url: '/sprites/player/tsunade/combo3.png',
  frameWidth: 121,
  frameHeight: 136,
  frameCount: 4,
  contentHeight: 136,
};

const TSUNADE_ATTACK_CHAIN = [TSUNADE_COMBO_1, TSUNADE_COMBO_2, TSUNADE_COMBO_3] as const;

const TSUNADE_HURT: CharacterReactionAnimDef = {
  key: 'tsunade-hurt',
  url: '/sprites/player/tsunade/hurt.png',
  frameWidth: 184,
  frameHeight: 140,
  frameCount: 2,
  contentHeight: 136,
  frameRate: 10,
};

const TSUNADE_DEATH: CharacterReactionAnimDef = {
  key: 'tsunade-death',
  url: '/sprites/player/tsunade/death.png',
  frameWidth: 184,
  frameHeight: 140,
  frameCount: 3,
  contentHeight: 136,
  frameRate: 8,
};

const TSUNADE_JUTSU_ANIMS: Record<string, CharacterSkillAnimDef> = {
  'skill-tsutenkyaku': {
    key: 'tsunade-tsutenkyaku',
    url: '/sprites/player/tsunade/tsutenkyaku.png',
    frameWidth: 536,
    frameHeight: 317,
    frameCount: 20,
    contentHeight: 136,
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
  frameWidth: 128,
  frameHeight: 170,
  frameCount: 6,
  contentHeight: 166,
};

const KIBA_IDLE: SpriteSheetDef = {
  key: 'kiba-idle',
  url: '/sprites/player/kiba/idle.png',
  frameWidth: 127,
  frameHeight: 170,
  frameCount: 6,
  contentHeight: 166,
};

const KIBA_COMBO_1: SpriteSheetDef = {
  key: 'kiba-combo1',
  url: '/sprites/player/kiba/combo1.png',
  frameWidth: 172,
  frameHeight: 170,
  frameCount: 4,
  contentHeight: 166,
};

const KIBA_COMBO_2: SpriteSheetDef = {
  key: 'kiba-combo2',
  url: '/sprites/player/kiba/combo2.png',
  frameWidth: 172,
  frameHeight: 170,
  frameCount: 4,
  contentHeight: 166,
};

const KIBA_COMBO_3: SpriteSheetDef = {
  key: 'kiba-combo3',
  url: '/sprites/player/kiba/combo3.png',
  frameWidth: 172,
  frameHeight: 170,
  frameCount: 5,
  contentHeight: 166,
};

const KIBA_ATTACK_CHAIN = [KIBA_COMBO_1, KIBA_COMBO_2, KIBA_COMBO_3] as const;

const KIBA_HURT: CharacterReactionAnimDef = {
  key: 'kiba-hurt',
  url: '/sprites/player/kiba/hurt.png',
  frameWidth: 223,
  frameHeight: 170,
  frameCount: 2,
  contentHeight: 166,
  frameRate: 10,
};

const KIBA_DEATH: CharacterReactionAnimDef = {
  key: 'kiba-death',
  url: '/sprites/player/kiba/death.png',
  frameWidth: 223,
  frameHeight: 170,
  frameCount: 3,
  contentHeight: 166,
  frameRate: 8,
};

const KIBA_JUTSU_ANIMS: Record<string, CharacterSkillAnimDef> = {
  'skill-gatsuuga': {
    key: 'kiba-gatsuuga',
    url: '/sprites/player/kiba/gatsuuga.png',
    frameWidth: 788,
    frameHeight: 441,
    frameCount: 32,
    contentHeight: 166,
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
  frameWidth: 51,
  frameHeight: 110,
  frameCount: 6,
  contentHeight: 106,
};

const KIMIMARO_IDLE: SpriteSheetDef = {
  key: 'kimimaro-idle',
  url: '/sprites/player/kimimaro/idle.png',
  frameWidth: 56,
  frameHeight: 110,
  frameCount: 6,
  contentHeight: 106,
};

const KIMIMARO_COMBO_1: SpriteSheetDef = {
  key: 'kimimaro-combo1',
  url: '/sprites/player/kimimaro/combo1.png',
  frameWidth: 128,
  frameHeight: 109,
  frameCount: 4,
  contentHeight: 106,
};

const KIMIMARO_COMBO_2: SpriteSheetDef = {
  key: 'kimimaro-combo2',
  url: '/sprites/player/kimimaro/combo2.png',
  frameWidth: 128,
  frameHeight: 109,
  frameCount: 4,
  contentHeight: 106,
};

const KIMIMARO_COMBO_3: SpriteSheetDef = {
  key: 'kimimaro-combo3',
  url: '/sprites/player/kimimaro/combo3.png',
  frameWidth: 128,
  frameHeight: 109,
  frameCount: 3,
  contentHeight: 106,
};

const KIMIMARO_ATTACK_CHAIN = [KIMIMARO_COMBO_1, KIMIMARO_COMBO_2, KIMIMARO_COMBO_3] as const;

const KIMIMARO_HURT: CharacterReactionAnimDef = {
  key: 'kimimaro-hurt',
  url: '/sprites/player/kimimaro/hurt.png',
  frameWidth: 177,
  frameHeight: 110,
  frameCount: 2,
  contentHeight: 106,
  frameRate: 10,
};

const KIMIMARO_DEATH: CharacterReactionAnimDef = {
  key: 'kimimaro-death',
  url: '/sprites/player/kimimaro/death.png',
  frameWidth: 177,
  frameHeight: 110,
  frameCount: 4,
  contentHeight: 106,
  frameRate: 8,
};

const KIMIMARO_JUTSU_ANIMS: Record<string, CharacterSkillAnimDef> = {
  'skill-tessenka-no-mai': {
    key: 'kimimaro-tessenka-no-mai',
    url: '/sprites/player/kimimaro/tessenka-no-mai.png',
    frameWidth: 358,
    frameHeight: 134,
    frameCount: 17,
    contentHeight: 106,
    frameRate: 12,
    durationMs: 1417,
    hitDelayMs: 917,
    // Bone impact VFX: spawn near hit so peak covers frame ~12 body contact
    fxReleaseMs: 750,
    fxAttach: 'target',
    fx: {
      key: 'kimimaro-tessenka-no-mai-fx',
      url: '/sprites/player/kimimaro/tessenka-no-mai-fx.png',
      frameWidth: 97,
      frameHeight: 128,
      frameCount: 6,
      contentHeight: 124,
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
  frameWidth: 71,
  frameHeight: 103,
  frameCount: 8,
  contentHeight: 98,
};

const SASUKE_CURSED_IDLE: SpriteSheetDef = {
  key: 'sasuke-cursed-idle',
  url: '/sprites/player/sasuke-cursed/idle.png',
  frameWidth: 73,
  frameHeight: 102,
  frameCount: 6,
  contentHeight: 98,
};

const SASUKE_CURSED_COMBO_1: SpriteSheetDef = {
  key: 'sasuke-cursed-combo1',
  url: '/sprites/player/sasuke-cursed/combo1.png',
  frameWidth: 111,
  frameHeight: 105,
  frameCount: 6,
  contentHeight: 98,
};

const SASUKE_CURSED_COMBO_2: SpriteSheetDef = {
  key: 'sasuke-cursed-combo2',
  url: '/sprites/player/sasuke-cursed/combo2.png',
  frameWidth: 111,
  frameHeight: 105,
  frameCount: 6,
  contentHeight: 98,
};

const SASUKE_CURSED_COMBO_3: SpriteSheetDef = {
  key: 'sasuke-cursed-combo3',
  url: '/sprites/player/sasuke-cursed/combo3.png',
  frameWidth: 111,
  frameHeight: 105,
  frameCount: 6,
  contentHeight: 98,
};

const SASUKE_CURSED_ATTACK_CHAIN = [
  SASUKE_CURSED_COMBO_1,
  SASUKE_CURSED_COMBO_2,
  SASUKE_CURSED_COMBO_3,
] as const;

const SASUKE_CURSED_HURT: CharacterReactionAnimDef = {
  key: 'sasuke-cursed-hurt',
  url: '/sprites/player/sasuke-cursed/hurt.png',
  frameWidth: 100,
  frameHeight: 101,
  frameCount: 2,
  contentHeight: 98,
  frameRate: 10,
};

const SASUKE_CURSED_DEATH: CharacterReactionAnimDef = {
  key: 'sasuke-cursed-death',
  url: '/sprites/player/sasuke-cursed/death.png',
  frameWidth: 100,
  frameHeight: 101,
  frameCount: 4,
  contentHeight: 98,
  frameRate: 8,
};

const SASUKE_CURSED_JUTSU_ANIMS: Record<string, CharacterSkillAnimDef> = {
  'skill-chidori-nagashi': {
    key: 'sasuke-cursed-chidori-nagashi',
    url: '/sprites/player/sasuke-cursed/chidori-nagashi.png',
    frameWidth: 223,
    frameHeight: 125,
    frameCount: 38,
    contentHeight: 98,
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
  frameWidth: 50,
  frameHeight: 112,
  frameCount: 6,
  contentHeight: 110,
};

const OROCHIMARU_IDLE: SpriteSheetDef = {
  key: 'orochimaru-idle',
  url: '/sprites/player/orochimaru/idle.png',
  frameWidth: 53,
  frameHeight: 114,
  frameCount: 4,
  contentHeight: 110,
};

const OROCHIMARU_COMBO_1: SpriteSheetDef = {
  key: 'orochimaru-combo1',
  url: '/sprites/player/orochimaru/combo1.png',
  frameWidth: 136,
  frameHeight: 112,
  frameCount: 5,
  contentHeight: 110,
};

const OROCHIMARU_COMBO_2: SpriteSheetDef = {
  key: 'orochimaru-combo2',
  url: '/sprites/player/orochimaru/combo2.png',
  frameWidth: 136,
  frameHeight: 112,
  frameCount: 5,
  contentHeight: 110,
};

const OROCHIMARU_COMBO_3: SpriteSheetDef = {
  key: 'orochimaru-combo3',
  url: '/sprites/player/orochimaru/combo3.png',
  frameWidth: 136,
  frameHeight: 112,
  frameCount: 5,
  contentHeight: 110,
};

const OROCHIMARU_ATTACK_CHAIN = [
  OROCHIMARU_COMBO_1,
  OROCHIMARU_COMBO_2,
  OROCHIMARU_COMBO_3,
] as const;

const OROCHIMARU_HURT: CharacterReactionAnimDef = {
  key: 'orochimaru-hurt',
  url: '/sprites/player/orochimaru/hurt.png',
  frameWidth: 160,
  frameHeight: 114,
  frameCount: 2,
  contentHeight: 110,
  frameRate: 10,
};

const OROCHIMARU_DEATH: CharacterReactionAnimDef = {
  key: 'orochimaru-death',
  url: '/sprites/player/orochimaru/death.png',
  frameWidth: 160,
  frameHeight: 114,
  frameCount: 4,
  contentHeight: 110,
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
  frameWidth: 59,
  frameHeight: 114,
  frameCount: 6,
  contentHeight: 110,
};

const KISAME_IDLE: SpriteSheetDef = {
  key: 'kisame-idle',
  url: '/sprites/player/kisame/idle.png',
  frameWidth: 85,
  frameHeight: 114,
  frameCount: 4,
  contentHeight: 110,
};

const KISAME_COMBO_1: SpriteSheetDef = {
  key: 'kisame-combo1',
  url: '/sprites/player/kisame/combo1.png',
  frameWidth: 163,
  frameHeight: 114,
  frameCount: 4,
  contentHeight: 110,
};

const KISAME_COMBO_2: SpriteSheetDef = {
  key: 'kisame-combo2',
  url: '/sprites/player/kisame/combo2.png',
  frameWidth: 163,
  frameHeight: 114,
  frameCount: 4,
  contentHeight: 110,
};

const KISAME_COMBO_3: SpriteSheetDef = {
  key: 'kisame-combo3',
  url: '/sprites/player/kisame/combo3.png',
  frameWidth: 163,
  frameHeight: 114,
  frameCount: 5,
  contentHeight: 110,
};

const KISAME_ATTACK_CHAIN = [KISAME_COMBO_1, KISAME_COMBO_2, KISAME_COMBO_3] as const;

const KISAME_HURT: CharacterReactionAnimDef = {
  key: 'kisame-hurt',
  url: '/sprites/player/kisame/hurt.png',
  frameWidth: 149,
  frameHeight: 113,
  frameCount: 2,
  contentHeight: 110,
  frameRate: 10,
};

const KISAME_DEATH: CharacterReactionAnimDef = {
  key: 'kisame-death',
  url: '/sprites/player/kisame/death.png',
  frameWidth: 149,
  frameHeight: 113,
  frameCount: 3,
  contentHeight: 110,
  frameRate: 8,
};

const KISAME_JUTSU_ANIMS: Record<string, CharacterSkillAnimDef> = {
  'skill-suiton-suiryudan': {
    key: 'kisame-suiryudan',
    url: '/sprites/player/kisame/suiryudan.png',
    frameWidth: 159,
    frameHeight: 256,
    frameCount: 19,
    contentHeight: 110,
    frameRate: 12,
    durationMs: 1583,
    hitDelayMs: 1000,
  },
  // Só as poses de conjuração do Suiryudan (7 primeiros frames): do 8º em diante
  // a folha já traz a água desenhada, que sairia junto com o FX novo.
  // O efeito vem das folhas em /sprites/fx/craftpix-water (ver meta.json).
  'skill-kisame-suiryu-tatsumaki': {
    key: 'kisame-cast',
    url: '/sprites/player/kisame/suiryudan.png',
    frameWidth: 159,
    frameHeight: 256,
    frameCount: 7,
    contentHeight: 110,
    frameRate: 12,
    durationMs: 583,
    hitDelayMs: 540,
    fxReleaseMs: 300,
    fxAttach: 'target',
    fxGround: true,
    fxBlend: 'add',
    fxScale: 2.8,
    fx: {
      key: 'fx-water-hurricane',
      url: '/sprites/fx/craftpix-water/water-hurricane.png',
      frameWidth: 154,
      frameHeight: 90,
      frameCount: 13,
      contentHeight: 86,
      frameRate: 14,
    },
  },
  'skill-kisame-mizu-kanketsusen': {
    key: 'kisame-cast',
    url: '/sprites/player/kisame/suiryudan.png',
    frameWidth: 159,
    frameHeight: 256,
    frameCount: 7,
    contentHeight: 110,
    frameRate: 12,
    durationMs: 583,
    hitDelayMs: 540,
    fxReleaseMs: 340,
    fxAttach: 'target',
    fxGround: true,
    fxBlend: 'add',
    fxScale: 0.75,
    fx: {
      key: 'fx-water-geyser',
      url: '/sprites/fx/craftpix-water/geyser.png',
      frameWidth: 72,
      frameHeight: 93,
      frameCount: 7,
      contentHeight: 89,
      frameRate: 10,
    },
    vfxId: 'suir-no-jutsu',
    vfxOffsetY: -50,
  },
  'kisame-suiton-lance': {
    key: 'kisame-cast',
    url: '/sprites/player/kisame/suiryudan.png',
    frameWidth: 159,
    frameHeight: 256,
    frameCount: 7,
    contentHeight: 110,
    frameRate: 24,
    offsetX: 0,
    offsetY: 0,
    durationMs: 292,
    hitDelayMs: 1000,
    vfxId: 'suiton-lance',
    fxScale: 1,
    vfxOffsetX: 0,
    vfxOffsetY: 0,
    castDelayMs: 400,
    targeting: {
      mode: 'travel-to-target',
      travelSpeed: 2000,
      spawnOffsetX: 0,
      spawnOffsetY: 0,
      targetOffsetX: 0,
      targetOffsetY: 0,
    },
    cast: {
      scaleX: 1,
      scaleY: 1,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
    },
  },
  'kisame-suiton-lance-water': {
    key: 'kisame-cast',
    url: '/sprites/player/kisame/suiryudan.png',
    frameWidth: 159,
    frameHeight: 256,
    frameCount: 7,
    contentHeight: 110,
    frameRate: 24,
    offsetX: 0,
    offsetY: 0,
    durationMs: 292,
    hitDelayMs: 1000,
    vfxId: 'suiton-lance',
    fxScale: 1,
    vfxOffsetX: 0,
    vfxOffsetY: 0,
    castDelayMs: 400,
    targeting: {
      mode: 'travel-to-target',
      travelSpeed: 2000,
      spawnOffsetX: 0,
      spawnOffsetY: 0,
      targetOffsetX: 0,
      targetOffsetY: 0,
    },
    cast: {
      scaleX: 1,
      scaleY: 1,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
    },
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
  spriteAlignment: { hub: { x: 0, y: 0 }, hunt: { x: 0, y: 0 } },
  skillAnims: KISAME_JUTSU_ANIMS,
  hotbarSkillIds: [
    'skill-suiton-suiryudan',
    'skill-kisame-suiryu-tatsumaki',
    'skill-kisame-mizu-kanketsusen',
    'kisame-suiton-lance-water',
  ],
};

/** Deidara — lookType 9022. npm run deidara:reslice (2-row content islands; batch-6b alone re-cuts badly) */
export const DEIDARA_CURATED_LOOK_TYPE = 9022;
const DEIDARA_WALK: SpriteSheetDef = {
  key: 'deidara-walk',
  url: '/sprites/player/deidara/walk.png',
  frameWidth: 66,
  frameHeight: 125,
  frameCount: 6,
  contentHeight: 124,
};
const DEIDARA_IDLE: SpriteSheetDef = {
  key: 'deidara-idle',
  url: '/sprites/player/deidara/idle.png',
  frameWidth: 58,
  frameHeight: 128,
  frameCount: 4,
  contentHeight: 124,
};
const DEIDARA_COMBO_1: SpriteSheetDef = {
  key: 'deidara-combo1',
  url: '/sprites/player/deidara/combo1.png',
  frameWidth: 154,
  frameHeight: 128,
  frameCount: 8,
  contentHeight: 124,
};
const DEIDARA_COMBO_2: SpriteSheetDef = {
  key: 'deidara-combo2',
  url: '/sprites/player/deidara/combo2.png',
  frameWidth: 154,
  frameHeight: 128,
  frameCount: 8,
  contentHeight: 124,
};
const DEIDARA_COMBO_3: SpriteSheetDef = {
  key: 'deidara-combo3',
  url: '/sprites/player/deidara/combo3.png',
  frameWidth: 154,
  frameHeight: 128,
  frameCount: 9,
  contentHeight: 124,
};
const DEIDARA_ATTACK_CHAIN = [DEIDARA_COMBO_1, DEIDARA_COMBO_2, DEIDARA_COMBO_3] as const;
const DEIDARA_HURT: CharacterReactionAnimDef = {
  key: 'deidara-hurt',
  url: '/sprites/player/deidara/hurt.png',
  frameWidth: 193,
  frameHeight: 128,
  frameCount: 2,
  contentHeight: 124,
  frameRate: 10,
};
const DEIDARA_DEATH: CharacterReactionAnimDef = {
  key: 'deidara-death',
  url: '/sprites/player/deidara/death.png',
  frameWidth: 193,
  frameHeight: 128,
  frameCount: 3,
  contentHeight: 124,
  frameRate: 8,
};
const DEIDARA_JUTSU_ANIMS: Record<string, CharacterSkillAnimDef> = {
  'skill-c2-dragon': {
    key: 'deidara-kijutsu',
    url: '/sprites/player/deidara/kijutsu.png',
    frameWidth: 91,
    frameHeight: 128,
    frameCount: 7,
    contentHeight: 124,
    frameRate: 12,
    durationMs: 583,
    hitDelayMs: 333,
  },
};
const DEIDARA_PACK: CharacterPack = {
  id: 'deidara',
  walk: DEIDARA_WALK,
  idle: DEIDARA_IDLE,
  attack: DEIDARA_COMBO_1,
  attackChain: DEIDARA_ATTACK_CHAIN,
  hurt: DEIDARA_HURT,
  death: DEIDARA_DEATH,
  skillAnims: DEIDARA_JUTSU_ANIMS,
  hotbarSkillIds: ['skill-c2-dragon'],
};

/** Sakura Shippuden — lookType 9023. */
export const SAKURA_SHIPPUDEN_CURATED_LOOK_TYPE = 9023;
const SAKURA_SHIP_WALK: SpriteSheetDef = {
  key: 'sakura-shippuden-walk',
  url: '/sprites/player/sakura-shippuden/walk.png',
  frameWidth: 66,
  frameHeight: 99,
  frameCount: 6,
  contentHeight: 91,
  offsetY: 5,
};
const SAKURA_SHIP_IDLE: SpriteSheetDef = {
  key: 'sakura-shippuden-idle',
  url: '/sprites/player/sakura-shippuden/idle.png',
  frameWidth: 60,
  frameHeight: 95,
  frameCount: 5,
  contentHeight: 91,
  offsetY: 5,
};
const SAKURA_SHIP_COMBO_1: SpriteSheetDef = {
  key: 'sakura-shippuden-combo1',
  url: '/sprites/player/sakura-shippuden/combo1.png',
  frameWidth: 98,
  frameHeight: 95,
  frameCount: 4,
  contentHeight: 91,
};
const SAKURA_SHIP_COMBO_2: SpriteSheetDef = {
  key: 'sakura-shippuden-combo2',
  url: '/sprites/player/sakura-shippuden/combo2.png',
  frameWidth: 98,
  frameHeight: 95,
  frameCount: 4,
  contentHeight: 91,
};
const SAKURA_SHIP_COMBO_3: SpriteSheetDef = {
  key: 'sakura-shippuden-combo3',
  url: '/sprites/player/sakura-shippuden/combo3.png',
  frameWidth: 98,
  frameHeight: 95,
  frameCount: 5,
  contentHeight: 91,
};
const SAKURA_SHIP_ATTACK_CHAIN = [
  SAKURA_SHIP_COMBO_1,
  SAKURA_SHIP_COMBO_2,
  SAKURA_SHIP_COMBO_3,
] as const;
const SAKURA_SHIP_HURT: CharacterReactionAnimDef = {
  key: 'sakura-shippuden-hurt',
  url: '/sprites/player/sakura-shippuden/hurt.png',
  frameWidth: 186,
  frameHeight: 95,
  frameCount: 2,
  contentHeight: 91,
  frameRate: 10,
};
const SAKURA_SHIP_DEATH: CharacterReactionAnimDef = {
  key: 'sakura-shippuden-death',
  url: '/sprites/player/sakura-shippuden/death.png',
  frameWidth: 186,
  frameHeight: 95,
  frameCount: 3,
  contentHeight: 91,
  frameRate: 8,
};
const SAKURA_SHIP_JUTSU_ANIMS: Record<string, CharacterSkillAnimDef> = {
  'skill-chou-tsubo': {
    key: 'sakura-shippuden-chou-tsubo',
    url: '/sprites/player/sakura-shippuden/chou-tsubo.png',
    frameWidth: 98,
    frameHeight: 170,
    frameCount: 22,
    contentHeight: 91,
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
      frameWidth: 396,
      frameHeight: 112,
      frameCount: 13,
      contentHeight: 106,
    },
  },
};
const SAKURA_SHIPPUDEN_PACK: CharacterPack = {
  id: 'sakura-shippuden',
  walk: SAKURA_SHIP_WALK,
  idle: SAKURA_SHIP_IDLE,
  attack: SAKURA_SHIP_COMBO_1,
  attackChain: SAKURA_SHIP_ATTACK_CHAIN,
  hurt: SAKURA_SHIP_HURT,
  death: SAKURA_SHIP_DEATH,
  skillAnims: SAKURA_SHIP_JUTSU_ANIMS,
  hotbarSkillIds: [
    'skill-chou-tsubo',
    'skill-sakura-saikan-chuushutsu',
    'skill-sakura-chiyute',
    'skill-sakura-shousen',
  ],
};

/** Tenten — lookType 9024. */
export const TENTEN_CURATED_LOOK_TYPE = 9024;
const TENTEN_WALK: SpriteSheetDef = {
  key: 'tenten-walk',
  url: '/sprites/player/tenten/walk.png',
  frameWidth: 50,
  frameHeight: 89,
  frameCount: 6,
  contentHeight: 80,
};
const TENTEN_IDLE: SpriteSheetDef = {
  key: 'tenten-idle',
  url: '/sprites/player/tenten/idle.png',
  frameWidth: 61,
  frameHeight: 84,
  frameCount: 6,
  contentHeight: 80,
};
const TENTEN_COMBO_1: SpriteSheetDef = {
  key: 'tenten-combo1',
  url: '/sprites/player/tenten/combo1.png',
  frameWidth: 78,
  frameHeight: 84,
  frameCount: 5,
  contentHeight: 80,
};
const TENTEN_COMBO_2: SpriteSheetDef = {
  key: 'tenten-combo2',
  url: '/sprites/player/tenten/combo2.png',
  frameWidth: 78,
  frameHeight: 84,
  frameCount: 5,
  contentHeight: 80,
};
const TENTEN_COMBO_3: SpriteSheetDef = {
  key: 'tenten-combo3',
  url: '/sprites/player/tenten/combo3.png',
  frameWidth: 78,
  frameHeight: 84,
  frameCount: 6,
  contentHeight: 80,
};
const TENTEN_ATTACK_CHAIN = [TENTEN_COMBO_1, TENTEN_COMBO_2, TENTEN_COMBO_3] as const;
const TENTEN_HURT: CharacterReactionAnimDef = {
  key: 'tenten-hurt',
  url: '/sprites/player/tenten/hurt.png',
  frameWidth: 116,
  frameHeight: 82,
  frameCount: 2,
  contentHeight: 80,
  frameRate: 10,
};
const TENTEN_DEATH: CharacterReactionAnimDef = {
  key: 'tenten-death',
  url: '/sprites/player/tenten/death.png',
  frameWidth: 116,
  frameHeight: 82,
  frameCount: 4,
  contentHeight: 80,
  frameRate: 8,
};
const TENTEN_JUTSU_ANIMS: Record<string, CharacterSkillAnimDef> = {
  'skill-soushuriken': {
    key: 'tenten-soushuriken',
    url: '/sprites/player/tenten/soushuriken.png',
    frameWidth: 223,
    frameHeight: 290,
    frameCount: 31,
    contentHeight: 80,
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
      frameWidth: 59,
      frameHeight: 71,
      frameCount: 21,
      contentHeight: 67,
    },
  },
};
const TENTEN_PACK: CharacterPack = {
  id: 'tenten',
  walk: TENTEN_WALK,
  idle: TENTEN_IDLE,
  attack: TENTEN_COMBO_1,
  attackChain: TENTEN_ATTACK_CHAIN,
  hurt: TENTEN_HURT,
  death: TENTEN_DEATH,
  skillAnims: TENTEN_JUTSU_ANIMS,
  hotbarSkillIds: ['skill-soushuriken'],
};

/** Temari — lookType 9025. */
export const TEMARI_CURATED_LOOK_TYPE = 9025;
const TEMARI_WALK: SpriteSheetDef = {
  key: 'temari-walk',
  url: '/sprites/player/temari/walk.png',
  frameWidth: 74,
  frameHeight: 92,
  frameCount: 8,
  contentHeight: 95,
};
const TEMARI_IDLE: SpriteSheetDef = {
  key: 'temari-idle',
  url: '/sprites/player/temari/idle.png',
  frameWidth: 85,
  frameHeight: 99,
  frameCount: 6,
  contentHeight: 95,
};
const TEMARI_COMBO_1: SpriteSheetDef = {
  key: 'temari-combo1',
  url: '/sprites/player/temari/combo1.png',
  frameWidth: 102,
  frameHeight: 106,
  frameCount: 5,
  contentHeight: 95,
};
const TEMARI_COMBO_2: SpriteSheetDef = {
  key: 'temari-combo2',
  url: '/sprites/player/temari/combo2.png',
  frameWidth: 102,
  frameHeight: 106,
  frameCount: 5,
  contentHeight: 95,
};
const TEMARI_COMBO_3: SpriteSheetDef = {
  key: 'temari-combo3',
  url: '/sprites/player/temari/combo3.png',
  frameWidth: 102,
  frameHeight: 106,
  frameCount: 6,
  contentHeight: 95,
};
const TEMARI_ATTACK_CHAIN = [TEMARI_COMBO_1, TEMARI_COMBO_2, TEMARI_COMBO_3] as const;
const TEMARI_HURT: CharacterReactionAnimDef = {
  key: 'temari-hurt',
  url: '/sprites/player/temari/hurt.png',
  frameWidth: 148,
  frameHeight: 99,
  frameCount: 2,
  contentHeight: 95,
  frameRate: 10,
};
const TEMARI_DEATH: CharacterReactionAnimDef = {
  key: 'temari-death',
  url: '/sprites/player/temari/death.png',
  frameWidth: 148,
  frameHeight: 99,
  frameCount: 3,
  contentHeight: 95,
  frameRate: 8,
};
const TEMARI_JUTSU_ANIMS: Record<string, CharacterSkillAnimDef> = {
  'skill-kamaitachi': {
    key: 'temari-kamaitachi',
    url: '/sprites/player/temari/kamaitachi.png',
    frameWidth: 182,
    frameHeight: 107,
    frameCount: 14,
    contentHeight: 95,
    frameRate: 12,
    durationMs: 1167,
    hitDelayMs: 750,
    // Wind slash on target — appear just before body hit.
    fxReleaseMs: 550,
    fxAttach: 'target',
    fx: {
      key: 'temari-kamaitachi-fx',
      url: '/sprites/player/temari/kamaitachi-fx.png',
      frameWidth: 171,
      frameHeight: 99,
      frameCount: 13,
      contentHeight: 95,
    },
  },
};
const TEMARI_PACK: CharacterPack = {
  id: 'temari',
  walk: TEMARI_WALK,
  idle: TEMARI_IDLE,
  attack: TEMARI_COMBO_1,
  attackChain: TEMARI_ATTACK_CHAIN,
  hurt: TEMARI_HURT,
  death: TEMARI_DEATH,
  skillAnims: TEMARI_JUTSU_ANIMS,
  hotbarSkillIds: ['skill-kamaitachi'],
};

/** Tayuya — lookType 9026. */
export const TAYUYA_CURATED_LOOK_TYPE = 9026;
const TAYUYA_WALK: SpriteSheetDef = {
  key: 'tayuya-walk',
  url: '/sprites/player/tayuya/walk.png',
  frameWidth: 73,
  frameHeight: 98,
  frameCount: 8,
  contentHeight: 91,
};
const TAYUYA_IDLE: SpriteSheetDef = {
  key: 'tayuya-idle',
  url: '/sprites/player/tayuya/idle.png',
  frameWidth: 75,
  frameHeight: 95,
  frameCount: 6,
  contentHeight: 91,
};
const TAYUYA_COMBO_1: SpriteSheetDef = {
  key: 'tayuya-combo1',
  url: '/sprites/player/tayuya/combo1.png',
  frameWidth: 103,
  frameHeight: 95,
  frameCount: 5,
  contentHeight: 91,
};
const TAYUYA_COMBO_2: SpriteSheetDef = {
  key: 'tayuya-combo2',
  url: '/sprites/player/tayuya/combo2.png',
  frameWidth: 103,
  frameHeight: 95,
  frameCount: 5,
  contentHeight: 91,
};
const TAYUYA_COMBO_3: SpriteSheetDef = {
  key: 'tayuya-combo3',
  url: '/sprites/player/tayuya/combo3.png',
  frameWidth: 103,
  frameHeight: 95,
  frameCount: 5,
  contentHeight: 91,
};
const TAYUYA_ATTACK_CHAIN = [TAYUYA_COMBO_1, TAYUYA_COMBO_2, TAYUYA_COMBO_3] as const;
const TAYUYA_HURT: CharacterReactionAnimDef = {
  key: 'tayuya-hurt',
  url: '/sprites/player/tayuya/hurt.png',
  frameWidth: 147,
  frameHeight: 95,
  frameCount: 2,
  contentHeight: 91,
  frameRate: 10,
};
const TAYUYA_DEATH: CharacterReactionAnimDef = {
  key: 'tayuya-death',
  url: '/sprites/player/tayuya/death.png',
  frameWidth: 147,
  frameHeight: 95,
  frameCount: 3,
  contentHeight: 91,
  frameRate: 8,
};
const TAYUYA_JUTSU_ANIMS: Record<string, CharacterSkillAnimDef> = {
  'skill-magen-mateki': {
    key: 'tayuya-magen-mateki',
    url: '/sprites/player/tayuya/magen-mateki.png',
    frameWidth: 174,
    frameHeight: 167,
    frameCount: 18,
    contentHeight: 91,
    frameRate: 12,
    durationMs: 1500,
    hitDelayMs: 917,
    // Pink note spins while flying caster → target (all 4 frames = flight loop).
    fxFlightFrameCount: 4,
    fxReleaseMs: 660,
    fx: {
      key: 'tayuya-magen-mateki-fx',
      url: '/sprites/player/tayuya/magen-mateki-fx.png',
      frameWidth: 60,
      frameHeight: 80,
      frameCount: 4,
      contentHeight: 76,
    },
  },
};
const TAYUYA_PACK: CharacterPack = {
  id: 'tayuya',
  walk: TAYUYA_WALK,
  idle: TAYUYA_IDLE,
  attack: TAYUYA_COMBO_1,
  attackChain: TAYUYA_ATTACK_CHAIN,
  hurt: TAYUYA_HURT,
  death: TAYUYA_DEATH,
  skillAnims: TAYUYA_JUTSU_ANIMS,
  hotbarSkillIds: ['skill-magen-mateki'],
};

/** Shino Aburame — lookType 9027. */
export const SHINO_CURATED_LOOK_TYPE = 9027;
const SHINO_WALK: SpriteSheetDef = {
  key: 'shino-walk',
  url: '/sprites/player/shino/walk.png',
  frameWidth: 71,
  frameHeight: 154,
  frameCount: 6,
  contentHeight: 147,
};
const SHINO_IDLE: SpriteSheetDef = {
  key: 'shino-idle',
  url: '/sprites/player/shino/idle.png',
  frameWidth: 68,
  frameHeight: 151,
  frameCount: 7,
  contentHeight: 147,
};
const SHINO_COMBO_1: SpriteSheetDef = {
  key: 'shino-combo1',
  url: '/sprites/player/shino/combo1.png',
  frameWidth: 200,
  frameHeight: 151,
  frameCount: 5,
  contentHeight: 147,
  originX: 0.36,
};
const SHINO_COMBO_2: SpriteSheetDef = {
  key: 'shino-combo2',
  url: '/sprites/player/shino/combo2.png',
  frameWidth: 200,
  frameHeight: 151,
  frameCount: 5,
  contentHeight: 147,
  originX: 0.36,
};
const SHINO_COMBO_3: SpriteSheetDef = {
  key: 'shino-combo3',
  url: '/sprites/player/shino/combo3.png',
  frameWidth: 200,
  frameHeight: 151,
  frameCount: 6,
  contentHeight: 147,
  originX: 0.36,
};
const SHINO_ATTACK_CHAIN = [SHINO_COMBO_1, SHINO_COMBO_2, SHINO_COMBO_3] as const;
const SHINO_HURT: CharacterReactionAnimDef = {
  key: 'shino-hurt',
  url: '/sprites/player/shino/hurt.png',
  frameWidth: 158,
  frameHeight: 144,
  frameCount: 2,
  contentHeight: 147,
  frameRate: 10,
};
const SHINO_DEATH: CharacterReactionAnimDef = {
  key: 'shino-death',
  url: '/sprites/player/shino/death.png',
  frameWidth: 158,
  frameHeight: 144,
  frameCount: 3,
  contentHeight: 147,
  frameRate: 8,
};
const SHINO_JUTSU_ANIMS: Record<string, CharacterSkillAnimDef> = {
  'skill-kikaichu': {
    key: 'shino-kikaichu',
    url: '/sprites/player/shino/kikaichu.png',
    frameWidth: 170,
    frameHeight: 151,
    frameCount: 13,
    contentHeight: 147,
    frameRate: 12,
    durationMs: 1083,
    hitDelayMs: 667,
    // Insect swarm: appear on target slightly before cast hit.
    fxReleaseMs: 500,
    fxAttach: 'target',
    fx: {
      key: 'shino-kikaichu-fx',
      url: '/sprites/player/shino/kikaichu-fx.png',
      frameWidth: 198,
      frameHeight: 176,
      frameCount: 18,
      contentHeight: 172,
      offsetX: 0,
      offsetY: 0,
    },
    offsetX: 0,
    offsetY: 0,
    cast: {
      scaleX: 1,
      scaleY: 1,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
    },
    fxScale: 1.5,
    castDelayMs: 0,
    targeting: {
      mode: 'instant-target',
      travelSpeed: 600,
      spawnOffsetX: 0,
      spawnOffsetY: 0,
      targetOffsetX: 0,
      targetOffsetY: 0,
    },
        execution: {
      type: 'area',
      radius: 600,
    },
    element: 'earth',
        ai: {
      autoUse: true,
      priority: 1,
      energyCost: 40,
    },
  },
};
const SHINO_PACK: CharacterPack = {
  id: 'shino',
  walk: SHINO_WALK,
  idle: SHINO_IDLE,
  attack: SHINO_COMBO_1,
  attackChain: SHINO_ATTACK_CHAIN,
  hurt: SHINO_HURT,
  death: SHINO_DEATH,
  skillAnims: SHINO_JUTSU_ANIMS,
  hotbarSkillIds: [
    'skill-kikaichu',
    null,
    null,
    null,
  ],
  displayScale: 1.615,
};

/** Momo Hinamori — lookType 9028. */
export const MOMO_HINAMORI_CURATED_LOOK_TYPE = 9028;
const MOMO_WALK: SpriteSheetDef = {
  key: 'momo-hinamori-walk',
  url: '/sprites/player/momo-hinamori/walk.png',
  frameWidth: 94,
  frameHeight: 107,
  frameCount: 5,
  contentHeight: 100,
};
const MOMO_IDLE: SpriteSheetDef = {
  key: 'momo-hinamori-idle',
  url: '/sprites/player/momo-hinamori/idle.png',
  frameWidth: 102,
  frameHeight: 104,
  frameCount: 8,
  contentHeight: 100,
};
const MOMO_COMBO_1: SpriteSheetDef = {
  key: 'momo-hinamori-combo1',
  url: '/sprites/player/momo-hinamori/combo1.png',
  frameWidth: 98,
  frameHeight: 104,
  frameCount: 4,
  contentHeight: 100,
};
const MOMO_COMBO_2: SpriteSheetDef = {
  key: 'momo-hinamori-combo2',
  url: '/sprites/player/momo-hinamori/combo2.png',
  frameWidth: 98,
  frameHeight: 104,
  frameCount: 4,
  contentHeight: 100,
};
const MOMO_COMBO_3: SpriteSheetDef = {
  key: 'momo-hinamori-combo3',
  url: '/sprites/player/momo-hinamori/combo3.png',
  frameWidth: 98,
  frameHeight: 104,
  frameCount: 3,
  contentHeight: 100,
};
const MOMO_ATTACK_CHAIN = [MOMO_COMBO_1, MOMO_COMBO_2, MOMO_COMBO_3] as const;
const MOMO_HURT: CharacterReactionAnimDef = {
  key: 'momo-hinamori-hurt',
  url: '/sprites/player/momo-hinamori/hurt.png',
  frameWidth: 167,
  frameHeight: 104,
  frameCount: 2,
  contentHeight: 100,
  frameRate: 10,
};
const MOMO_DEATH: CharacterReactionAnimDef = {
  key: 'momo-hinamori-death',
  url: '/sprites/player/momo-hinamori/death.png',
  frameWidth: 167,
  frameHeight: 104,
  frameCount: 5,
  contentHeight: 100,
  frameRate: 8,
};
const MOMO_JUTSU_ANIMS: Record<string, CharacterSkillAnimDef> = {
  'skill-tobiume': {
    key: 'momo-hinamori-tobiume',
    url: '/sprites/player/momo-hinamori/tobiume.png',
    frameWidth: 379,
    frameHeight: 119,
    frameCount: 12,
    contentHeight: 100,
    frameRate: 12,
    durationMs: 1000,
    hitDelayMs: 500,
  },
};
const MOMO_HINAMORI_PACK: CharacterPack = {
  id: 'momo-hinamori',
  walk: MOMO_WALK,
  idle: MOMO_IDLE,
  attack: MOMO_COMBO_1,
  attackChain: MOMO_ATTACK_CHAIN,
  hurt: MOMO_HURT,
  death: MOMO_DEATH,
  skillAnims: MOMO_JUTSU_ANIMS,
  hotbarSkillIds: ['skill-tobiume'],
};

/** Toshiro Hitsugaya — lookType 9029. */
export const HITSUGAYA_CURATED_LOOK_TYPE = 9029;
const HITSUGAYA_WALK: SpriteSheetDef = {
  key: 'hitsugaya-walk',
  url: '/sprites/player/hitsugaya/walk.png',
  frameWidth: 276,
  frameHeight: 133,
  frameCount: 6,
  contentHeight: 152,
  // Heavy blade / long stride — default 12 looks rushed.
  frameRate: 8,
};
const HITSUGAYA_IDLE: SpriteSheetDef = {
  key: 'hitsugaya-idle',
  url: '/sprites/player/hitsugaya/idle.png',
  frameWidth: 176,
  frameHeight: 156,
  frameCount: 6,
  contentHeight: 152,
  frameRate: 6,
};
const HITSUGAYA_COMBO_1: SpriteSheetDef = {
  key: 'hitsugaya-combo1',
  url: '/sprites/player/hitsugaya/combo1.png',
  frameWidth: 320,
  frameHeight: 245,
  frameCount: 5,
  contentHeight: 152,
  frameRate: 8,
};
const HITSUGAYA_COMBO_2: SpriteSheetDef = {
  key: 'hitsugaya-combo2',
  url: '/sprites/player/hitsugaya/combo2.png',
  frameWidth: 320,
  frameHeight: 245,
  frameCount: 5,
  contentHeight: 152,
  frameRate: 8,
};
const HITSUGAYA_COMBO_3: SpriteSheetDef = {
  key: 'hitsugaya-combo3',
  url: '/sprites/player/hitsugaya/combo3.png',
  frameWidth: 320,
  frameHeight: 245,
  frameCount: 4,
  contentHeight: 152,
  frameRate: 8,
};
const HITSUGAYA_ATTACK_CHAIN = [HITSUGAYA_COMBO_1, HITSUGAYA_COMBO_2, HITSUGAYA_COMBO_3] as const;
const HITSUGAYA_HURT: CharacterReactionAnimDef = {
  key: 'hitsugaya-hurt',
  url: '/sprites/player/hitsugaya/hurt.png',
  frameWidth: 293,
  frameHeight: 173,
  frameCount: 2,
  contentHeight: 152,
  frameRate: 10,
};
const HITSUGAYA_DEATH: CharacterReactionAnimDef = {
  key: 'hitsugaya-death',
  url: '/sprites/player/hitsugaya/death.png',
  frameWidth: 293,
  frameHeight: 173,
  frameCount: 2,
  contentHeight: 152,
  frameRate: 8,
};
const HITSUGAYA_JUTSU_ANIMS: Record<string, CharacterSkillAnimDef> = {
  'skill-daiguren-hyorinmaru': {
    key: 'hitsugaya-daiguren-hyorinmaru',
    url: '/sprites/player/hitsugaya/daiguren-hyorinmaru.png',
    frameWidth: 262,
    frameHeight: 273,
    frameCount: 7,
    contentHeight: 152,
    frameRate: 10,
    durationMs: 700,
    hitDelayMs: 400,
    // Ice fan on target at slash peak.
    fxReleaseMs: 320,
    fxAttach: 'target',
    fx: {
      key: 'hitsugaya-daiguren-hyorinmaru-fx',
      url: '/sprites/player/hitsugaya/daiguren-hyorinmaru-fx.png',
      frameWidth: 112,
      frameHeight: 207,
      frameCount: 5,
      contentHeight: 203,
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

/**
 * Asta (Black Clover, Time Skip) — idle + walk + combo + 4 especiais MUGEN.
 * npm run asta:all — SFF v2 → public/sprites/player/asta/
 * lookType 9037 identidade client-only.
 */
export const ASTA_CURATED_LOOK_TYPE = 9037;

const ASTA_IDLE: SpriteSheetDef = {
  key: 'asta-idle',
  url: '/sprites/player/asta/idle.png',
  frameWidth: 62,
  frameHeight: 54,
  frameCount: 4,
  contentHeight: 50,
  frameRate: 8,
  originX: 0.355,
};

const ASTA_WALK: SpriteSheetDef = {
  key: 'asta-walk',
  url: '/sprites/player/asta/walk.png',
  frameWidth: 114,
  frameHeight: 64,
  frameCount: 7,
  contentHeight: 50,
  frameRate: 12,
  originX: 0.623,
};

const ASTA_COMBO_1: SpriteSheetDef = {
  key: 'asta-combo1',
  url: '/sprites/player/asta/combo1.png',
  frameWidth: 104,
  frameHeight: 73,
  frameCount: 3,
  contentHeight: 50,
  originX: 0.538,
};

const ASTA_COMBO_2: SpriteSheetDef = {
  key: 'asta-combo2',
  url: '/sprites/player/asta/combo2.png',
  frameWidth: 94,
  frameHeight: 55,
  frameCount: 4,
  contentHeight: 50,
  originX: 0.564,
};

const ASTA_COMBO_3: SpriteSheetDef = {
  key: 'asta-combo3',
  url: '/sprites/player/asta/combo3.png',
  frameWidth: 142,
  frameHeight: 88,
  frameCount: 4,
  contentHeight: 50,
  originX: 0.394,
};

const ASTA_ATTACK_CHAIN = [ASTA_COMBO_1, ASTA_COMBO_2, ASTA_COMBO_3] as const;

const ASTA_JUTSU_ANIMS: Record<string, CharacterSkillAnimDef> = {
  'skill-black-slash': {
    key: 'asta-black-slash',
    url: '/sprites/player/asta/black-slash.png',
    frameWidth: 138,
    frameHeight: 88,
    frameCount: 14,
    contentHeight: 50,
    originX: 0.399,
    frameRate: 15,
    durationMs: 933,
    hitDelayMs: 267,
    fxReleaseMs: 267,
    fxAttach: 'caster',
    fx: {
      key: 'asta-black-slash-fx',
      url: '/sprites/player/asta/black-slash-fx.png',
      frameWidth: 245,
      frameHeight: 236,
      frameCount: 9,
      contentHeight: 232,
    },
  },
  'skill-black-strong': {
    key: 'asta-black-strong',
    url: '/sprites/player/asta/black-strong.png',
    frameWidth: 142,
    frameHeight: 66,
    frameCount: 8,
    contentHeight: 50,
    originX: 0.394,
    frameRate: 8,
    durationMs: 950,
    hitDelayMs: 683,
    fxReleaseMs: 683,
    fxAttach: 'caster',
    fxGround: true,
    fx: {
      key: 'asta-black-strong-fx',
      url: '/sprites/player/asta/black-strong-fx.png',
      frameWidth: 279,
      frameHeight: 165,
      frameCount: 10,
      contentHeight: 161,
    },
  },
  'skill-bull-thrust': {
    key: 'asta-bull-thrust',
    url: '/sprites/player/asta/bull-thrust.png',
    frameWidth: 125,
    frameHeight: 78,
    frameCount: 15,
    contentHeight: 50,
    originX: 0.608,
    frameRate: 8,
    durationMs: 2067,
    hitDelayMs: 1350,
    fxReleaseMs: 1350,
    fxAttach: 'target',
    fxGround: true,
    fx: {
      key: 'asta-bull-thrust-fx',
      url: '/sprites/player/asta/bull-thrust-fx.png',
      frameWidth: 194,
      frameHeight: 304,
      frameCount: 10,
      contentHeight: 300,
    },
  },
  'skill-black-combo': {
    key: 'asta-black-combo',
    url: '/sprites/player/asta/black-combo.png',
    frameWidth: 139,
    frameHeight: 64,
    frameCount: 16,
    contentHeight: 50,
    originX: 0.381,
    frameRate: 21,
    durationMs: 767,
    hitDelayMs: 333,
    fxReleaseMs: 333,
    fxAttach: 'caster',
    fx: {
      key: 'asta-black-combo-fx',
      url: '/sprites/player/asta/black-combo-fx.png',
      frameWidth: 261,
      frameHeight: 132,
      frameCount: 6,
      contentHeight: 128,
    },
  },
};

const ASTA_PACK: CharacterPack = {
  id: 'asta',
  walk: ASTA_WALK,
  idle: ASTA_IDLE,
  attack: ASTA_COMBO_1,
  attackChain: ASTA_ATTACK_CHAIN,
  skillAnims: ASTA_JUTSU_ANIMS,
  hotbarSkillIds: [
    'skill-black-slash',
    'skill-black-strong',
    'skill-bull-thrust',
    'skill-black-combo',
  ],
};

/**
 * Monkey D. Luffy (One Piece) — idle + walk + combo + hurt/death + Gomu Gomu no Gatling.
 * npm run luffy:all — assets/one-piece-source/nu/luffy/
 * lookType 9038 identidade client-only.
 * HQ: idle scale=1; walk/combo/jutsu matched to idle contentHeight 77.
 */
export const LUFFY_CURATED_LOOK_TYPE = 9038;
export const LUFFY_LOOK_TYPES = [LUFFY_CURATED_LOOK_TYPE] as const;

const LUFFY_IDLE: SpriteSheetDef = {
  key: 'luffy-idle',
  url: '/sprites/player/luffy/idle.png',
  frameWidth: 44,
  frameHeight: 81,
  frameCount: 4,
  contentHeight: 77,
  frameRate: 8,
  originX: 0.477,
};

const LUFFY_WALK: SpriteSheetDef = {
  key: 'luffy-walk',
  url: '/sprites/player/luffy/walk.png',
  frameWidth: 108,
  frameHeight: 81,
  frameCount: 8,
  contentHeight: 77,
  frameRate: 12,
  originX: 0.546,
};

const LUFFY_COMBO_1: SpriteSheetDef = {
  key: 'luffy-combo1',
  url: '/sprites/player/luffy/combo1.png',
  frameWidth: 100,
  frameHeight: 84,
  frameCount: 6,
  contentHeight: 77,
  originX: 0.26,
};

const LUFFY_COMBO_2: SpriteSheetDef = {
  key: 'luffy-combo2',
  url: '/sprites/player/luffy/combo2.png',
  frameWidth: 100,
  frameHeight: 84,
  frameCount: 6,
  contentHeight: 77,
  originX: 0.26,
};

const LUFFY_COMBO_3: SpriteSheetDef = {
  key: 'luffy-combo3',
  url: '/sprites/player/luffy/combo3.png',
  frameWidth: 100,
  frameHeight: 84,
  frameCount: 7,
  contentHeight: 77,
  originX: 0.26,
};

const LUFFY_ATTACK_CHAIN = [LUFFY_COMBO_1, LUFFY_COMBO_2, LUFFY_COMBO_3] as const;

const LUFFY_HURT: CharacterReactionAnimDef = {
  key: 'luffy-hurt',
  url: '/sprites/player/luffy/hurt.png',
  frameWidth: 98,
  frameHeight: 81,
  frameCount: 3,
  contentHeight: 77,
  frameRate: 10,
  originX: 0.449,
};

const LUFFY_DEATH: CharacterReactionAnimDef = {
  key: 'luffy-death',
  url: '/sprites/player/luffy/death.png',
  frameWidth: 98,
  frameHeight: 81,
  frameCount: 1,
  contentHeight: 77,
  frameRate: 8,
  originX: 0.449,
};

const LUFFY_JUTSU_ANIMS: Record<string, CharacterSkillAnimDef> = {
  'skill-gomu-gatling': {
    key: 'luffy-gomu-gatling',
    url: '/sprites/player/luffy/gomu-gatling.png',
    frameWidth: 168,
    frameHeight: 81,
    frameCount: 14,
    contentHeight: 77,
    originX: 0.476,
    frameRate: 12,
    durationMs: 1167,
    hitDelayMs: 500,
    fxAttach: 'caster',
  },
};

const LUFFY_PACK: CharacterPack = {
  id: 'luffy',
  walk: LUFFY_WALK,
  idle: LUFFY_IDLE,
  attack: LUFFY_COMBO_1,
  attackChain: LUFFY_ATTACK_CHAIN,
  hurt: LUFFY_HURT,
  death: LUFFY_DEATH,
  skillAnims: LUFFY_JUTSU_ANIMS,
  hotbarSkillIds: ['skill-gomu-gatling'],
};

/**
 * Kenshin Himura — idle + walk + combo + hurt/death + Ryūtsuisen.
 * npm run kenshin:all — assets/kenshin-source/nu/kenshin/
 */
export const KENSHIN_CURATED_LOOK_TYPE = 9072;

const KENSHIN_IDLE: SpriteSheetDef = {
  key: 'kenshin-idle',
  url: '/sprites/player/kenshin/idle.png',
  frameWidth: 58,
  frameHeight: 94,
  frameCount: 4,
  contentHeight: 90,
  frameRate: 8,
  originX: 0.466,
};

const KENSHIN_WALK: SpriteSheetDef = {
  key: 'kenshin-walk',
  url: '/sprites/player/kenshin/walk.png',
  frameWidth: 81,
  frameHeight: 94,
  frameCount: 8,
  contentHeight: 90,
  frameRate: 12,
  originX: 0.5,
};

const KENSHIN_COMBO_1: SpriteSheetDef = {
  key: 'kenshin-combo1',
  url: '/sprites/player/kenshin/combo1.png',
  frameWidth: 188,
  frameHeight: 117,
  frameCount: 9,
  contentHeight: 90,
  originX: 0.463,
};

const KENSHIN_COMBO_2: SpriteSheetDef = {
  key: 'kenshin-combo2',
  url: '/sprites/player/kenshin/combo2.png',
  frameWidth: 188,
  frameHeight: 117,
  frameCount: 9,
  contentHeight: 90,
  originX: 0.463,
};

const KENSHIN_COMBO_3: SpriteSheetDef = {
  key: 'kenshin-combo3',
  url: '/sprites/player/kenshin/combo3.png',
  frameWidth: 188,
  frameHeight: 117,
  frameCount: 9,
  contentHeight: 90,
  originX: 0.463,
};

const KENSHIN_ATTACK_CHAIN = [KENSHIN_COMBO_1, KENSHIN_COMBO_2, KENSHIN_COMBO_3] as const;

const KENSHIN_HURT: CharacterReactionAnimDef = {
  key: 'kenshin-hurt',
  url: '/sprites/player/kenshin/hurt.png',
  frameWidth: 114,
  frameHeight: 94,
  frameCount: 1,
  contentHeight: 90,
  frameRate: 10,
};

const KENSHIN_DEATH: CharacterReactionAnimDef = {
  key: 'kenshin-death',
  url: '/sprites/player/kenshin/death.png',
  frameWidth: 114,
  frameHeight: 94,
  frameCount: 3,
  contentHeight: 90,
  frameRate: 8,
};

const KENSHIN_JUTSU_ANIMS: Record<string, CharacterSkillAnimDef> = {
  'skill-ryusuisen': {
    key: 'kenshin-ryusuisen',
    url: '/sprites/player/kenshin/ryusuisen.png',
    frameWidth: 173,
    frameHeight: 96,
    frameCount: 24,
    contentHeight: 90,
    frameRate: 12,
    durationMs: 2000,
    hitDelayMs: 917,
    originX: 0.416,
  },
};

const KENSHIN_PACK: CharacterPack = {
  id: 'kenshin',
  walk: KENSHIN_WALK,
  idle: KENSHIN_IDLE,
  attack: KENSHIN_COMBO_1,
  attackChain: KENSHIN_ATTACK_CHAIN,
  hurt: KENSHIN_HURT,
  death: KENSHIN_DEATH,
  skillAnims: KENSHIN_JUTSU_ANIMS,
  hotbarSkillIds: ['skill-ryusuisen'],
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
  shisui: SHISUI_PACK,
  'uchiha-shisui': SHISUI_PACK,
  'naruto-shippuden': NARUTO_SHIPPUDEN_PACK,
  'uzumaki-naruto-shippuden': NARUTO_SHIPPUDEN_PACK,
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
  ...JUMP_FORCE_BY_SLUG,
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
  ...Object.fromEntries(SHISUI_LOOK_TYPES.map((look) => [look, SHISUI_PACK])),
  ...Object.fromEntries(NARUTO_SHIPPUDEN_LOOK_TYPES.map((look) => [look, NARUTO_SHIPPUDEN_PACK])),
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
  ...JUMP_FORCE_BY_LOOK_TYPE,
};

/**
 * Conteúdo temporariamente fora da rotação. Os packs e assets ficam preservados
 * para reativação futura, mas não podem ser resolvidos pelo mapa/coleção.
 */
const INACTIVE_CHARACTER_PACK_IDS = new Set<string>([]);

function isActiveCharacterPack(pack: CharacterPack | null | undefined): pack is CharacterPack {
  return Boolean(pack && !INACTIVE_CHARACTER_PACK_IDS.has(pack.id));
}

export function isInactiveCharacterPackId(packId: string): boolean {
  return INACTIVE_CHARACTER_PACK_IDS.has(packId);
}

function uniquePacksFromMaps(): CharacterPack[] {
  const seen = new Set<string>();
  const packs: CharacterPack[] = [];
  for (const pack of [...Object.values(PACKS), ...Object.values(CURATED_BY_SLUG)]) {
    if (seen.has(pack.id)) continue;
    seen.add(pack.id);
    packs.push(pack);
  }
  return packs;
}

let lookTypesByPackId: Map<string, number[]> | null = null;

function lookTypeIndex(): Map<string, number[]> {
  if (lookTypesByPackId) return lookTypesByPackId;
  const index = new Map<string, number[]>();
  for (const [look, pack] of Object.entries(CURATED_BY_LOOK_TYPE)) {
    const id = pack.id;
    const n = Number(look);
    const arr = index.get(id);
    if (arr) arr.push(n);
    else index.set(id, [n]);
  }
  lookTypesByPackId = index;
  return index;
}

/** lookTypes WONSR / curados que apontam para o mesmo pack.id. */
export function listLookTypesForPack(packId: string): number[] {
  return lookTypeIndex().get(packId) ?? [];
}

/** Todos os packs cadastrados (inclui inativos, salvo `includeInactive: false`). */
export function listCharacterPacks(options?: { includeInactive?: boolean }): CharacterPack[] {
  const includeInactive = options?.includeInactive !== false;
  return uniquePacksFromMaps()
    .filter((pack) => includeInactive || !INACTIVE_CHARACTER_PACK_IDS.has(pack.id))
    .map(applyDevPackOverlay);
}

/** Pack pelo id permanente (`naruto-classic`, `kakashi`, `gaara`, …). */
export function getCharacterPackById(
  packId: string,
  options?: { includeInactive?: boolean },
): CharacterPack | null {
  if (!packId) return null;
  const starter = PACKS[packId as StarterCharacterId];
  if (starter) {
    if (options?.includeInactive === false && INACTIVE_CHARACTER_PACK_IDS.has(starter.id)) return null;
    return applyDevPackOverlay(starter);
  }
  const bySlug = CURATED_BY_SLUG[packId];
  const pack = bySlug ?? uniquePacksFromMaps().find((entry) => entry.id === packId) ?? null;
  if (!pack) return null;
  if (options?.includeInactive === false && INACTIVE_CHARACTER_PACK_IDS.has(pack.id)) return null;
  return applyDevPackOverlay(pack);
}

export function getCharacterPack(starterId: StarterCharacterId): CharacterPack {
  return applyDevPackOverlay(PACKS[starterId] ?? NARUTO_PACK);
}

/** Pack lateral curado por slug WONSR (ex.: `shikamaru`). */
export function getCuratedPackBySlug(slug: string | null | undefined): CharacterPack | null {
  if (!slug) return null;
  const pack = CURATED_BY_SLUG[slug];
  if (!isActiveCharacterPack(pack)) return null;
  return applyDevPackOverlay(pack);
}

/** Pack lateral curado por lookType WONSR. */
export function getCuratedPackByLookType(lookType: number): CharacterPack | null {
  const pack = CURATED_BY_LOOK_TYPE[lookType];
  if (!isActiveCharacterPack(pack)) return null;
  return applyDevPackOverlay(pack);
}

/**
 * Escala do personagem no mundo (walk → jutsus).
 * Y = altura padrão; X = Y × displayScaleX (esmaga silhuetas largas).
 * Packs que voam usam o idle (pose em pé) como régua — a sheet de voo
 * é mais baixa no eixo Y e não deve definir a densidade do corpo.
 */
export function characterDisplayScale(pack: CharacterPack): { x: number; y: number } {
  const ref = pack.locomotion === 'fly' && pack.idle ? pack.idle : pack.walk;
  const height = ref.contentHeight ?? ref.frameHeight;
  const y = (height > 0 ? CHARACTER_DISPLAY_HEIGHT / height : 1) * (pack.displayScale ?? 1);
  const x = y * (pack.displayScaleX ?? 1);
  return { x, y };
}

/** Elevação visual (px mundo) para packs que voam. */
export function characterFlightHoverPx(pack: CharacterPack): number {
  if (pack.locomotion !== 'fly') return 0;
  return pack.flightHoverPx ?? 14;
}

/**
 * Origin lateral (sem outfit WONSR). `fly` sobe o sprite: originY > 1
 * deixa o ponto de colisão no chão e o corpo flutuando.
 * `sheet.originX` trava folhas largas (beam) nos pés.
 * offsetX/Y alteram só o origin visual — não a posição lógica (sprite.x/y).
 */
export function characterLateralOrigin(
  pack: CharacterPack,
  sheet?: SpriteSheetDef | null,
): { x: number; y: number } {
  const hover = characterFlightHoverPx(pack);
  const displayH = CHARACTER_DISPLAY_HEIGHT * (pack.displayScale ?? 1);
  const baseY = sheet?.originY ?? (hover <= 0 ? 1 : 1 + hover / Math.max(displayH, 1));
  const frameW = Math.max(1, sheet?.frameWidth ?? 1);
  const frameH = Math.max(1, sheet?.frameHeight ?? 1);
  const originX = (sheet?.originX ?? 0.5) - (sheet?.offsetX ?? 0) / frameW;
  const originY = baseY - (sheet?.offsetY ?? 0) / frameH;
  return { x: originX, y: originY };
}

/** Offset Y do nameplate a partir de `sprite.y` (topo da cabeça + gap). */
export function characterNameplateLift(pack: CharacterPack): number {
  return CHARACTER_DISPLAY_HEIGHT * (pack.displayScale ?? 1) + characterFlightHoverPx(pack);
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
  if (pack.attackChain) {
    for (const sheet of pack.attackChain) {
      sheets.push(sheet);
      if (sheet.fx) sheets.push(sheet.fx);
    }
  } else if (pack.attack.fx) {
    sheets.push(pack.attack.fx);
  }
  if (pack.hurt) sheets.push(pack.hurt);
  if (pack.death) sheets.push(pack.death);
  for (const anim of Object.values(pack.skillAnims)) {
    sheets.push(anim);
    if (anim.vfxId) {
      const catalog = getVfxDefinition(anim.vfxId);
      if (catalog && !isSequenceVfx(catalog)) sheets.push(sharedVfxToSheet(catalog));
    }
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

export function sequenceFrameKey(sheetKey: string, index: number): string {
  return `${sheetKey}__f${index}`;
}

export function createSpriteSheetAnimation(
  scene: Phaser.Scene,
  sheet: SpriteSheetDef,
  animKey: string,
  options?: { start?: number; end?: number; repeat?: number },
): boolean {
  const last = Math.max(0, (sheet.frames?.length || sheet.frameCount) - 1);
  const start = Math.min(last, Math.max(0, options?.start ?? 0));
  const end = Math.min(last, Math.max(start, options?.end ?? last));
  const sequence = sheet.frames && sheet.frames.length > 0;
  const frames = sequence
    ? sheet.frames!.slice(start, end + 1).map((_, index) => ({ key: sequenceFrameKey(sheet.key, start + index) }))
    : scene.textures.exists(sheet.key)
      ? scene.anims.generateFrameNumbers(sheet.key, { start, end })
      : null;
  if (!frames || frames.length === 0) return false;
  if (sequence && frames.some((frame) => !frame.key || !scene.textures.exists(frame.key))) return false;
  if (scene.anims.exists(animKey)) scene.anims.remove(animKey);
  scene.anims.create({
    key: animKey,
    frames,
    frameRate: sheet.frameRate ?? 12,
    repeat: options?.repeat ?? (sheet.loop ? -1 : 0),
  });
  return true;
}

/**
 * Carrega folhas avulsas (VFX de catálogo no Test Lab).
 * Se a textura já existe com frameWidth/Height diferentes, recarrega.
 */
export function loadSpriteSheets(scene: Phaser.Scene, sheets: SpriteSheetDef[]): Promise<void> {
  const queued = new Set<string>();

  for (const sheet of sheets) {
    if (sheet.frames && sheet.frames.length > 0) {
      sheet.frames.forEach((url, index) => {
        const frameKey = sequenceFrameKey(sheet.key, index);
        if (queued.has(frameKey) || scene.textures.exists(frameKey)) return;
        queued.add(frameKey);
        scene.load.image(frameKey, url);
      });
      continue;
    }
    if (queued.has(sheet.key)) continue;

    if (scene.textures.exists(sheet.key)) {
      const existing = scene.textures.get(sheet.key).get(0);
      const sameSize =
        existing != null &&
        existing.width === sheet.frameWidth &&
        existing.height === sheet.frameHeight;
      if (sameSize) continue;
      scene.textures.remove(sheet.key);
      const animsMap = (
        scene.anims as unknown as {
          anims: Map<string, Phaser.Animations.Animation>;
        }
      ).anims;
      for (const anim of animsMap.values()) {
        if (anim.frames.some((f) => f.textureKey === sheet.key)) {
          scene.anims.remove(anim.key);
        }
      }
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
      sheets.flatMap((s) =>
        s.frames?.length ? s.frames.map((_, i) => sequenceFrameKey(s.key, i)) : [s.key],
      ),
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

/**
 * Carrega sob demanda as sheets de um pack (troca de personagem selado).
 */
export async function loadCharacterPack(scene: Phaser.Scene, pack: CharacterPack): Promise<void> {
  await loadSpriteSheets(scene, listPackSheets(pack));
  const { ensurePackSharedVfx } = await import('@/data/vfx/load-shared-vfx');
  await ensurePackSharedVfx(scene, pack);
}
