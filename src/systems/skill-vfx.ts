import * as Phaser from 'phaser';
import { SKILL_ELEMENT_COLOR } from '@/constants/skill';
import { resolveSkillElement } from '@/data/damage-elements';
import { combatTextDepthForY, vfxDepthForLayer } from '@/constants/render-layers';
import type { SkillDefinition } from '@/types/skill';
import { formatStat } from '@/lib/format-stat';
import type { Decimal } from '@/lib/decimal';

export interface SkillVfxPoints {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

/** Hit-spark curto no alvo — todos os combos básicos (contato). */
export const COMBO_HIT_FX = {
  key: 'fx-combo-hit-7f',
  url: '/sprites/fx/combo-hit.png?v=hit7',
  frameWidth: 69,
  frameHeight: 85,
  frameCount: 7,
  /** Tempo visível de cada frame antes do fade-out. */
  holdMs: 90,
  fadeMs: 50,
} as const;

/**
 * Cruzes de cura do próprio WONSR (efeito 845, usado nos jutsus médicos da
 * Tsunade/Sakura no servidor original).
 */
export const HEAL_FX = {
  key: 'fx-heal-cross',
  url: '/sprites/wonsr/effects/845.png',
  frameWidth: 32,
  frameHeight: 32,
  frameCount: 5,
  animKey: 'fx-heal-cross-anim',
} as const;

/**
 * Animações reutilizáveis por `animation.kind`.
 * Novos jutsus só escolhem kind + tint/scale/duration.
 */
export class SkillVfx {
  private comboHitFrame = 0;
  private activeComboHit: Phaser.GameObjects.Sprite | null = null;

  constructor(private readonly scene: Phaser.Scene) {}

  static preload(scene: Phaser.Scene): void {
    scene.load.spritesheet(COMBO_HIT_FX.key, COMBO_HIT_FX.url, {
      frameWidth: COMBO_HIT_FX.frameWidth,
      frameHeight: COMBO_HIT_FX.frameHeight,
    });
    scene.load.spritesheet(HEAL_FX.key, HEAL_FX.url, {
      frameWidth: HEAL_FX.frameWidth,
      frameHeight: HEAL_FX.frameHeight,
    });
  }

  /** Um frame estático por contato — cicla 0→6 a cada hit. */
  playComboHit(x: number, y: number, scale = 1): void {
    if (!this.scene.textures.exists(COMBO_HIT_FX.key)) return;

    this.activeComboHit?.destroy();
    this.activeComboHit = null;

    const frame = this.comboHitFrame % COMBO_HIT_FX.frameCount;
    this.comboHitFrame += 1;

    const spark = this.scene.add
      .sprite(x, y, COMBO_HIT_FX.key, frame)
      .setOrigin(0.5, 0.5)
      .setDepth(vfxDepthForLayer('front-of-characters', y))
      .setScale(scale);
    this.activeComboHit = spark;

    this.scene.tweens.add({
      targets: spark,
      alpha: 0,
      duration: COMBO_HIT_FX.fadeMs,
      delay: COMBO_HIT_FX.holdMs,
      onComplete: () => {
        if (this.activeComboHit === spark) this.activeComboHit = null;
        spark.destroy();
      },
    });
  }

  play(skill: SkillDefinition, points: SkillVfxPoints): void {
    const tint = skill.animation.tint ?? SKILL_ELEMENT_COLOR[resolveSkillElement(skill)];
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
      case 'heal':
        this.playHeal(points, tint, duration, scale);
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
      .setDepth(vfxDepthForLayer('front-of-characters', points.toY))
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
    orb.setDepth(vfxDepthForLayer('front-of-characters', points.toY));
    this.scene.tweens.add({
      targets: orb,
      x: points.toX,
      y: points.toY - 16,
      duration,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        this.playBurst({ ...points, fromX: points.toX, fromY: points.toY }, tint, 180, scale * 0.8);
        orb.destroy();
      },
    });
  }

