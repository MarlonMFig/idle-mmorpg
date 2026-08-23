import type { VfxRenderLayer } from '@/data/vfx/types';
import { resolveVfxRenderLayer } from '@/data/vfx/types';

/**
 * Faixas de depth do Phaser (não CSS z-index).
 * Personagens continuam Y-sorted dentro da própria faixa.
 *
 * BACKGROUND → WORLD → BEHIND VFX → CHARACTERS → FRONT VFX
 * → MAP FOREGROUND → COMBAT TEXT → FOREGROUND VFX → UI
 */
export const RENDER_LAYER = {
  background: 0,
  world: 1,
  behindVfx: 200,
  characters: 1000,
  frontVfx: 4000,
  mapForeground: 5000,
  combatText: 6000,
  foregroundVfx: 8000,
  ui: 10000,
} as const;

const Y_SORT = 0.05;

function ySorted(base: number, y: number, offset = 0): number {
  return base + y * Y_SORT + offset;
}

export function characterDepthForY(y: number, tieBreak = 0): number {
  return ySorted(RENDER_LAYER.characters, y, tieBreak);
}

export function combatTextDepthForY(y: number, offset = 0): number {
  return ySorted(RENDER_LAYER.combatText, y, offset);
}

export function vfxDepthForLayer(layer: VfxRenderLayer | null | undefined, y: number): number {
  const resolved = resolveVfxRenderLayer(layer);
  const base =
    resolved === 'behind-characters'
      ? RENDER_LAYER.behindVfx
      : resolved === 'foreground'
        ? RENDER_LAYER.foregroundVfx
        : RENDER_LAYER.frontVfx;
  return ySorted(base, y);
}
