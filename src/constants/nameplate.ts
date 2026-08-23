import * as Phaser from 'phaser';
import { characterDepthForY } from '@/constants/render-layers';

/**
 * Tipografia de nameplate no mapa — nome limpo, contorno nítido sobre o pixel art.
 * A câmera dá zoom no mundo; sem `resolution` o canvas 10px estica e o AA vira borrão.
 */
const NAMEPLATE_FONT = 'Tahoma, "Segoe UI", sans-serif';

export const NAMEPLATE_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: NAMEPLATE_FONT,
  fontSize: '11px',
  color: '#f4f1ea',
  align: 'center',
  stroke: '#0c0e10',
  strokeThickness: 2,
};

export const PLAYER_NAMEPLATE_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: NAMEPLATE_FONT,
  fontSize: '11px',
  color: '#ffe9a8',
  align: 'center',
  stroke: '#0a0a0a',
  strokeThickness: 2,
};

export const REMOTE_NAMEPLATE_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: NAMEPLATE_FONT,
  fontSize: '11px',
  color: '#a8d4ff',
  align: 'center',
  stroke: '#0a0a0a',
  strokeThickness: 2,
};

/** Resolução do canvas de texto = zoom da câmera × DPR (1:1 com o pixel da tela). */
export function worldTextResolution(scene: Phaser.Scene): number {
  const zoom = scene.cameras.main?.zoom || 1;
  const dpr =
    typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 3) : 1;
  return Phaser.Math.Clamp(zoom * dpr, 1, 4);
}

/** Phaser tipa só `setResolution`; o getter `resolution` existe em runtime. */
function textResolution(text: Phaser.GameObjects.Text): number {
  return (text as Phaser.GameObjects.Text & { resolution: number }).resolution;
}

export function sharpenWorldText(
  text: Phaser.GameObjects.Text,
): Phaser.GameObjects.Text {
  const res = worldTextResolution(text.scene);
  if (Math.abs(textResolution(text) - res) > 0.04) {
    text.setResolution(res);
  }
  return text;
}

export function addNameplate(
  scene: Phaser.Scene,
  x: number,
  y: number,
  value: string,
  style: Phaser.Types.GameObjects.Text.TextStyle,
): Phaser.GameObjects.Text {
  return sharpenWorldText(scene.add.text(x, y, value, style).setOrigin(0.5, 1));
}

/** Recalcula a resolução de todos os textos do mundo após mudar o zoom. */
export function refreshWorldTextResolution(scene: Phaser.Scene): void {
  const res = worldTextResolution(scene);
  for (const child of scene.children.getAll()) {
    if (child instanceof Phaser.GameObjects.Text) {
      if (Math.abs(textResolution(child) - res) > 0.04) {
        child.setResolution(res);
      }
    }
  }
}

/** Depth na faixa de personagens + y*fator (mais abaixo = na frente). */
export function worldDepthForY(y: number, base = 8): number {
  return characterDepthForY(y, base - 8);
}
