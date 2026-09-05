import * as Phaser from 'phaser';
import { PreloadScene } from '@/game/scenes/preload-scene';
import { bootLoadingStore } from '@/stores/boot-loading-store';

/**
 * Primeira cena: registra o pipeline e segue para o preload.
 */
export class BootScene extends Phaser.Scene {
  static readonly KEY = 'BootScene';

  constructor() {
    super({ key: BootScene.KEY });
  }

  create(): void {
    bootLoadingStore.setPhase('booting');
    this.cameras.main.setBackgroundColor('#000000');
    this.scene.start(PreloadScene.KEY);
  }
}
