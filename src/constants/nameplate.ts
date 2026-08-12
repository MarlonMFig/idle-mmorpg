import type * as Phaser from 'phaser';

/**
 * Tipografia de nameplate no mapa — nome limpo, contorno nítido sobre o pixel art.
 */
export const NAMEPLATE_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'Tahoma, "Segoe UI", sans-serif',
  fontSize: '10px',
  color: '#f4f1ea',
  align: 'center',
  stroke: '#0c0e10',
  strokeThickness: 3,
  shadow: {
    offsetX: 0,
    offsetY: 1,
    color: '#000000',
    blur: 0,
    fill: true,
    stroke: false,
  },
};

export const PLAYER_NAMEPLATE_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'Tahoma, "Segoe UI", sans-serif',
  fontSize: '10px',
  color: '#ffe9a8',
  align: 'center',
  stroke: '#0a0a0a',
  strokeThickness: 2,
};

export const REMOTE_NAMEPLATE_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'Tahoma, "Segoe UI", sans-serif',
  fontSize: '10px',
  color: '#a8d4ff',
  align: 'center',
  stroke: '#0a0a0a',
  strokeThickness: 2,
};

/** Depth base + y*fator para ordenar personagens (mais abaixo = na frente). */
export function worldDepthForY(y: number, base = 8): number {
  return base + y * 0.05;
}
