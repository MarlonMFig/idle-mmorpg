import * as Phaser from 'phaser';
import { NAMEPLATE_GAP_PX } from '@/constants/combat';
import { PLAYER_NAMEPLATE_STYLE, worldDepthForY } from '@/constants/nameplate';
import {
  directionFacesLeft,
  PLAYER_DIRECTIONS,
  type PlayerDirection,
} from '@/constants/player';
import {
  CHARACTER_BODY_HEIGHT,
  CHARACTER_BODY_WIDTH,
} from '@/constants/sprites';
import {
  characterDisplayScale,
  characterLateralOrigin,
  characterNameplateLift,
  packDeathAnimKey,
  packHurtAnimKey,
  type CharacterPack,
  type CharacterSkillAnimDef,
  type SpriteSheetDef,
} from '@/data/character-packs';
import { attributesStore } from '@/stores/attributes-store';
import type { PlayerAnimState } from '@/types/net';

export interface PlayerSpawnOptions {
  x: number;
  y: number;
  pack: CharacterPack;
  /** Nome acima da cabeça (sessão / multiplayer). */
  displayName?: string;
}

/**
 * Jogador idle com pack visual do starter (Naruto / Sasuke / …).
 */
export class Player {
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  readonly pack: CharacterPack;
  private readonly nameLabel: Phaser.GameObjects.Text | null;
  private facing: PlayerDirection = 'down';
  private anim: PlayerAnimState = 'idle';
  private busyUntil = 0;
  /** Índice do próximo hit da cadeia de combos (1→2→3→1…). */
  private comboStep = 0;
  private readonly scaleX: number;
  private readonly scaleY: number;
  private readonly skillAnimKeys: Set<string>;
  private readonly attackAnimKeys: Set<string>;
  private readonly hurtAnimKey: string | null;
  private readonly deathAnimKey: string | null;
  private dead = false;

  constructor(
    private readonly scene: Phaser.Scene,
    options: PlayerSpawnOptions,
  ) {
    this.pack = options.pack;
    // Escala do pack (walk → jutsus); X pode ser mais estreito que Y.
    const display = characterDisplayScale(options.pack);
    this.scaleX = display.x;
    this.scaleY = display.y;
    this.skillAnimKeys = new Set(
      Object.values(options.pack.skillAnims).map((anim) => `skill-${anim.key}`),
    );
    this.attackAnimKeys = new Set(
      options.pack.outfit
        ? options.pack.outfit.directions.map((direction) =>
            outfitAnimKey(options.pack, 'attack', direction),
          )
        : packAttackSheets(options.pack).map((sheet) =>
            chainAttackAnimKey(options.pack, sheet),
          ),
    );
    this.hurtAnimKey = packHurtAnimKey(options.pack);
    this.deathAnimKey = packDeathAnimKey(options.pack);

    Player.ensureAnimations(scene, options.pack);

    this.sprite = scene.physics.add.sprite(
      options.x,
      options.y,
      options.pack.walk.key,
      0,
    );
    if (options.pack.outfit) {
      const { content } = options.pack.outfit;
      this.sprite.setOrigin(
        (content.x + content.width / 2) / options.pack.walk.frameWidth,
        (content.y + content.height) / options.pack.walk.frameHeight,
      );
    } else {
      this.applySheetOrigin(options.pack.idle ?? options.pack.walk);
    }
    this.applyBaseScale();
    this.sprite.setCollideWorldBounds(true);
    this.sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);

    // Mesma pegada no chão dos monstros e NPCs, em px de textura (o Phaser
    // multiplica tamanho e offset do corpo pela escala do sprite).
    this.refreshBodyOffset();

    const name = options.displayName?.trim();
    this.nameLabel = name
      ? scene.add
          .text(options.x, options.y, name, PLAYER_NAMEPLATE_STYLE)
          .setOrigin(0.5, 1)
      : null;

