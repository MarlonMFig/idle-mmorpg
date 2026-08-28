import * as Phaser from 'phaser';
import { PLAYER_ATTACK_RANGE } from '@/constants/combat';
import type { Player } from '@/entities/player';
import type { SkillVfxTargetMode } from '@/data/character-packs';

export function contactPointTowardTarget(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  contactRange: number,
): { x: number; y: number } {
  const dist = Phaser.Math.Distance.Between(fromX, fromY, toX, toY);
  if (dist <= contactRange) return { x: fromX, y: fromY };
  const ratio = 1 - contactRange / dist;
  return {
    x: fromX + (toX - fromX) * ratio,
    y: fromY + (toY - fromY) * ratio,
  };
}

function travelMs(distance: number, speedPx: number): number {
  if (speedPx <= 0) return 0;
  return Math.max(80, Math.round((distance / speedPx) * 1000));
}

export interface CasterDashOptions {
  scene: Phaser.Scene;
  player: Player;
  toX: number;
  toY: number;
  hitDelayMs: number;
  contactRange?: number;
  dashStartMs?: number | null;
  dashDurationMs?: number | null;
  /** Lab Target Mode — desloca o personagem até o alvo durante a skill. */
  targetMode?: SkillVfxTargetMode;
  travelSpeed?: number;
}

/**
 * Avança o caster até o alcance de contato do alvo.
 * - Skills com `dashToTarget`: impulso/investida legada.
 * - Lab `instant-target` / `travel-to-target`: espelha o comportamento esperado no teste de melee.
 */
export function dashCasterToTarget(opts: CasterDashOptions): void {
  const contact = (opts.contactRange ?? PLAYER_ATTACK_RANGE * 0.85) * opts.player.worldScale;
  const fromX = opts.player.x;
  const fromY = opts.player.y;
  const end = contactPointTowardTarget(fromX, fromY, opts.toX, opts.toY, contact);
  const dist = Phaser.Math.Distance.Between(fromX, fromY, end.x, end.y);
  if (dist <= 1) return;

  const hitDelay = Math.max(0, Math.round(opts.hitDelayMs));
  let dashStart: number;
  let dashDuration: number;
  let ease: string;

  if (opts.targetMode === 'instant-target') {
    dashDuration = Math.max(120, Math.min(hitDelay, Math.floor(hitDelay * 0.88)));
    dashStart = Math.max(0, hitDelay - dashDuration);
    ease = 'Cubic.easeIn';
  } else if (opts.targetMode === 'travel-to-target') {
    const speed = Math.max(1, opts.travelSpeed ?? 600);
    dashDuration = travelMs(dist, speed);
    dashStart = Math.max(0, hitDelay - dashDuration);
    ease = 'Linear';
  } else if (opts.dashStartMs != null) {
    dashStart = Math.max(0, Math.min(opts.dashStartMs, Math.max(0, hitDelay - 80)));
    const remaining = Math.max(80, hitDelay - dashStart);
    dashDuration =
      opts.dashDurationMs != null
        ? Math.max(80, Math.min(opts.dashDurationMs, remaining))
        : remaining;
    ease = 'Linear';
  } else {
    dashDuration =
      opts.dashDurationMs != null
        ? opts.dashDurationMs
        : Math.min(360, Math.max(160, Math.floor(hitDelay * 0.16)));
    dashStart = Math.max(0, hitDelay - dashDuration);
    ease = 'Cubic.easeIn';
  }

  opts.scene.time.delayedCall(dashStart, () => {
    if (!opts.player.sprite?.active) return;
    opts.player.sprite.setVelocity(0, 0);
    opts.scene.tweens.add({
      targets: opts.player.sprite,
      x: end.x,
      y: end.y,
      duration: dashDuration,
      ease,
      onUpdate: () => opts.player.syncPresentation(),
      onComplete: () => opts.player.syncPresentation(),
    });
  });
}
