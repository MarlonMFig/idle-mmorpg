import * as Phaser from 'phaser';
import { CHARACTER_DISPLAY_HEIGHT } from '@/constants/sprites';
import { RENDER_LAYER, vfxDepthForLayer } from '@/constants/render-layers';
import { PACK_FX_MID_BODY_FACTOR, packFxDisplayScale, packFxFitScale } from '@/lib/pack-fx-scale';
import type { CharacterSkillAnimDef } from '@/data/character-packs';
import { getVfxDefinition } from '@/data/vfx/registry';
import type { VfxRenderLayer } from '@/data/vfx/types';
import type { Player } from '@/entities/player';
import { DEFAULT_TRAVEL_SPEED_PX } from '@/lib/dev/lab-save-fields';
import { officialSkillDurationMs } from '@/data/skill-execution-def';
import {
  canonicalizeLoopMode,
  clampLoopRange,
  loopModeFromLegacy,
  resolvePersistentLoopDuration,
} from '@/lib/frame-loop';
import { logVfxLifecycle } from '@/lib/vfx-lifecycle-log';
import { characterLabStore, isCharacterLabSession } from '@/stores/character-lab-store';

export interface PackFxOptions {
  ground?: boolean;
  bodyH?: number;
  fxH?: number;
  blend?: 'normal' | 'add';
  scaleMult?: number;
  originX?: number;
  originY?: number;
  offsetX?: number;
  offsetY?: number;
  independentScale?: boolean;
  frameRate?: number;
  frameCount?: number;
  loop?: boolean;
  loopMode?: 'none' | 'full' | 'range' | 'persistent-range';
  loopStartFrame?: number;
  loopEndFrame?: number;
  loopDurationMs?: number;
  loopUntilSkillEnd?: boolean;
  skillDurationMs?: number;
  flipX?: boolean;
  flipY?: boolean;
  vfxId?: string | null;
  renderLayer?: VfxRenderLayer;
  onEffectStart?: () => void;
  onArrival?: () => void;
  onSpawn?: (sprite: Phaser.GameObjects.Sprite) => void;
  /** Mantém o sprite até o caller destruir (beam / persistent). */
  persist?: boolean;
}

export interface SkillFxHooks {
  onEffectStart?: () => void;
  onArrival?: () => void;
  onSpawn?: (sprite: Phaser.GameObjects.Sprite) => void;
  persist?: boolean;
}

/** Pontos de mira do VFX (centros visuais). Offsets vêm de `anim.targeting`. */
export interface SkillFxAim {
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
}

export function computeSkillFxAim(
  caster: Player,
  target: { sprite: Phaser.GameObjects.Sprite } | null,
): SkillFxAim {
  const start = caster.sprite.getBounds();
  const dest = target?.sprite.getBounds();
  return {
    startX: start.centerX,
    startY: start.centerY,
    targetX: dest?.centerX ?? caster.x + 80 * caster.worldScale,
    targetY: dest?.centerY ?? caster.y,
  };
}

const labTimers: Phaser.Time.TimerEvent[] = [];
const labTweens: Phaser.Tweens.Tween[] = [];
const labSprites: Phaser.GameObjects.Sprite[] = [];

function trackLabTimer(timer: Phaser.Time.TimerEvent): Phaser.Time.TimerEvent {
  if (isCharacterLabSession()) labTimers.push(timer);
  return timer;
}

function trackLabTween(tween: Phaser.Tweens.Tween): Phaser.Tweens.Tween {
  if (isCharacterLabSession()) labTweens.push(tween);
  return tween;
}

function trackLabSprite(sprite: Phaser.GameObjects.Sprite): Phaser.GameObjects.Sprite {
  if (isCharacterLabSession()) labSprites.push(sprite);
  return sprite;
}

/** Cancela VFX/tweens/timers do Test Lab (reset, troca de skill, fechar). */
export function clearLabForcedFx(): void {
  for (const timer of labTimers) timer.remove(false);
  labTimers.length = 0;
  for (const tween of labTweens) {
    try {
      tween.stop();
    } catch {
      // ignore
    }
  }
  labTweens.length = 0;
  for (const sprite of labSprites) {
    if (sprite.active) sprite.destroy();
  }
  labSprites.length = 0;
  if (isCharacterLabSession()) characterLabStore.setActiveVfx(null);
}