    this.sprite.on(Phaser.Animations.Events.ANIMATION_COMPLETE, (anim: Phaser.Animations.Animation) => {
      if (this.dead) return;
      if (this.deathAnimKey && anim.key === this.deathAnimKey) {
        // Segura o último quadro da morte (sem voltar a idle).
        this.busyUntil = Number.POSITIVE_INFINITY;
        return;
      }
      const isHurt = this.hurtAnimKey != null && anim.key === this.hurtAnimKey;
      const isSkill = this.skillAnimKeys.has(anim.key);
      if (
        !isHurt &&
        !this.attackAnimKeys.has(anim.key) &&
        !isSkill
      ) {
        return;
      }
      if (isSkill && this.scene.time.now < this.busyUntil) {
        const last = anim.frames[anim.frames.length - 1];
        this.sprite.anims.stop();
        this.sprite.setTexture(last.textureKey as string, last.textureFrame as number);
        const remaining = this.busyUntil - this.scene.time.now;
        this.scene.time.delayedCall(remaining, () => this.finishSkillHold());
        return;
      }
      this.finishSkillHold();
    });

    this.applyFacingFlip();
    this.playIdle();
    this.syncPresentation();
  }

  /** Depth por Y + nameplate no topo do sprite. */
  syncPresentation(): void {
    const depth = worldDepthForY(this.sprite.y, 12);
    this.sprite.setDepth(depth);
    if (!this.nameLabel) return;
    this.nameLabel.setPosition(
      this.sprite.x,
      this.sprite.y - characterNameplateLift(this.pack) - NAMEPLATE_GAP_PX,
    );
    this.nameLabel.setDepth(depth + 3);
  }

  isBusy(): boolean {
    return this.dead || this.scene.time.now < this.busyUntil;
  }

  /** Em cast de jutsu (folha skill-*). */
  isCastingSkill(): boolean {
    return this.isPlayingSkill();
  }

  isDead(): boolean {
    return this.dead;
  }

  stop(): void {
    this.sprite.setVelocity(0, 0);
    if (this.isBusy()) return;
    this.anim = 'idle';
    this.playIdle();
  }

  /**
   * Movimento manual (WASD). `dx`/`dy` em -1..1; (0,0) = idle.
   */
  applyMoveInput(dx: number, dy: number): void {
    if (this.isBusy()) {
      this.sprite.setVelocity(0, 0);
      return;
    }

    if (dx === 0 && dy === 0) {
      this.stop();
      return;
    }

    this.facing = vectorToDirection(dx, dy);
    this.applyFacingFlip();

    const speed = attributesStore.getSpeed();
    const len = Math.hypot(dx, dy) || 1;
    this.sprite.setVelocity((dx / len) * speed, (dy / len) * speed);
    this.anim = 'walk';
    this.playWalk();
  }

  moveToward(targetX: number, targetY: number, stopDistance: number): boolean {
    if (this.isBusy()) {
      this.sprite.setVelocity(0, 0);
      return false;
    }

    const dx = targetX - this.sprite.x;
    const dy = targetY - this.sprite.y;
    const dist = Math.hypot(dx, dy);

    this.facing = vectorToDirection(dx, dy);
    this.applyFacingFlip();

    if (dist <= stopDistance) {
      this.sprite.setVelocity(0, 0);
      this.anim = 'idle';
      this.playIdle();
      return true;
    }

    const speed = attributesStore.getSpeed();
    const len = dist || 1;
    this.sprite.setVelocity((dx / len) * speed, (dy / len) * speed);
    this.anim = 'walk';
    this.playWalk();
    return false;
  }

  faceToward(targetX: number, targetY: number): void {
    this.facing = vectorToDirection(targetX - this.sprite.x, targetY - this.sprite.y);
    this.applyFacingFlip();
  }

  /**
   * Toca um hit da cadeia de combos (ou a leaf de ataque única).
   * @returns atraso até o hit do golpe em ms (para o CombatSystem).
   */
  playAttack(): number {
    if (this.isBusy()) return 0;

    if (this.pack.outfit) {
      const animKey = outfitAnimKey(this.pack, 'attack', this.outfitDirection());
      if (!this.scene.anims.exists(animKey)) return 0;
      const durationMs = 360;
      this.busyUntil = this.scene.time.now + durationMs;
      this.sprite.setVelocity(0, 0);
      this.applyFacingFlip();
      this.applyBaseScale();
      this.sprite.anims.play(animKey, true);
      return Math.floor(durationMs * 0.55);
    }

    const chain = packAttackSheets(this.pack);
    const sheet = chain[this.comboStep % chain.length];
    this.comboStep = (this.comboStep + 1) % chain.length;

    const animKey = chainAttackAnimKey(this.pack, sheet);
    if (!this.scene.anims.exists(animKey)) return 0;

    const attackFps = sheet.frameRate ?? 12;
    const durationMs = Math.max(280, Math.floor((sheet.frameCount / attackFps) * 1000));
    this.busyUntil = this.scene.time.now + durationMs;
    this.sprite.setVelocity(0, 0);
    this.applyFacingFlip();
    // Escala global do pack (walk) — nunca recalcular por frame do combo.
    this.applyBaseScale();
    this.sprite.setTexture(sheet.key, 0);
    this.sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.sprite.anims.play(animKey, true);
    return Math.floor(durationMs * 0.55);
  }

  /**
   * Toca animação de jutsu do pack.
   * @returns hitDelayMs se lançou, senão null.
   */
  playSkillAnim(skillId: string): number | null {
    const def = this.pack.skillAnims[skillId];
    if (!def || this.isBusy()) return null;

    const animKey = `skill-${def.key}`;
    if (!this.scene.anims.exists(animKey)) return null;

    // Trava no lugar: especial não herda velocity/walk da perseguição.
    this.anim = 'idle';
    const castMs = Math.max(def.durationMs, def.hitDelayMs ?? def.durationMs);
    this.busyUntil = this.scene.time.now + castMs;
    this.sprite.setVelocity(0, 0);
    this.sprite.clearTint();
    // As folhas de jutsu são de lado, sempre voltadas para a direita.
    this.sprite.setFlipX(directionFacesLeft(this.facing));
    // Escala única do pack; origin da folha (pés) evita slide em beams largos.
    this.applyBaseScale();
    this.applySheetOrigin(def);
    this.sprite.anims.play(animKey, true);
    this.refreshBodyOffset();
    return def.hitDelayMs;
  }

  getSkillAnim(skillId: string): CharacterSkillAnimDef | undefined {
    return this.pack.skillAnims[skillId];
  }

  /**
   * Hit reaction (frames 1–2). Não interrompe cast de skill;
   * pode sobrepor idle / walk / ataque. Retorna false se não aplicou.
   */
  playHurt(): boolean {
    if (this.dead || !this.pack.hurt || !this.hurtAnimKey) return false;
    if (!this.scene.anims.exists(this.hurtAnimKey)) return false;
    // Não corta jutsu no meio do cast.
    if (this.isPlayingSkill()) return false;

    const def = this.pack.hurt;
    const durationMs = Math.max(
      180,
      Math.floor((def.frameCount / (def.frameRate ?? 10)) * 1000),
    );
    this.busyUntil = this.scene.time.now + durationMs;
    this.sprite.setVelocity(0, 0);
    this.applyFacingFlip();
    this.applyBaseScale();
    this.sprite.setTexture(def.key, 0);
    this.sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.sprite.anims.play(this.hurtAnimKey, false);
    return true;
  }

  /**
   * Morte (frames 3–5). Sempre sobrescreve; segura o último quadro.
   */
  playDeath(): boolean {
    if (this.dead) return false;
    this.dead = true;
    this.sprite.setVelocity(0, 0);
    this.busyUntil = Number.POSITIVE_INFINITY;

    const def = this.pack.death;
    if (!def || !this.deathAnimKey || !this.scene.anims.exists(this.deathAnimKey)) {
      this.sprite.anims.stop();
      return false;
    }

    this.applyFacingFlip();
    this.applyBaseScale();
    this.sprite.setTexture(def.key, 0);
    this.sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.sprite.anims.play(this.deathAnimKey, false);
    return true;
  }

  /** Revive visual (ex.: respawn / heal full). */
  clearDeath(): void {
    this.dead = false;
    this.busyUntil = 0;
    this.applyBaseScale();
    this.sprite.clearTint();
    this.sprite.setAlpha(1);
    this.playIdle();
  }

  get x(): number {
    return this.sprite.x;
  }

  get y(): number {
    return this.sprite.y;
  }

  get direction(): PlayerDirection {
    return this.facing;
  }

  get animState(): PlayerAnimState {
    return this.anim;
  }

  private applyFacingFlip(): void {
    this.sprite.setFlipX(this.pack.outfit ? false : directionFacesLeft(this.facing));
  }

  private finishSkillHold(): void {
    if (this.dead) return;
    this.busyUntil = 0;
    this.applyBaseScale();
    this.anim = 'idle';
    this.sprite.clearTint();
    this.applySheetOrigin(this.pack.idle ?? this.pack.walk);
    this.sprite.setTexture(
      this.pack.idle?.key ?? this.pack.walk.key,
      this.pack.outfit ? this.idleFrame() : 0,
    );
    this.sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.refreshBodyOffset();
    this.applyFacingFlip();
    this.sprite.setVelocity(0, 0);
    this.playIdle();
  }

  private isPlayingSkill(): boolean {
    const key = this.sprite.anims.currentAnim?.key;
    return key != null && this.skillAnimKeys.has(key);
  }

  private playIdle(): void {
    if (this.dead) return;
    if (this.pack.outfit) {
      this.sprite.anims.stop();
      this.sprite.setTexture(this.pack.walk.key, this.idleFrame());
      return;
    }
    const animKey = legacyAnimKey(this.pack, 'idle');
    this.applyBaseScale();
    this.applySheetOrigin(this.pack.idle ?? this.pack.walk);
    if (this.sprite.anims.currentAnim?.key !== animKey) {
      this.sprite.anims.play(animKey, true);
    }
    this.refreshBodyOffset();
  }

  private playWalk(): void {
    if (this.dead) return;
    const animKey = this.pack.outfit
      ? outfitAnimKey(this.pack, 'walk', this.outfitDirection())
      : legacyAnimKey(this.pack, 'walk');
    this.applyBaseScale();
    this.applySheetOrigin(this.pack.walk);
    if (this.sprite.anims.currentAnim?.key !== animKey) {
      this.sprite.anims.play(animKey, true);
    }
    this.refreshBodyOffset();
  }

  private applyBaseScale(): void {
    this.sprite.setScale(this.scaleX, this.scaleY);
  }

  /** Origin da folha atual (pés em jutsus largos / hover em fly). */
  private applySheetOrigin(sheet: SpriteSheetDef): void {
    if (this.pack.outfit) return;
    const origin = characterLateralOrigin(this.pack, sheet);
    this.sprite.setOrigin(origin.x, origin.y);
  }

  private refreshBodyOffset(): void {
    const body = this.sprite.body;
    if (!body) return;
    const bodyW = CHARACTER_BODY_WIDTH / this.scaleX;
    const bodyH = CHARACTER_BODY_HEIGHT / this.scaleY;
    body.setSize(bodyW, bodyH, false);
    body.setOffset(
      this.sprite.displayOriginX - bodyW / 2,
      this.sprite.displayOriginY - bodyH,
    );
  }

  private idleFrame(): number {
    const outfit = this.pack.outfit;
    if (!outfit) return 0;
    const row = Math.max(0, outfit.directions.indexOf(this.outfitDirection()));
    return row * outfit.phases;
  }

  private outfitDirection(): 'north' | 'east' | 'south' | 'west' {
    switch (this.facing) {
      case 'up':
      case 'up-left':
      case 'up-right':
        return 'north';
      case 'left':
        return 'west';
      case 'right':
        return 'east';
      default:
        return 'south';
    }
  }

  static ensureAnimations(scene: Phaser.Scene, pack: CharacterPack): void {
    if (pack.outfit) {
      for (const direction of pack.outfit.directions) {
        const row = pack.outfit.directions.indexOf(direction);
        const frames = Array.from({ length: pack.outfit.phases }, (_, phase) => ({
          key: pack.walk.key,
          frame: row * pack.outfit!.phases + phase,
        }));
        const walkKey = outfitAnimKey(pack, 'walk', direction);
        if (!scene.anims.exists(walkKey)) {
          scene.anims.create({ key: walkKey, frames, frameRate: 10, repeat: -1 });
        }
        const attackKey = outfitAnimKey(pack, 'attack', direction);
        if (!scene.anims.exists(attackKey)) {
          scene.anims.create({
            key: attackKey,
            frames: [...frames.slice(1), frames[0]],
            frameRate: 14,
            repeat: 0,
          });
        }
      }
    } else if (!scene.anims.exists(legacyAnimKey(pack, 'idle'))) {
      if (pack.idle && scene.textures.exists(pack.idle.key)) {
        scene.anims.create({
          key: legacyAnimKey(pack, 'idle'),
          frames: scene.anims.generateFrameNumbers(pack.idle.key, {
            start: 0,
            end: pack.idle.frameCount - 1,
          }),
          // Idle um pouco mais vivo (ref. pixel-art fighting / idle MMO).
          frameRate: pack.idle.frameRate ?? 8,
          repeat: -1,
        });
      } else if (scene.textures.exists(pack.walk.key)) {
        scene.anims.create({
          key: legacyAnimKey(pack, 'idle'),
          frames: [{ key: pack.walk.key, frame: 0 }],
          frameRate: 1,
          repeat: -1,
        });
      }
    }

    if (
      !pack.outfit &&
      !scene.anims.exists(legacyAnimKey(pack, 'walk')) &&
      scene.textures.exists(pack.walk.key)
    ) {
      scene.anims.create({
        key: legacyAnimKey(pack, 'walk'),
        frames: scene.anims.generateFrameNumbers(pack.walk.key, {
          start: 0,
          end: pack.walk.frameCount - 1,
        }),
        frameRate: pack.walk.frameRate ?? 12,
        repeat: -1,
      });
    }

    if (!pack.outfit) {
      for (const sheet of packAttackSheets(pack)) {
        const animKey = chainAttackAnimKey(pack, sheet);
        if (!scene.textures.exists(sheet.key) || scene.anims.exists(animKey)) continue;
        scene.anims.create({
          key: animKey,
          frames: scene.anims.generateFrameNumbers(sheet.key, {
            start: 0,
            end: sheet.frameCount - 1,
          }),
          frameRate: sheet.frameRate ?? 12,
          repeat: 0,
        });
      }
    }

    for (const def of Object.values(pack.skillAnims)) {
      const animKey = `skill-${def.key}`;
      if (!scene.textures.exists(def.key)) continue;
      // Sempre recria: textura pode ter mudado (fw/fh) e anims antigas leem frames errados.
      if (scene.anims.exists(animKey)) scene.anims.remove(animKey);
      scene.anims.create({
        key: animKey,
        frames: scene.anims.generateFrameNumbers(def.key, {
          start: 0,
          end: def.frameCount - 1,
        }),
        frameRate: def.frameRate ?? 12,
        repeat: 0,
      });

      if (def.fx && scene.textures.exists(def.fx.key) && !scene.anims.exists(`fx-${def.fx.key}`)) {
        scene.anims.create({
          key: `fx-${def.fx.key}`,
          frames: scene.anims.generateFrameNumbers(def.fx.key, {
            start: 0,
            end: def.fx.frameCount - 1,
          }),
          frameRate: 12,
          repeat: 0,
        });
        const flightN = def.fxFlightFrameCount ?? 0;
        if (flightN > 0) {
          const flightKey = `fx-${def.fx.key}-flight`;
          const impactKey = `fx-${def.fx.key}-impact`;
          if (!scene.anims.exists(flightKey)) {
            scene.anims.create({
              key: flightKey,
              frames: scene.anims.generateFrameNumbers(def.fx.key, {
                start: 0,
                end: Math.min(flightN, def.fx.frameCount) - 1,
              }),
              frameRate: 10,
              repeat: -1,
            });
          }
          if (!scene.anims.exists(impactKey) && flightN < def.fx.frameCount) {
            scene.anims.create({
              key: impactKey,
              frames: scene.anims.generateFrameNumbers(def.fx.key, {
                start: flightN,
                end: def.fx.frameCount - 1,
              }),
              frameRate: 12,
              repeat: 0,
            });
          }
        }
      }
      if (
        def.fxSecondary &&
        scene.textures.exists(def.fxSecondary.key) &&
        !scene.anims.exists(`fx-${def.fxSecondary.key}`)
      ) {
        scene.anims.create({
          key: `fx-${def.fxSecondary.key}`,
          frames: scene.anims.generateFrameNumbers(def.fxSecondary.key, {
            start: 0,
            end: def.fxSecondary.frameCount - 1,
          }),
          frameRate: def.fxSecondaryFrameRate ?? 12,
          repeat: 0,
        });
      }
    }

    if (pack.hurt && scene.textures.exists(pack.hurt.key)) {
      const hurtKey = packHurtAnimKey(pack)!;
      if (!scene.anims.exists(hurtKey)) {
        scene.anims.create({
          key: hurtKey,
          frames: scene.anims.generateFrameNumbers(pack.hurt.key, {
            start: 0,
            end: pack.hurt.frameCount - 1,
          }),
          frameRate: pack.hurt.frameRate ?? 10,
          repeat: 0,
        });
      }
    }

    if (pack.death && scene.textures.exists(pack.death.key)) {
      const deathKey = packDeathAnimKey(pack)!;
      if (!scene.anims.exists(deathKey)) {
        scene.anims.create({
          key: deathKey,
          frames: scene.anims.generateFrameNumbers(pack.death.key, {
            start: 0,
            end: pack.death.frameCount - 1,
          }),
          frameRate: pack.death.frameRate ?? 8,
          repeat: 0,
        });
      }
    }
  }
}

