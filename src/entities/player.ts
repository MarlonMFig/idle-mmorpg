import * as Phaser from 'phaser';
import {
  directionFacesLeft,
  PLAYER_DIRECTIONS,
  type PlayerDirection,
} from '@/constants/player';
import type { CharacterPack, CharacterSkillAnimDef } from '@/data/character-packs';
import { attributesStore } from '@/stores/attributes-store';
import type { PlayerAnimState } from '@/types/net';

export interface PlayerSpawnOptions {
  x: number;
  y: number;
  pack: CharacterPack;
}

const IDLE_ANIM = 'player-idle';
const WALK_ANIM = 'player-walk';
const ATTACK_ANIM = 'player-attack';

/**
 * Jogador idle com pack visual do starter (Naruto / Sasuke / …).
 */
export class Player {
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  readonly pack: CharacterPack;
  private facing: PlayerDirection = 'down';
  private anim: PlayerAnimState = 'idle';
  private busyUntil = 0;
  private readonly baseScale: number;
  private readonly skillAnimKeys: Set<string>;

  constructor(
    private readonly scene: Phaser.Scene,
    options: PlayerSpawnOptions,
  ) {
    this.pack = options.pack;
    // Escala única (walk → jutsus) — nunca recalcula por frameHeight do skill.
    this.baseScale = options.pack.displayHeight / options.pack.walk.frameHeight;
    this.skillAnimKeys = new Set(
      Object.values(options.pack.skillAnims).map((anim) => `skill-${anim.key}`),
    );

    Player.ensureAnimations(scene, options.pack);

    this.sprite = scene.physics.add.sprite(
      options.x,
      options.y,
      options.pack.walk.key,
      0,
    );
    this.sprite.setOrigin(0.5, 1);
    this.sprite.setScale(this.baseScale);
    this.sprite.setCollideWorldBounds(true);

    const bodyW = Math.max(14, Math.floor(options.pack.walk.frameWidth * 0.35));
    const bodyH = Math.max(10, Math.floor(options.pack.walk.frameHeight * 0.22));
    this.sprite.body!.setSize(bodyW, bodyH);
    this.sprite.body!.setOffset(
      (options.pack.walk.frameWidth - bodyW) / 2,
      options.pack.walk.frameHeight - bodyH,
    );
    this.sprite.setDepth(10);

    this.sprite.on(Phaser.Animations.Events.ANIMATION_COMPLETE, (anim: Phaser.Animations.Animation) => {
      if (anim.key !== ATTACK_ANIM && !this.skillAnimKeys.has(anim.key)) return;
      this.busyUntil = 0;
      this.sprite.setScale(this.baseScale);
      this.sprite.setTexture(this.pack.walk.key, 0);
      this.applyFacingFlip();
      if (this.anim === 'walk') this.playWalk();
      else this.playIdle();
    });

    this.applyFacingFlip();
    this.playIdle();
  }

  isBusy(): boolean {
    return this.scene.time.now < this.busyUntil;
  }

  stop(): void {
    this.sprite.setVelocity(0, 0);
    if (this.isBusy()) return;
    this.anim = 'idle';
    this.playIdle();
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

  playAttack(): void {
    if (!this.scene.anims.exists(ATTACK_ANIM) || this.isBusy()) return;
    this.busyUntil = this.scene.time.now + 360;
    this.sprite.setVelocity(0, 0);
    this.applyFacingFlip();
    this.sprite.setScale(this.baseScale);
    this.sprite.anims.play(ATTACK_ANIM, true);
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

    this.busyUntil = this.scene.time.now + def.durationMs;
    this.sprite.setVelocity(0, 0);
    this.applyFacingFlip();
    // Sempre a escala do walk — jutsus com frames maiores/menores não mudam o tamanho do personagem.
    this.sprite.setScale(this.baseScale);
    this.sprite.anims.play(animKey, true);
    return def.hitDelayMs;
  }

  getSkillAnim(skillId: string): CharacterSkillAnimDef | undefined {
    return this.pack.skillAnims[skillId];
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
    this.sprite.setFlipX(directionFacesLeft(this.facing));
  }

  private playIdle(): void {
    if (this.sprite.anims.currentAnim?.key !== IDLE_ANIM) {
      this.sprite.anims.play(IDLE_ANIM, true);
    }
  }

  private playWalk(): void {
    if (this.sprite.anims.currentAnim?.key !== WALK_ANIM) {
      this.sprite.anims.play(WALK_ANIM, true);
    }
  }

  static ensureAnimations(scene: Phaser.Scene, pack: CharacterPack): void {
    if (!scene.anims.exists(IDLE_ANIM)) {
      scene.anims.create({
        key: IDLE_ANIM,
        frames: [{ key: pack.walk.key, frame: 0 }],
        frameRate: 1,
        repeat: -1,
      });
    }

    if (!scene.anims.exists(WALK_ANIM)) {
      scene.anims.create({
        key: WALK_ANIM,
        frames: scene.anims.generateFrameNumbers(pack.walk.key, {
          start: 0,
          end: pack.walk.frameCount - 1,
        }),
        frameRate: 10,
        repeat: -1,
      });
    }

    if (scene.textures.exists(pack.attack.key) && !scene.anims.exists(ATTACK_ANIM)) {
      scene.anims.create({
        key: ATTACK_ANIM,
        frames: scene.anims.generateFrameNumbers(pack.attack.key, {
          start: 0,
          end: pack.attack.frameCount - 1,
        }),
        frameRate: 12,
        repeat: 0,
      });
    }

    for (const def of Object.values(pack.skillAnims)) {
      const animKey = `skill-${def.key}`;
      if (!scene.textures.exists(def.key) || scene.anims.exists(animKey)) continue;
      scene.anims.create({
        key: animKey,
        frames: scene.anims.generateFrameNumbers(def.key, {
          start: 0,
          end: def.frameCount - 1,
        }),
        frameRate: 12,
        repeat: 0,
      });

      if (def.fx && scene.textures.exists(def.fx.key) && !scene.anims.exists(`fx-${def.fx.key}`)) {
        scene.anims.create({
          key: `fx-${def.fx.key}`,
          frames: scene.anims.generateFrameNumbers(def.fx.key, {
            start: 0,
            end: def.fx.frameCount - 1,
          }),
          frameRate: 8,
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