function applyFxDepth(
  fx: Phaser.GameObjects.Sprite,
  y: number,
  vfxId?: string | null,
  renderLayer?: VfxRenderLayer,
): void {
  const catalog = vfxId ? getVfxDefinition(vfxId) : null;
  fx.setDepth(vfxDepthForLayer(renderLayer ?? catalog?.renderLayer, y));
}

function noteLabVfx(textureKey: string, sprite: Phaser.GameObjects.Sprite): void {
  if (!isCharacterLabSession()) return;
  characterLabStore.setActiveVfx(textureKey);
  sprite.once(Phaser.GameObjects.Events.DESTROY, () => {
    if (characterLabStore.getSnapshot().activeVfxKey === textureKey) {
      characterLabStore.setActiveVfx(null);
    }
  });
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
  if (fx.displayHeight > bodyLift * 1.2) return;
  const belowOrigin = fx.displayHeight * (1 - fx.originY);
  const maxCenterY = feetY + bodyLift * 0.1 - belowOrigin;
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
  if (!scene.sys?.isActive() || !caster.sprite) return;
  const animKey = `fx-${textureKey}`;
  if (!scene.textures.exists(textureKey)) {
    logVfxLifecycle('spawn failed', {
      reason: 'asset 404',
      key: textureKey,
      vfxId: opts?.vfxId ?? null,
    });
    return;
  }

  const ground = opts?.ground === true;
  // Native FX sheets stay 1:1 pixels; fit to the character body so a 200px
  // burst does not tower over a 50px Asta (Phaser nearest, no sheet downsample).
  const bodyH = opts?.bodyH ?? 0;
  const fxH = opts?.fxH ?? 0;
  const tex = scene.textures.get(textureKey);
  const frame = tex.get(0);
  const fxW = frame && typeof frame.width === 'number' ? frame.width : 0;
  const scaleMult = opts?.scaleMult && opts.scaleMult > 0 ? opts.scaleMult : 1;
  // Ground kick dust / rock slam sits at feet (origin bottom); flash is mid-body.
  const bodyLift = bodyLiftOf(caster);
  const spawned = scene.add.sprite(x, ground ? y : y - bodyLift * PACK_FX_MID_BODY_FACTOR, textureKey, 0);
  if (!spawned) {
    logVfxLifecycle('spawn failed', {
      reason: 'sprite factory',
      key: textureKey,
      vfxId: opts?.vfxId ?? null,
    });
    return;
  }
  const fx = trackLabSprite(spawned);
  // O eixo MUGEN marca de onde o efeito sai (boca, mão). Espelha junto com o
  // caster, senão o jato nasce nas costas quando ele olha para a esquerda.
  const facingLeft = caster.sprite.flipX;
  const originX = opts?.originX ?? 0.5;
  const originY = opts?.originY ?? (ground ? 1 : 0.5);
  const offsetX = (opts?.offsetX ?? 0) * (facingLeft ? -1 : 1);
  const offsetY = opts?.offsetY ?? 0;
  fx.x += offsetX;
  fx.y += offsetY;
  fx.setOrigin(facingLeft ? 1 - originX : originX, originY);
  fx.setFlipX(Boolean(facingLeft) !== Boolean(opts?.flipX));
  fx.setFlipY(Boolean(opts?.flipY));
  applyFxDepth(fx, fx.y, opts?.vfxId, opts?.renderLayer);
  noteLabVfx(textureKey, fx);
  opts?.onSpawn?.(fx);
  logVfxLifecycle('spawn', { key: textureKey, vfxId: opts?.vfxId ?? null });
  opts?.onEffectStart?.();
  opts?.onArrival?.();
  if (isCharacterLabSession() && characterLabStore.getSnapshot().showVfxOrigin) {
    const mark = scene.add.circle(fx.x, fx.y, 4, 0x66d4ff, 0.95).setDepth(RENDER_LAYER.ui + 1);
    scene.time.delayedCall(700, () => mark.destroy());
  }
  fx.setScale(
    packFxDisplayScale({
      bodyH: bodyH,
      fxW: fxW,
      fxH: fxH,
      casterSpriteScaleX: caster.sprite.scaleX,
      scaleMult: scaleMult,
      ground,
      independentScale: opts?.independentScale === true,
      worldScale: caster.worldScale,
    }),
  );
  if (!ground) clampAboveFloor(fx, y, bodyLift);
  if (opts?.blend === 'add') {
    fx.setBlendMode(Phaser.BlendModes.ADD);
  }

  const sheetFrames = tex.getFrameNames().filter((name) => name !== '__BASE').length;
  const playFrames =
    opts?.frameCount && opts.frameCount > 0 ? Math.min(opts.frameCount, sheetFrames) : sheetFrames;
  const fps = opts?.frameRate && opts.frameRate > 0 ? opts.frameRate : 12;
  const persist = opts?.persist === true;
  const loopMode = canonicalizeLoopMode(opts?.loopMode) ?? loopModeFromLegacy(opts?.loop);
  const range = clampLoopRange(playFrames, opts?.loopStartFrame ?? 1, opts?.loopEndFrame ?? playFrames);
  const start0 = range.startFrame - 1;
  const end0 = range.endFrame - 1;

  const playOnceThenDestroy = () => {
    fx.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      logVfxLifecycle('animation finished', { key: textureKey });
      logVfxLifecycle('cleanup', { key: textureKey });
      fx.destroy();
    });
  };

  if (playFrames > 1 && loopMode === 'persistent-range') {
    const firstKey = `fx-${textureKey}-first-${playFrames}`;
    const loopKey = `fx-${textureKey}-ploop-${start0}-${end0}`;
    if (scene.anims.exists(firstKey)) scene.anims.remove(firstKey);
    ensureSpriteAnim(scene, firstKey, textureKey, 0, playFrames - 1, fps, 0);
    if (scene.anims.exists(loopKey)) scene.anims.remove(loopKey);
    ensureSpriteAnim(scene, loopKey, textureKey, start0, end0, fps, -1);
    const startPersistentLoop = () => {
      if (!fx.active) return;
      if (!safePlay(scene, fx, loopKey)) {
        if (!persist) fx.destroy();
        return;
      }
      const resolved = resolvePersistentLoopDuration({
        durationMs: opts?.loopDurationMs,
        untilSkillEnd: Boolean(opts?.loopUntilSkillEnd) || persist,
        skillDurationMs: opts?.skillDurationMs,
      });
      if (persist) return;
      if (resolved.untilSkillEnd && resolved.durationMs <= 0) return;
      if (resolved.durationMs > 0) {
        scene.time.delayedCall(resolved.durationMs, () => {
          if (fx.active) fx.destroy();
        });
      }
    };
    if (!safePlay(scene, fx, firstKey)) {
      startPersistentLoop();
    } else {
      fx.once(Phaser.Animations.Events.ANIMATION_COMPLETE, startPersistentLoop);
    }
    return;
  }

  const repeat = persist || loopMode === 'full' ? -1 : 0;
  if (playFrames > 1) {
    const existing = scene.anims.exists(animKey) ? scene.anims.get(animKey) : null;
    const needsRebuild =
      !existing ||
      existing.frames.length !== playFrames ||
      existing.frameRate !== fps ||
      existing.repeat !== repeat;
    if (needsRebuild) {
      if (scene.anims.exists(animKey)) scene.anims.remove(animKey);
      ensureSpriteAnim(scene, animKey, textureKey, 0, playFrames - 1, fps, repeat);
    }
  }

  if (scene.anims.exists(animKey)) {
    if (!safePlay(scene, fx, animKey)) {
      if (!persist) fx.destroy();
      return;
    }
    if (persist) return;
    if (sheetFrames <= 1 || playFrames <= 1) {
      trackLabTween(
        scene.tweens.add({
          targets: fx,
          alpha: 0,
          scaleX: fx.scaleX * 1.12,
          scaleY: fx.scaleY * 1.12,
          duration: 320,
          delay: ground ? 40 : 90,
          onComplete: () => fx.destroy(),
        }),
      );
    } else if (loopMode === 'full') {
      return;
    } else {
      playOnceThenDestroy();
    }
  } else if (persist) {
    return;
  } else {
    trackLabTween(
      scene.tweens.add({
        targets: fx,
        alpha: 0,
        scale: 1.2,
        duration: 280,
        onComplete: () => fx.destroy(),
      }),
    );
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
  opts?: { rotate?: boolean; flip?: boolean; bodyH?: number; fxH?: number; vfxId?: string | null; hooks?: SkillFxHooks },
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
  const fit = packFxFitScale(bodyH, 0, fxH);

  const rock = trackLabSprite(scene.add.sprite(startX, startY, textureKey, 0));
  rock.setOrigin(0.5, 0.5);
  applyFxDepth(rock, endY, opts?.vfxId);
  noteLabVfx(textureKey, rock);
  opts?.hooks?.onSpawn?.(rock);
  opts?.hooks?.onEffectStart?.();
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

  trackLabTween(
    scene.tweens.add({
      targets: rock,
      x: endX,
      y: landingY,
      duration: travelMs,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        opts?.hooks?.onArrival?.();
        if (!rock.active) return;
        rock.setRotation(0);
        if (safePlay(scene, rock, impactAnimKey)) {
          rock.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => rock.destroy());
        } else {
          trackLabTween(
            scene.tweens.add({
              targets: rock,
              alpha: 0,
              duration: 200,
              onComplete: () => rock.destroy(),
            }),
          );
        }
      },
    }),
  );
}

