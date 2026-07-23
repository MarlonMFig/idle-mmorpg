import * as Phaser from 'phaser';
import { BootScene } from '@/game/scenes/boot-scene';
import { GameScene } from '@/game/scenes/game-scene';
import { PreloadScene } from '@/game/scenes/preload-scene';

/** Resolução alvo do canvas (tela cheia 16:9). */
export const GAME_WIDTH = 2560;
export const GAME_HEIGHT = 1440;

export function createGameConfig(parent: HTMLElement): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#000000',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
    },
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false,
      },
    },
    render: {
      antialias: false,
      pixelArt: true,
      roundPixels: true,
    },
    banner: false,
    scene: [BootScene, PreloadScene, GameScene],
  };
}
