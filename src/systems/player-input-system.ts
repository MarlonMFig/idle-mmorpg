import * as Phaser from 'phaser';
import type { Player } from '@/entities/player';
import { dialogueStore } from '@/stores/dialogue-store';

/**
 * Movimento manual WASD / setas — ativo só no hub.
 */
export class PlayerInputSystem {
  private readonly cursors: Phaser.Types.Input.Keyboard.CursorKeys | null;
  private readonly keyW: Phaser.Input.Keyboard.Key | null;
  private readonly keyA: Phaser.Input.Keyboard.Key | null;
  private readonly keyS: Phaser.Input.Keyboard.Key | null;
  private readonly keyD: Phaser.Input.Keyboard.Key | null;
  private enabled = true;

  constructor(
    scene: Phaser.Scene,
    private readonly player: Player,
  ) {
    const keyboard = scene.input.keyboard;
    if (!keyboard) {
      this.cursors = null;
      this.keyW = null;
      this.keyA = null;
      this.keyS = null;
      this.keyD = null;
      return;
    }

    this.cursors = keyboard.createCursorKeys();
    this.keyW = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyA = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyS = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.keyD = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.player.stop();
  }

  update(): void {
    if (!this.enabled || dialogueStore.isOpen()) {
      if (dialogueStore.isOpen()) this.player.stop();
      return;
    }

    let dx = 0;
    let dy = 0;

    if (this.keyA?.isDown || this.cursors?.left.isDown) dx -= 1;
    if (this.keyD?.isDown || this.cursors?.right.isDown) dx += 1;
    if (this.keyW?.isDown || this.cursors?.up.isDown) dy -= 1;
    if (this.keyS?.isDown || this.cursors?.down.isDown) dy += 1;

    this.player.applyMoveInput(dx, dy);
  }
}