function labDelay(scene: Phaser.Scene, delay: number, fn: () => void): void {
  trackLabTimer(
    scene.time.delayedCall(delay, () => {
      if (!scene.sys?.isActive()) return;
      try {
        fn();
      } catch (error) {
        console.warn('[PackFx] falha no VFX agendado', error);
      }
    }),
  );
}

function labTravelMs(distance: number, speedPx: number): number {
  if (speedPx <= 0) return 0;
  return Math.max(0, Math.round((distance / speedPx) * 1000));
}

function resolveAim(
  anim: CharacterSkillAnimDef,
  aim: SkillFxAim | null | undefined,
  from: { x: number; y: number },
  to: { x: number; y: number },
): { spawnX: number; spawnY: number; destX: number; destY: number; facingLeft: boolean } {
  const targeting = anim.targeting;
  const startX = aim?.startX ?? from.x;
  const startY = aim?.startY ?? from.y;
  const targetX = aim?.targetX ?? to.x;
  const targetY = aim?.targetY ?? to.y;
  const facingLeft = targetX < startX;
  const spawnX = startX + (targeting?.spawnOffsetX ?? 0) * (facingLeft ? -1 : 1);
  const spawnY = startY + (targeting?.spawnOffsetY ?? 0);
  const destX = targetX + (targeting?.targetOffsetX ?? 0);
  const destY = targetY + (targeting?.targetOffsetY ?? 0);
  return { spawnX, spawnY, destX, destY, facingLeft };
}