function vectorToDirection(vx: number, vy: number): PlayerDirection {
  const angle = Math.atan2(vx, vy);
  const sector = Math.round(angle / (Math.PI / 4));
  const index = ((sector % 8) + 8) % 8;
  return PLAYER_DIRECTIONS[index];
}

type OutfitDirection = 'north' | 'east' | 'south' | 'west';
type BaseAnim = 'idle' | 'walk' | 'attack';

function legacyAnimKey(pack: CharacterPack, anim: BaseAnim): string {
  return `${pack.id}-${anim}`;
}

function packAttackSheets(pack: CharacterPack): readonly SpriteSheetDef[] {
  if (pack.attackChain && pack.attackChain.length > 0) return pack.attackChain;
  return [pack.attack];
}

function chainAttackAnimKey(pack: CharacterPack, sheet: SpriteSheetDef): string {
  return `${pack.id}-attack-${sheet.key}`;
}

function outfitAnimKey(
  pack: CharacterPack,
  anim: 'walk' | 'attack',
  direction: OutfitDirection,
): string {
  return `${pack.walk.key}-${anim}-${direction}`;
}

export function playerOutfitDirection(direction: PlayerDirection): OutfitDirection {
  switch (direction) {
    case 'up':
    case 'up-left':
    case 'up-right':
      return 'north';
    case 'left':
      return 'west';
    case 'right':
      return 'east';
    default:
      return 'south';
  }
}

export function playerIdleFrame(pack: CharacterPack, direction: PlayerDirection): number {
  const outfit = pack.outfit;
  if (!outfit) return 0;
  const row = Math.max(0, outfit.directions.indexOf(playerOutfitDirection(direction)));
  return row * outfit.phases;
}

export function playerWalkAnimKey(pack: CharacterPack, direction: PlayerDirection): string {
  return pack.outfit
    ? outfitAnimKey(pack, 'walk', playerOutfitDirection(direction))
    : legacyAnimKey(pack, 'walk');
}