  private playBeam(points: SkillVfxPoints, tint: number, duration: number, scale: number): void {
    const line = this.scene.add
      .line(0, 0, points.fromX, points.fromY - 10, points.toX, points.toY - 14, tint, 0.9)
      .setLineWidth(3 * scale)
      .setDepth(vfxDepthForLayer('front-of-characters', points.toY));
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
    arc.setDepth(vfxDepthForLayer('front-of-characters', points.toY));
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
    ring.setDepth(vfxDepthForLayer('front-of-characters', points.toY));
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

  /**
   * Cura: anel de chakra nos pés + cruzes médicas subindo pelo corpo.
   * As cruzes vêm do efeito 845 do WONSR, recoloridas pelo tint do jutsu.
   */
  private playHeal(points: SkillVfxPoints, tint: number, duration: number, scale: number): void {
    const x = points.toX;
    const y = points.toY;

    const ring = this.scene.add.ellipse(x, y, 30 * scale, 12 * scale, tint, 0.18);
    ring.setStrokeStyle(2, tint, 0.85);
    ring.setDepth(vfxDepthForLayer('behind-characters', y));
    this.scene.tweens.add({
      targets: ring,
      scaleX: 2.1,
      scaleY: 2.1,
      alpha: 0,
      duration,
      ease: 'Sine.easeOut',
      onComplete: () => ring.destroy(),
    });

    if (!this.scene.textures.exists(HEAL_FX.key)) return;

    if (!this.scene.anims.exists(HEAL_FX.animKey)) {
      this.scene.anims.create({
        key: HEAL_FX.animKey,
        frames: this.scene.anims.generateFrameNumbers(HEAL_FX.key, {
          start: 0,
          end: HEAL_FX.frameCount - 1,
        }),
        frameRate: 10,
        repeat: -1,
      });
    }

    const count = Math.max(4, Math.round(5 * scale));
    for (let index = 0; index < count; index += 1) {
      const offsetX = Phaser.Math.Between(-16, 16) * scale;
      const cross = this.scene.add
        .sprite(x + offsetX, y - Phaser.Math.Between(0, 14), HEAL_FX.key, 0)
        .setDepth(vfxDepthForLayer('front-of-characters', y))
        .setScale(0.55 * scale)
        .setTint(tint)
        .setAlpha(0);
      cross.play(HEAL_FX.animKey);

      this.scene.tweens.add({
        targets: cross,
        y: cross.y - (34 + 14 * scale),
        alpha: { from: 0, to: 1 },
        duration: duration * 0.55,
        delay: index * 70,
        ease: 'Sine.easeOut',
        onComplete: () => {
          this.scene.tweens.add({
            targets: cross,
            y: cross.y - 12,
            alpha: 0,
            duration: duration * 0.45,
            onComplete: () => cross.destroy(),
          });
        },
      });
    }
  }

  /** "+N" verde subindo do jogador curado (igual ao texto animado do WONSR). */
  healNumber(x: number, y: number, amount: number | Decimal): void {
    const floater = this.scene.add
      .text(x, y - 26, `+${formatStat(amount)}`, {
        fontFamily: 'Tahoma, "Segoe UI", sans-serif',
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#7dffb2',
        stroke: '#06210f',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(combatTextDepthForY(y, 10));

    this.scene.tweens.add({
      targets: floater,
      y: floater.y - 28,
      alpha: 0,
      duration: 750,
      ease: 'Cubic.easeOut',
      onComplete: () => floater.destroy(),
    });
  }

  private playBurst(points: SkillVfxPoints, tint: number, duration: number, scale: number): void {
    const x = points.toX;
    const y = points.toY - 14;
    const core = this.scene.add.circle(x, y, 8 * scale, tint, 0.85).setDepth(vfxDepthForLayer('front-of-characters', y));
    const glow = this.scene.add.circle(x, y, 14 * scale, tint, 0.35).setDepth(vfxDepthForLayer('front-of-characters', y));
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