function playTravelFx(
  scene: Phaser.Scene,
  caster: Player,
  anim: CharacterSkillAnimDef,
  spawnX: number,
  spawnY: number,
  destX: number,
  destY: number,
  travelMs: number,
  hooks?: SkillFxHooks,
): void {
  const fxDef = anim.fx;
  if (!fxDef) return;
  const textureKey = fxDef.key;
  if (!scene.textures.exists(textureKey)) {
    logVfxLifecycle('spawn failed', {
      reason: 'asset 404',
      key: textureKey,
      vfxId: anim.vfxId ?? null,
    });
    return;
  }

  const facingLeft = destX < spawnX;
  const originX = fxDef.originX ?? 0.5;
  const visualX = (fxDef.offsetX ?? 0) * (facingLeft ? -1 : 1);
  const visualY = fxDef.offsetY ?? 0;
  const instant = travelMs <= 0;
  const startX = (instant ? destX : spawnX) + visualX;
  const startY = (instant ? destY : spawnY) + visualY;
  const endX = destX + visualX;
  const endY = destY + visualY;

  const bodyH = anim.contentHeight ?? 0;
  const fxH = fxDef.contentHeight ?? fxDef.frameHeight;
  const tex = scene.textures.get(textureKey);
  const frame = tex.get(0);
  const fxW = frame && typeof frame.width === 'number' ? frame.width : 0;
  const scaleMult = anim.fxScale && anim.fxScale > 0 ? anim.fxScale : 1;

  const fx = trackLabSprite(scene.add.sprite(startX, startY, textureKey, 0));
  fx.setOrigin(facingLeft ? 1 - originX : originX, 0.5);
  fx.setFlipX(facingLeft);
  applyFxDepth(fx, endY, anim.vfxId);
  noteLabVfx(textureKey, fx);
  hooks?.onSpawn?.(fx);
  hooks?.onEffectStart?.();
  fx.setScale(
    packFxDisplayScale({
      bodyH: bodyH,
      fxW: fxW,
      fxH: fxH,
      casterSpriteScaleX: caster.sprite.scaleX,
      scaleMult: scaleMult,
      independentScale: Boolean(anim.fxIndependentScale),
      worldScale: caster.worldScale,
    }),
  );
  if (anim.fxBlend === 'add') fx.setBlendMode(Phaser.BlendModes.ADD);

  const travelKey = `fx-${textureKey}-lab-travel`;
  const snapKey = `fx-${textureKey}-lab-snap`;
  const sheetFrames = tex.getFrameNames().filter((name) => name !== '__BASE').length;
  const playFrames =
    anim.vfxId && fxDef.frameCount > 0 ? Math.min(fxDef.frameCount, sheetFrames) : sheetFrames;
  const fps = fxDef.frameRate && fxDef.frameRate > 0 ? fxDef.frameRate : 12;
  if (playFrames > 1) {
    ensureSpriteAnim(scene, travelKey, textureKey, 0, playFrames - 1, fps, -1);
    ensureSpriteAnim(scene, snapKey, textureKey, 0, playFrames - 1, fps, 0);
  }

  const fadeOut = () => {
    if (!fx.active) return;
    trackLabTween(
      scene.tweens.add({
        targets: fx,
        alpha: 0,
        duration: 180,
        onComplete: () => {
          logVfxLifecycle('cleanup', { key: textureKey, reason: 'fade' });
          fx.destroy();
        },
      }),
    );
  };

  const playOnceThenDestroy = () => {
    if (!fx.active) return;
    if (scene.anims.exists(snapKey) && playFrames > 1) {
      fx.anims.stop();
      if (safePlay(scene, fx, snapKey)) {
        fx.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
          logVfxLifecycle('animation finished', { key: textureKey });
          logVfxLifecycle('cleanup', { key: textureKey });
          fx.destroy();
        });
        return;
      }
    }
    fadeOut();
  };

  const persist = hooks?.persist === true;
  const holdAtDest = () => {
    if (!fx.active) return;
    if (scene.anims.exists(travelKey) && playFrames > 1) safePlay(scene, fx, travelKey);
  };

  if (instant) {
    hooks?.onArrival?.();
    logVfxLifecycle('arrival', { key: textureKey, mode: 'instant' });
    if (persist) {
      holdAtDest();
      return;
    }
    if (scene.anims.exists(snapKey) && playFrames > 1 && safePlay(scene, fx, snapKey)) {
      fx.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        logVfxLifecycle('animation finished', { key: textureKey });
        logVfxLifecycle('cleanup', { key: textureKey });
        fx.destroy();
      });
      return;
    }
    fadeOut();
    return;
  }

  if (scene.anims.exists(travelKey)) safePlay(scene, fx, travelKey);
  trackLabTween(
    scene.tweens.add({
      targets: fx,
      x: endX,
      y: endY,
      duration: travelMs,
      ease: 'Linear',
      onComplete: () => {
        logVfxLifecycle('arrival', { key: textureKey, mode: 'travel' });
        hooks?.onArrival?.();
        if (persist) {
          holdAtDest();
          return;
        }
        playOnceThenDestroy();
      },
    }),
  );
}

