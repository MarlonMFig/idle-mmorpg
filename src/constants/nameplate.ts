import * as Phaser from 'phaser';
import { characterDepthForY } from '@/constants/render-layers';

/**
 * Tipografia de nameplate no mapa — fonte vetorial nítida sobre o pixel art.
 * Nunca aplicar `setScale` no texto: a câmera / layoutScale do sprite não
 * devem esticar o canvas tipográfico (isso causa blur).
 */
const NAMEPLATE_FONT = 'Inter, Arial, Helvetica, sans-serif';

const NAMEPLATE_BASE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: NAMEPLATE_FONT,
  fontSize: '15px',
  fontStyle: 'bold',
  align: 'center',
  stroke: '#000000',
  strokeThickness: 3,
  shadow: {
    offsetX: 0,
    offsetY: 2,
    color: '#000000',
    blur: 3,
    fill: true,
    stroke: true,
  },
};

export const NAMEPLATE_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  ...NAMEPLATE_BASE,
  color: '#ffffff',
};

export const PLAYER_NAMEPLATE_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  ...NAMEPLATE_BASE,
  color: '#ffe9a8',
};

export const REMOTE_NAMEPLATE_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  ...NAMEPLATE_BASE,
  color: '#a8d4ff',
};

/** Resolução do canvas de texto = zoom da câmera × DPR (1:1 com o pixel da tela). */
export function worldTextResolution(scene: Phaser.Scene): number {
  const zoom = scene.cameras.main?.zoom || 1;
  const dpr =
    typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 3) : 1;
  // Piso 2: com `pixelArt: true` o AA do glifo precisa de buffer extra.
  return Phaser.Math.Clamp(Math.max(zoom, 1) * dpr, 2, 4);
}

/** Phaser tipa só `setResolution`; o getter `resolution` existe em runtime. */
function textResolution(text: Phaser.GameObjects.Text): number {
  return (text as Phaser.GameObjects.Text & { resolution: number }).resolution;
}

/** Texto do mundo: LINEAR (nunca NEAREST/pixelated) + resolução de tela. */
export function sharpenWorldText(
  text: Phaser.GameObjects.Text,
): Phaser.GameObjects.Text {
  const res = worldTextResolution(text.scene);
  if (Math.abs(textResolution(text) - res) > 0.04) {
    text.setResolution(res);
  }
  // `pixelArt: true` no game config força NEAREST em texturas novas — desfaz no nome.
  text.texture?.setFilter(Phaser.Textures.FilterMode.LINEAR);
  text.setScale(1);
  return text;
}

export function addNameplate(
  scene: Phaser.Scene,
  x: number,
  y: number,
  value: string,
  style: Phaser.Types.GameObjects.Text.TextStyle,
): Phaser.GameObjects.Text {
  const text = scene.add
    .text(Math.round(x), Math.round(y), value, style)
    .setOrigin(0.5, 1);
  return sharpenWorldText(text);
}

/** Recalcula a resolução de todos os textos do mundo após mudar o zoom. */
export function refreshWorldTextResolution(scene: Phaser.Scene): void {
  const res = worldTextResolution(scene);
  for (const child of scene.children.getAll()) {
    if (!(child instanceof Phaser.GameObjects.Text)) continue;
    if (Math.abs(textResolution(child) - res) > 0.04) {
      child.setResolution(res);
    }
    child.texture?.setFilter(Phaser.Textures.FilterMode.LINEAR);
    // Garante que layoutScale/worldScale de sprites não “vazou” para o rótulo.
    if (child.scaleX !== 1 || child.scaleY !== 1) {
      child.setScale(1);
    }
  }
}

/** Depth na faixa de personagens + y*fator (mais abaixo = na frente). */
export function worldDepthForY(y: number, base = 8): number {
  return characterDepthForY(y, base - 8);
}
