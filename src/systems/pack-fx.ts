import * as Phaser from 'phaser';
import { CHARACTER_DISPLAY_HEIGHT } from '@/constants/sprites';
import type { CharacterSkillAnimDef } from '@/data/character-packs';
import type { Player } from '@/entities/player';

export interface PackFxOptions {
  ground?: boolean;
  bodyH?: number;
  fxH?: number;
  blend?: 'normal' | 'add';
  scaleMult?: number;
  originX?: number;
}

/** Altura do corpo do caster em px de mundo (acompanha o layoutScale do mapa). */
function bodyLiftOf(caster: Player): number {
  return CHARACTER_DISPLAY_HEIGHT * caster.worldScale;
}

/**
 * Sobe o FX até a base encostar no piso. Sem isto um efeito grande — a escala
 * segue o `layoutScale` do mapa — nasce centrado nos pés e some no chão.
 */
function clampAboveFloor(fx: Phaser.GameObjects.Sprite, feetY: number, bodyLift: number): void {
  const maxCenterY = feetY + bodyLift * 0.1 - fx.displayHeight / 2;
  fx.y = Math.min(fx.y, maxCenterY);
}

/**
 * Cria a animação só com frames reais. `generateFrameNumbers` vazio ainda
 * registra a key no Phaser — e `play()` estoura em `duration` undefined.
 */
function ensureSpriteAnim(
  scene: Phaser.Scene,
  key: string,
  textureKey: string,
  start: number,
  end: number,
  frameRate: number,
  repeat: number,
): boolean {
  if (end < start) return false;
  const frames = scene.anims.generateFrameNumbers(textureKey, { start, end });
  if (!frames.length) {
    if (scene.anims.exists(key)) scene.anims.remove(key);
    return false;
  }
  if (scene.anims.exists(key)) {
    const existing = scene.anims.get(key);
    if (existing && existing.frames.length > 0) return true;
    scene.anims.remove(key);
  }
  scene.anims.create({ key, frames, frameRate, repeat });
  return true;
}

/** Toca animação só se ela tiver frames; nunca deixa o update do combate cair. */
function safePlay(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Sprite,
  animKey: string,
): boolean {
  const anim = scene.anims.get(animKey);
  if (!anim || anim.frames.length === 0) return false;
  try {
    sprite.play(animKey);
    return true;
  } catch (error) {
    console.warn(`[PackFx] animação inválida: ${animKey}`, error);
    if (scene.anims.exists(animKey)) scene.anims.remove(animKey);
    return false;
  }
}