function scheduleTargetedPrimary(
  scene: Phaser.Scene,
  caster: Player,
  anim: CharacterSkillAnimDef,
  hitDelay: number,
  from: { x: number; y: number },
  to: { x: number; y: number },
  aim: SkillFxAim | null | undefined,
  instant: boolean,
  hooks?: SkillFxHooks,
): void {
  const resolved = resolveAim(anim, aim, from, to);
  const speedPx = instant ? 0 : (anim.targeting?.travelSpeed ?? DEFAULT_TRAVEL_SPEED_PX);
  const distance = Phaser.Math.Distance.Between(resolved.spawnX, resolved.spawnY, resolved.destX, resolved.destY);
  const travelMs = instant ? 0 : labTravelMs(distance, speedPx);
  if (isCharacterLabSession()) {
    characterLabStore.setTravelDebug({
      forceOn: true,
      mode: instant ? 'instant-target' : 'travel-to-target',
      startX: Math.round(resolved.spawnX),
      startY: Math.round(resolved.spawnY),
      targetX: Math.round(resolved.destX),
      targetY: Math.round(resolved.destY),
      distance: Math.round(distance),
      speedPx,
      estimatedImpactMs: travelMs,
      note: instant ? 'targetMode: instant-target' : 'targetMode: travel-to-target',
    });
  }

  const flightN = anim.fxFlightFrameCount ?? 0;
  const releaseAt =
    flightN > 0
      ? (anim.fxReleaseMs ?? Math.max(0, Math.floor(hitDelay * 0.72)))
      : (anim.fxReleaseMs ?? Math.max(0, hitDelay - 80));

  labDelay(scene, releaseAt, () => {
    try {
      if (flightN > 0 && !instant) {
        playPackThrowFx(
          scene,
          caster,
          anim.fx!,
          flightN,
          resolved.spawnX,
          resolved.spawnY,
          resolved.destX,
          resolved.destY,
          travelMs,
          {
            rotate: anim.fxFlightRotate !== false && !anim.fxFlightFlip,
            flip: true,
            bodyH: anim.contentHeight,
            fxH: anim.fx!.contentHeight ?? anim.fx!.frameHeight,
            vfxId: anim.vfxId,
            hooks,
          },
        );
      } else {
        playTravelFx(scene, caster, anim, resolved.spawnX, resolved.spawnY, resolved.destX, resolved.destY, travelMs, hooks);
      }
    } catch (error) {
      console.warn('[PackFx] falha no VFX direcionado', error);
    }
  });
}

