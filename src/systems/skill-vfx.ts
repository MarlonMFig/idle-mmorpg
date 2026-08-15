import * as Phaser from 'phaser';
import { SKILL_ELEMENT_COLOR } from '@/constants/skill';
import type { SkillDefinition } from '@/types/skill';

export interface SkillVfxPoints {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

/** Hit-spark curto no alvo — todos os combos básicos. */
export const COMBO_HIT_FX = {
  key: 'fx-combo-hit',
  url: '/sprites/fx/combo-hit.png',
  frameWidth: 48,
  frameHeight: 48,
  frameCount: 5,
  animKey: 'fx-combo-hit-anim',
} as const;

/**
 * Animações reutilizáveis por `animation.kind`.
 * Novos jutsus só escolhem kind + tint/scale/duration.
 */
export class SkillVfx {
  constructor(private readonly scene: Phaser.Scene) {}

  static preload(scene: Phaser.Scene): void {
    scene.load.spritesheet(COMBO_HIT_FX.key, COMBO_HIT_FX.url, {
      frameWidth: COMBO_HIT_FX.frameWidth,
      frameHeight: COMBO_HIT_FX.frameHeight,
    });
  }

  /** Spark pequeno no ponto de impacto do combo (mid-body do alvo). */
  playComboHit(x: number, y: number, scale = 1): void {
    if (!this.scene.textures.exists(COMBO_HIT_FX.key)) return;

    if (!this.scene.anims.exists(COMBO_HIT_FX.animKey)) {
      this.scene.anims.create({
        key: COMBO_HIT_FX.animKey,
        frames: this.scene.anims.generateFrameNumbers(COMBO_HIT_FX.key, {
          start: 0,
          end: COMBO_HIT_FX.frameCount - 1,
        }),
        frameRate: 18,
        repeat: 0,
      });
    }

    const spark = this.scene.add
      .sprite(x, y - 18, COMBO_HIT_FX.key, 0)
      .setDepth(24)
      .setScale(scale)
      .setBlendMode(Phaser.BlendModes.ADD);
    spark.play(COMBO_HIT_FX.animKey);
    spark.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => spark.destroy());
  }

  play(skill: SkillDefinition, points: SkillVfxPoints): void {
    const tint = skill.animation.tint ?? SKILL_ELEMENT_COLOR[skill.element];
    const duration = skill.animation.durationMs ?? 280;
    const scale = skill.animation.scale ?? 1;

    switch (skill.animation.kind) {
      case 'projectile':
        this.playProjectile(points, tint, duration, scale);
        break;
      case 'beam':
        this.playBeam(points, tint, duration, scale);
        break;
      case 'slash':
        this.playSlash(points, tint, duration, scale);
        break;
      case 'aura':
        this.playAura(points, tint, duration, scale);
        break;
      case 'sprite':
        this.playSprite(
          points,
          skill.animation.textureKey,
          skill.animation.frames,
          duration,
          scale,
        );
        break;
      case 'character':
        // Animação no sprite do jogador (ex.: Rasengan) — SkillSystem cuida.
        break;
      case 'burst':
      default:
        this.playBurst(points, tint, duration, scale);
        break;
    }
  }

  private playSprite(
    points: SkillVfxPoints,
    textureKey: string | undefined,
    frameCount: number | undefined,
    duration: number,
    scale: number,
  ): void {
    if (!textureKey || !frameCount || !this.scene.textures.exists(textureKey)) {
      this.playBurst(points, 0xffffff, duration, scale);
      return;
    }

    const animationKey = `${textureKey}-cast`;
    if (!this.scene.anims.exists(animationKey)) {
      this.scene.anims.create({
        key: animationKey,
        frames: this.scene.anims.generateFrameNumbers(textureKey, {
          start: 0,
          end: frameCount - 1,
        }),
        frameRate: Math.max(1, Math.round((frameCount * 1000) / duration)),
        repeat: 0,
      });
    }

    const effect = this.scene.add
      .sprite(points.toX, points.toY - 18, textureKey, 0)
      .setDepth(22)
      .setScale(scale);
    effect.play(animationKey);
    effect.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => effect.destroy());
  }

  private playProjectile(
    points: SkillVfxPoints,
    tint: number,
    duration: number,
    scale: number,
  ): void {
    const orb = this.scene.add.circle(points.fromX, points.fromY - 12, 6 * scale, tint, 0.95);
    orb.setDepth(20);
    this.scene.tweens.add({
      targets: orb,
      x: points.toX,
      y: points.toY - 16,
      duration,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        this.playBurst(
          { ...points, fromX: points.toX, fromY: points.toY },
          tint,
          180,
          scale * 0.8,
        );
        orb.destroy();
      },
    });
  }

  private playBeam(points: SkillVfxPoints, tint: number, duration: number, scale: number): void {
    const line = this.scene.add
      .line(0, 0, points.fromX, points.fromY - 10, points.toX, points.toY - 14, tint, 0.9)
      .setLineWidth(3 * scale)
      .setDepth(20);
    this.scene.tweens.add({
      targets: line,
      alpha: 0,
      duration,
      onComplete: () => line.destroy(),
    });
  }

  private playSlash(points: SkillVfxPoints, tint: number, duration: number, scale: number): void {
    const arc = this.scene.add.arc(
      points.toX,
      points.toY - 18,
      18 * scale,
      -40,
      40,
      false,
      tint,
      0.55,
    );
    arc.setDepth(20);
    this.scene.tweens.add({
      targets: arc,
      scaleX: 1.4,
      scaleY: 1.4,
      alpha: 0,
      duration,
      onComplete: () => arc.destroy(),
    });
  }

  private playAura(points: SkillVfxPoints, tint: number, duration: number, scale: number): void {
    const ring = this.scene.add.circle(points.toX, points.toY - 12, 10 * scale, tint, 0.2);
    ring.setStrokeStyle(2 * scale, tint, 0.9);
    ring.setDepth(19);
    this.scene.tweens.add({
      targets: ring,
      scaleX: 2.2,
      scaleY: 2.2,
      alpha: 0,
      duration,
      ease: 'Sine.easeOut',
      onComplete: () => ring.destroy(),
    });
  }

  private playBurst(points: SkillVfxPoints, tint: number, duration: number, scale: number): void {
    const x = points.toX;
    const y = points.toY - 14;
    const core = this.scene.add.circle(x, y, 8 * scale, tint, 0.85).setDepth(20);
    const glow = this.scene.add.circle(x, y, 14 * scale, tint, 0.35).setDepth(19);
    this.scene.tweens.add({
      targets: [core, glow],
      scaleX: 1.8,
      scaleY: 1.8,
      alpha: 0,
      duration,
      onComplete: () => {
        core.destroy();
        glow.destroy();
      },
    });
  }
}