/** FX parado (flash / chama / poeira) no ponto indicado, na escala do caster. */
export function playPackFx(
  scene: Phaser.Scene,
  caster: Player,
  textureKey: string,
  x: number,
  y: number,
  opts?: PackFxOptions,
): void {
  const animKey = `fx-${textureKey}`;
  if (!scene.textures.exists(textureKey)) return;

  const ground = opts?.ground === true;
  // Native FX sheets stay 1:1 pixels; fit to the character body so a 200px
  // burst does not tower over a 50px Asta (Phaser nearest, no sheet downsample).
  const bodyH = opts?.bodyH ?? 0;
  const fxH = opts?.fxH ?? 0;
  const tex = scene.textures.get(textureKey);
  const frame = tex.get(0);
  const fxW = frame && typeof frame.width === 'number' ? frame.width : 0;
  const fitH = bodyH > 0 && fxH > bodyH * 1.35 ? Math.min(1, (bodyH * 1.85) / fxH) : 1;
  // Jato de fogo / beam: largo por natureza, mas não pode varrer a tela.
  const fitW = bodyH > 0 && fxW > bodyH * 2.8 ? Math.min(1, (bodyH * 3.2) / fxW) : 1;
  const fit = Math.min(fitH, fitW);
  const scaleMult = opts?.scaleMult && opts.scaleMult > 0 ? opts.scaleMult : 1;
  // Ground kick dust / rock slam sits at feet (origin bottom); flash is mid-body.
  const bodyLift = bodyLiftOf(caster);
  const fx = scene.add.sprite(x, ground ? y : y - bodyLift * 0.5, textureKey, 0);
  // O eixo MUGEN marca de onde o efeito sai (boca, mão). Espelha junto com o
  // caster, senão o jato nasce nas costas quando ele olha para a esquerda.
  const facingLeft = caster.sprite.flipX;
  const originX = opts?.originX ?? 0.5;
  fx.setOrigin(facingLeft ? 1 - originX : originX, ground ? 1 : 0.5);
  fx.setFlipX(facingLeft);
  fx.setDepth(22);
  fx.setScale(caster.sprite.scaleX * (ground ? 1.05 : 1.15) * fit * scaleMult);
  if (!ground) clampAboveFloor(fx, y, bodyLift);
  if (opts?.blend === 'add') {
    fx.setBlendMode(Phaser.BlendModes.ADD);
  }

  const sheetFrames = tex.getFrameNames().filter((name) => name !== '__BASE').length;
  if (!scene.anims.exists(animKey) && sheetFrames > 1) {
    ensureSpriteAnim(scene, animKey, textureKey, 0, sheetFrames - 1, 12, 0);
  }

  if (scene.anims.exists(animKey)) {
    fx.play(animKey);
    // Single-frame hold/fade; multi-frame plays through then destroys.
    if (sheetFrames <= 1) {
      scene.tweens.add({
        targets: fx,
        alpha: 0,
        scaleX: fx.scaleX * 1.12,
        scaleY: fx.scaleY * 1.12,
        duration: 320,
        delay: ground ? 40 : 90,
        onComplete: () => fx.destroy(),
      });
    } else {
      fx.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => fx.destroy());
    }
  } else {
    scene.tweens.add({
      targets: fx,
      alpha: 0,
      scale: 1.2,
      duration: 280,
      onComplete: () => fx.destroy(),
    });
  }
}

/**
 * Projétil com frames de voo em loop, depois strip de impacto no alvo.
 * Usado no arremesso de pedra do Jirobo (fxFlightFrameCount).
 */
export function playPackThrowFx(
  scene: Phaser.Scene,
  caster: Player,
  fxDef: { key: string; frameCount: number },
  flightFrameCount: number,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  travelMs: number,
  opts?: { rotate?: boolean; flip?: boolean; bodyH?: number; fxH?: number },
): void {
  const textureKey = fxDef.key;
  if (!scene.textures.exists(textureKey)) return;

  const flightEnd = Math.max(0, Math.min(flightFrameCount, fxDef.frameCount) - 1);
  const flightAnimKey = `fx-${textureKey}-flight`;
  const impactAnimKey = `fx-${textureKey}-impact`;

  ensureSpriteAnim(scene, flightAnimKey, textureKey, 0, flightEnd, 10, -1);
  if (flightFrameCount < fxDef.frameCount) {
    ensureSpriteAnim(
      scene,
      impactAnimKey,
      textureKey,
      flightFrameCount,
      fxDef.frameCount - 1,
      12,
      0,
    );
  }

  const bodyLift = bodyLiftOf(caster);
  const startX = fromX + (toX >= fromX ? 10 : -10);
  const startY = fromY - bodyLift * 0.5;
  const endX = toX;
  const endY = toY - bodyLift * 0.45;

  const bodyH = opts?.bodyH ?? 0;
  const fxH = opts?.fxH ?? 0;
  const fit = bodyH > 0 && fxH > bodyH * 1.35 ? Math.min(1, (bodyH * 1.85) / fxH) : 1;

  const rock = scene.add.sprite(startX, startY, textureKey, 0);
  rock.setOrigin(0.5, 0.5);
  rock.setDepth(22);
  rock.setScale(caster.sprite.scaleX * 1.2 * fit);
  clampAboveFloor(rock, fromY, bodyLift);
  const landingY = Math.min(endY, toY + bodyLift * 0.1 - rock.displayHeight / 2);
  if (opts?.flip) {
    rock.setFlipX(endX < startX);
  } else if (opts?.rotate !== false) {
    const angle = Phaser.Math.Angle.Between(startX, startY, endX, endY);
    rock.setRotation(angle);
  }

  safePlay(scene, rock, flightAnimKey);

  scene.tweens.add({
    targets: rock,
    x: endX,
    y: landingY,
    duration: travelMs,
    ease: 'Cubic.easeIn',
    onComplete: () => {
      if (!rock.active) return;
      rock.setRotation(0);
      if (safePlay(scene, rock, impactAnimKey)) {
        rock.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => rock.destroy());
      } else {
        scene.tweens.add({
          targets: rock,
          alpha: 0,
          duration: 200,
          onComplete: () => rock.destroy(),
        });
      }
    },
  });
}