function scheduleLegacyPrimary(
  scene: Phaser.Scene,
  caster: Player,
  anim: CharacterSkillAnimDef,
  hitDelay: number,
  from: { x: number; y: number },
  to: { x: number; y: number },
  aim: SkillFxAim | null | undefined,
  hooks?: SkillFxHooks,
): void {
  const flightN = anim.fxFlightFrameCount ?? 0;
  if (flightN > 0) {
    const releaseAt = anim.fxReleaseMs ?? Math.max(0, Math.floor(hitDelay * 0.72));
    const speed = anim.targeting?.travelSpeed;
    const resolved = resolveAim(anim, aim, from, to);
    const distance = Phaser.Math.Distance.Between(resolved.spawnX, resolved.spawnY, resolved.destX, resolved.destY);
    const travelMs =
      speed && speed > 0 ? labTravelMs(distance, speed) : Math.max(140, hitDelay - releaseAt);
    labDelay(scene, releaseAt, () => {
      try {
        playPackThrowFx(scene, caster, anim.fx!, flightN, from.x, from.y, to.x, to.y, travelMs, {
          rotate: anim.fxFlightRotate !== false && !anim.fxFlightFlip,
          flip: Boolean(anim.fxFlightFlip),
          bodyH: anim.contentHeight,
          fxH: anim.fx!.contentHeight ?? anim.fx!.frameHeight,
          vfxId: anim.vfxId,
          hooks,
        });
      } catch (error) {
        console.warn('[PackFx] falha no FX de projétil', error);
      }
    });
    return;
  }

  const releaseAt = anim.fxReleaseMs ?? Math.max(0, hitDelay - 80);
  const attach = anim.fxAttach ?? 'target';
  const resolved = resolveAim(anim, aim, from, to);
  const fxX = attach === 'caster' ? resolved.spawnX : to.x;
  const fxY = attach === 'caster' ? resolved.spawnY : to.y;
  labDelay(scene, releaseAt, () => {
    playPackFx(scene, caster, anim.fx!.key, fxX, fxY, {
      ground: anim.fxGround ?? attach === 'caster',
      bodyH: anim.contentHeight,
      fxH: anim.fx!.contentHeight ?? anim.fx!.frameHeight,
      scaleMult: anim.fxScale,
      originX: anim.fx!.originX,
      originY: anim.fx!.originY,
      offsetX: anim.fx!.offsetX,
      offsetY: anim.fx!.offsetY,
      independentScale: anim.fxIndependentScale,
      blend: anim.fxBlend,
      ...catalogFxOpts(anim),
      persist: hooks?.persist,
      onSpawn: hooks?.onSpawn,
      onEffectStart: hooks?.onEffectStart,
      onArrival: hooks?.onArrival,
    });
  });
}

function catalogFxOpts(anim: CharacterSkillAnimDef): Pick<
  PackFxOptions,
  | 'frameRate'
  | 'frameCount'
  | 'loop'
  | 'loopMode'
  | 'loopStartFrame'
  | 'loopEndFrame'
  | 'loopDurationMs'
  | 'loopUntilSkillEnd'
  | 'skillDurationMs'
  | 'flipX'
  | 'flipY'
  | 'vfxId'
