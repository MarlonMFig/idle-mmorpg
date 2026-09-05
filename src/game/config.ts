import * as Phaser from 'phaser';
import { resolveCanvasSize } from '@/game/canvas-size';
import { BootScene } from '@/game/scenes/boot-scene';
import { GameScene } from '@/game/scenes/game-scene';
import { PreloadScene } from '@/game/scenes/preload-scene';

export function createGameConfig(parent: HTMLElement): Phaser.Types.Core.GameConfig {
  const { width, height } = resolveCanvasSize(parent);
  return {
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#000000',
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.NO_CENTER,
      width,
      height,
    },
    input: {
      // Sem isto o Phaser também processa `mousedown` da window: um clique num
      // painel da HUD vira clique no mundo e abre o prédio que estiver atrás.
      windowEvents: false,
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
