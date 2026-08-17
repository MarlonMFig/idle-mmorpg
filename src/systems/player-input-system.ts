import * as Phaser from 'phaser';
import type { Player } from '@/entities/player';
import { dialogueStore } from '@/stores/dialogue-store';

export interface PlayerInputOptions {
  /** Hub de perfil: ignora o eixo vertical (senão o clamp do chão treme). */
  lateral?: boolean;
}

/**
 * Movimento manual WASD / setas — hub e mapas de exploração.
 */
export class PlayerInputSystem {
  private readonly cursors: Phaser.Types.Input.Keyboard.CursorKeys | null;
  private readonly keyW: Phaser.Input.Keyboard.Key | null;
  private readonly keyA: Phaser.Input.Keyboard.Key | null;
  private readonly keyS: Phaser.Input.Keyboard.Key | null;
  private readonly keyD: Phaser.Input.Keyboard.Key | null;
  private enabled = true;
  private wasMoving = false;
  private readonly lateral: boolean;

  constructor(
    scene: Phaser.Scene,
    private readonly player: Player,
    options: PlayerInputOptions = {},
  ) {
    this.lateral = options.lateral ?? false;
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

  /** @returns true enquanto alguma tecla de direção estiver pressionada. */
  update(): boolean {
    if (!this.enabled || dialogueStore.isOpen()) {
      if (dialogueStore.isOpen()) this.player.stop();
      this.wasMoving = false;
      return false;
    }

    let dx = 0;
    let dy = 0;

    if (this.keyA?.isDown || this.cursors?.left.isDown) dx -= 1;
    if (this.keyD?.isDown || this.cursors?.right.isDown) dx += 1;
    if (!this.lateral) {
      if (this.keyW?.isDown || this.cursors?.up.isDown) dy -= 1;
      if (this.keyS?.isDown || this.cursors?.down.isDown) dy += 1;
    }

    // Sem tecla pressionada o controle é devolvido (só um frame de parada), para
    // não disputar a velocity com a IA idle nos mapas que têm as duas coisas.
    const moving = dx !== 0 || dy !== 0;
    if (moving || this.wasMoving) this.player.applyMoveInput(dx, dy);
    this.wasMoving = moving;
    return moving;
  }
}