> {
  if (!anim.vfxId || !anim.fx) return { vfxId: anim.vfxId };
  const catalog = getVfxDefinition(anim.vfxId);
  const mode = loopModeFromLegacy(catalog?.loop, anim.vfxLoopMode);
  return {
    frameRate: anim.fx.frameRate ?? catalog?.frameRate,
    frameCount: anim.fx.frameCount ?? catalog?.frameCount,
    loop: mode !== 'none',
    loopMode: mode,
    loopStartFrame: anim.vfxLoopStartFrame,
    loopEndFrame: anim.vfxLoopEndFrame,
    loopDurationMs: anim.vfxLoopDurationMs,
    loopUntilSkillEnd: anim.vfxLoopUntilSkillEnd,
    skillDurationMs: officialSkillDurationMs(anim.execution) ?? undefined,
    flipX: Boolean(anim.vfxFlipX),
    flipY: Boolean(anim.vfxFlipY),
    vfxId: anim.vfxId,
  };
}

/**
 * Agenda o FX de uma folha de jutsu: legado (`fxAttach` / projétil) ou
 * `targeting.mode` oficial. Skills sem `targeting` não mudam.
 */
export function scheduleSkillFx(
  scene: Phaser.Scene,
  caster: Player,
  anim: CharacterSkillAnimDef,
  hitDelay: number,
  from: { x: number; y: number },
  to: { x: number; y: number },
  aim?: SkillFxAim | null,
  hooks?: SkillFxHooks,
): void {
  const labSession = isCharacterLabSession();
  const mode = anim.targeting?.mode;
  if (anim.vfxId && !getVfxDefinition(anim.vfxId)) {
    logVfxLifecycle('spawn failed', { reason: 'VFX ID not found', vfxId: anim.vfxId });
  } else if (anim.vfxId && !anim.fx) {
    logVfxLifecycle('spawn failed', { reason: 'frame definition invalid', vfxId: anim.vfxId });
  }
  if (labSession && (mode === 'travel-to-target' || mode === 'instant-target' || characterLabStore.getSnapshot().loopSkill)) {
    clearLabForcedFx();
  }

  if (anim.fx && (mode === 'travel-to-target' || mode === 'instant-target')) {
    scheduleTargetedPrimary(scene, caster, anim, hitDelay, from, to, aim, mode === 'instant-target', hooks);
  } else if (anim.fx && mode === 'caster') {
    const releaseAt = anim.fxReleaseMs ?? Math.max(0, hitDelay - 80);
    labDelay(scene, releaseAt, () => {
      const resolved = resolveAim(anim, aim, from, to);
      playPackFx(scene, caster, anim.fx!.key, resolved.spawnX, resolved.spawnY, {
        ground: anim.fxGround ?? true,
        bodyH: anim.contentHeight,
        fxH: anim.fx!.contentHeight ?? anim.fx!.frameHeight,
        scaleMult: anim.fxScale,
        originX: anim.fx!.originX,
        originY: anim.fx!.originY,
        offsetX: anim.fx!.offsetX,
        offsetY: anim.fx!.offsetY,
        independentScale: anim.fxIndependentScale,
        blend: anim.fxBlend,
        ...catalogFxOpts(anim),
        persist: hooks?.persist,
        onSpawn: hooks?.onSpawn,
        onEffectStart: hooks?.onEffectStart,
        onArrival: hooks?.onArrival,
      });
    });
  } else if (anim.fx) {
    scheduleLegacyPrimary(scene, caster, anim, hitDelay, from, to, aim, hooks);
  }

  if (anim.fxSecondary) {
    const secondary = anim.fxSecondary;
    const releaseAt = anim.fxSecondaryReleaseMs ?? hitDelay;
    const attach = anim.fxSecondaryAttach ?? 'caster';
    labDelay(scene, releaseAt, () => {
      const fxX = attach === 'caster' ? caster.x : to.x;
      const fxY = attach === 'caster' ? caster.y : to.y;
      playPackFx(scene, caster, secondary.key, fxX, fxY, {
        ground: attach === 'caster',
        bodyH: anim.contentHeight,
        fxH: secondary.contentHeight ?? secondary.frameHeight,
        originX: secondary.originX,
        offsetX: secondary.offsetX,
        offsetY: secondary.offsetY,
      });
    });
  }
}
