import * as Phaser from 'phaser';

/**
 * Feedback visual curto no sprite do jogador (ataque / hit).
 * `mulX`/`mulY` são multiplicadores da escala atual — packs HQ (contentHeight
 * alto → scale ~0.4) não podem receber valores absolutos tipo 1.04.
 */
export function playPlayerPulse(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.Sprite,
  mulX = 1.08,
  mulY = 0.94,
  duration = 70,
): void {
  const baseX = target.scaleX;
  const baseY = target.scaleY;
  scene.tweens.killTweensOf(target);
  scene.tweens.add({
    targets: target,
    scaleX: baseX * mulX,
    scaleY: baseY * mulY,
    duration,
    yoyo: true,
    onComplete: () => {
      target.setScale(baseX, baseY);
    },
  });
}