/**
 * Agenda o FX de uma folha de jutsu: projétil (com voo), efeito no alvo/caster
 * e o secundário de impacto. Mesma rotina para o líder e para os aliados.
 */
export function scheduleSkillFx(
  scene: Phaser.Scene,
  caster: Player,
  anim: CharacterSkillAnimDef,
  hitDelay: number,
  from: { x: number; y: number },
  to: { x: number; y: number },
): void {
  if (anim.fx) {
    const flightN = anim.fxFlightFrameCount ?? 0;
    if (flightN > 0) {
      // Projétil só sai no frame de arremesso (nunca no wind-up / levantar).
      const releaseAt = anim.fxReleaseMs ?? Math.max(0, Math.floor(hitDelay * 0.72));
      // Chega no (ou logo antes do) hitDelay — sem estourar o impact cedo no alvo.
      const travelMs = Math.max(140, hitDelay - releaseAt);
      scene.time.delayedCall(releaseAt, () => {
        try {
          playPackThrowFx(scene, caster, anim.fx!, flightN, from.x, from.y, to.x, to.y, travelMs, {
            rotate: anim.fxFlightRotate !== false && !anim.fxFlightFlip,
            flip: Boolean(anim.fxFlightFlip),
            bodyH: anim.contentHeight,
            fxH: anim.fx!.contentHeight ?? anim.fx!.frameHeight,
          });
        } catch (error) {
          console.warn('[PackFx] falha no FX de projétil', error);
        }
      });
    } else {
      const releaseAt = anim.fxReleaseMs ?? Math.max(0, hitDelay - 80);
      const attach = anim.fxAttach ?? 'target';
      const fxX = attach === 'caster' ? from.x : to.x;
      const fxY = attach === 'caster' ? from.y : to.y;
      scene.time.delayedCall(releaseAt, () => {
        playPackFx(scene, caster, anim.fx!.key, fxX, fxY, {
          ground: anim.fxGround ?? attach === 'caster',
          bodyH: anim.contentHeight,
          fxH: anim.fx!.contentHeight ?? anim.fx!.frameHeight,
          scaleMult: anim.fxScale,
          originX: anim.fx!.originX,
          blend: anim.fxBlend,
        });
      });
    }
  }

  if (anim.fxSecondary) {
    const releaseAt = anim.fxSecondaryReleaseMs ?? hitDelay;
    const attach = anim.fxSecondaryAttach ?? 'caster';
    // Re-read live feet at impact (o caster pode ter avançado durante o cast).
    scene.time.delayedCall(releaseAt, () => {
      const fxX = attach === 'caster' ? caster.x : to.x;
      const fxY = attach === 'caster' ? caster.y : to.y;
      playPackFx(scene, caster, anim.fxSecondary!.key, fxX, fxY, {
        ground: attach === 'caster',
        bodyH: anim.contentHeight,
        fxH: anim.fxSecondary!.contentHeight ?? anim.fxSecondary!.frameHeight,
      });
    });
  }
}
