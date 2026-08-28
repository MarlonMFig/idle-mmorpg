import type * as Phaser from 'phaser';
import {
  loadSpriteSheets,
  type CharacterSkillAnimDef,
} from '@/data/character-packs';
import type { Player } from '@/entities/player';
import {
  labPoseHasContent,
  poseDurationMs,
  poseSheetToSpriteDef,
  type LabPoseSheet,
} from '@/lib/dev/lab-pose-sheet';
import {
  clearLabForcedFx,
  computeSkillFxAim,
  scheduleSkillFx,
  type SkillFxAim,
} from '@/systems/pack-fx';
import type { SkillVfxTargetMode } from '@/data/skill-vfx-targeting';

export interface ScheduleLabPoseFxOptions {
  scene: Phaser.Scene;
  player: Player;
  pose: LabPoseSheet;
  targetMode: SkillVfxTargetMode;
  travelSpeed: number;
  spawnOffsetX: number;
  spawnOffsetY: number;
  targetOffsetX: number;
  targetOffsetY: number;
  from: { x: number; y: number };
  to: { x: number; y: number };
  aim?: SkillFxAim | null;
  hitDelayMs?: number;
}

/** Reproduz a Pose Attack como um VFX independente, sem alterar a posição do caster. */
export async function scheduleLabPoseFx(options: ScheduleLabPoseFxOptions): Promise<boolean> {
  if (!labPoseHasContent(options.pose)) return false;

  const sheet = poseSheetToSpriteDef(options.pose);
  if (!sheet.url && !sheet.frames?.length) return false;

  try {
    await loadSpriteSheets(options.scene, [sheet]);
  } catch (error) {
    console.warn('[LabPoseFx] falha ao carregar pose', error);
    return false;
  }

  const hitDelayMs = options.hitDelayMs ?? poseDurationMs(options.pose);
  const anim: CharacterSkillAnimDef = {
    key: `lab-pose-fx-${sheet.key}`,
    url: sheet.url,
    frames: sheet.frames,
    frameWidth: sheet.frameWidth,
    frameHeight: sheet.frameHeight,
    frameCount: sheet.frameCount,
    frameRate: sheet.frameRate,
    loop: sheet.loop,
    contentHeight: sheet.frameHeight,
    hitDelayMs,
    durationMs: hitDelayMs,
    fx: {
      ...sheet,
      key: sheet.key,
      offsetX: options.pose.offsetX,
      offsetY: options.pose.offsetY,
      originX: 0.5,
      originY: 1,
    },
    fxScale: options.pose.scaleY,
    fxGround: true,
    fxIndependentScale: true,
    targeting: {
      mode: options.targetMode,
      travelSpeed: options.travelSpeed,
      spawnOffsetX: options.spawnOffsetX,
      spawnOffsetY: options.spawnOffsetY,
      targetOffsetX: options.targetOffsetX,
      targetOffsetY: options.targetOffsetY,
    },
  };

  clearLabForcedFx();
  const restoreBody = () => options.player.setPoseAttackBodyVisible(true);
  scheduleSkillFx(
    options.scene,
    options.player,
    anim,
    0,
    options.from,
    options.to,
    options.aim ?? computeSkillFxAim(options.player, null),
    {
      onSpawn: (sprite) => {
        // A full-body pose used as FX replaces the visible caster body. Keeping
        // both sprites visible is the duplication seen in the Lab preview.
        options.player.setPoseAttackBodyVisible(false);
        sprite.once('destroy', restoreBody);
      },
    },
  );
  return true;
}
