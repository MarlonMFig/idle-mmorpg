import * as Phaser from 'phaser';

/** Feedback visual curto no sprite do jogador (ataque / cast). */
export function playPlayerPulse(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.Sprite,
  scaleX = 1.08,
  scaleY = 0.94,
  duration = 70,
): void {
  scene.tweens.add({
    targets: target,
    scaleX,
    scaleY,
    duration,
    yoyo: true,
  });
}
