import * as Phaser from 'phaser';
import { BootScene } from '@/game/scenes/boot-scene';
import { GameScene } from '@/game/scenes/game-scene';
import { PreloadScene } from '@/game/scenes/preload-scene';

/** Resolução inicial do canvas (RESIZE ajusta ao parent em tempo real). */
export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

export function createGameConfig(parent: HTMLElement): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#000000',
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.NO_CENTER,
      width: parent.clientWidth || GAME_WIDTH,
      height: parent.clientHeight || GAME_HEIGHT,
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
