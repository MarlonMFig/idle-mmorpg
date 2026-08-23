import * as Phaser from 'phaser';
import { CHARACTER_DISPLAY_HEIGHT } from '@/constants/sprites';
import { vfxDepthForLayer } from '@/constants/render-layers';
import {
  ensureWonsrFxAnim,
  wonsrSpriteFit,
  wonsrTextureKey,
  type WonsrSpriteIndex,
} from '@/data/wonsr-sprites';
import type { EnemySkill } from '@/types/enemy';

const WONSR_SPRITE_INDEX_KEY = 'wonsr-sprite-index';

/** Toca efeito/míssil WONSR do golpe do inimigo. Devolve delay até o impacto. */
export function playWonsrEnemySkillFx(
  scene: Phaser.Scene,
  skill: EnemySkill,
  from: { x: number; y: number },
  to: { x: number; y: number },
): number {
  const index = scene.cache.json.get(WONSR_SPRITE_INDEX_KEY) as WonsrSpriteIndex | undefined;
  if (!index) return 220;

  let delay = 240;
  if (skill.missileId) {
    const missileDelay = spawnSheet(scene, index, 'missiles', skill.missileId, from, {
      travelTo: to,
    });
    if (missileDelay != null) delay = missileDelay;
  }
  if (skill.effectId) {
    const impactAt = skill.missileId ? to : from;
    const effectDelay = spawnSheet(scene, index, 'effects', skill.effectId, impactAt, {});
    if (effectDelay != null && !skill.missileId) delay = Math.floor(effectDelay * 0.45);
  }
  return delay;
}

function spawnSheet(
  scene: Phaser.Scene,
  index: WonsrSpriteIndex,
  group: 'effects' | 'missiles',
  id: string,
  origin: { x: number; y: number },
  options: { travelTo?: { x: number; y: number } },
): number | null {
  const sheet = index.groups[group][id];
  const textureKey = wonsrTextureKey(group, id);
  if (!sheet || !scene.textures.exists(textureKey)) return null;

  const animKey = ensureWonsrFxAnim(scene, group, id, sheet);
  const fit = wonsrSpriteFit(sheet, CHARACTER_DISPLAY_HEIGHT * (group === 'missiles' ? 0.72 : 1.15));
  const sprite = scene.add.sprite(origin.x, origin.y, textureKey, 0);
  sprite.setOrigin(fit.originX, fit.originY);
  sprite.setScale(fit.scaleX ?? fit.scale, fit.scale);
  sprite.setDepth(vfxDepthForLayer('front-of-characters', origin.y));
  sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
  sprite.anims.play(animKey, false);

  const duration = Math.max(
    180,
    Math.ceil((sheet.phases / (scene.anims.get(animKey)?.frameRate || 14)) * 1000),
  );

  if (options.travelTo) {
    const dist = Math.hypot(options.travelTo.x - origin.x, options.travelTo.y - origin.y);
    const travel = Math.max(220, Math.min(520, dist * 2.2));
    scene.tweens.add({
      targets: sprite,
      x: options.travelTo.x,
      y: options.travelTo.y,
      duration: travel,
      ease: 'Cubic.easeOut',
      onComplete: () => sprite.destroy(),
    });
    scene.time.delayedCall(travel + 40, () => {
      if (sprite.active) sprite.destroy();
    });
    return travel;
  }

  sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => sprite.destroy());
  scene.time.delayedCall(duration + 80, () => {
    if (sprite.active) sprite.destroy();
  });
  return duration;
}
