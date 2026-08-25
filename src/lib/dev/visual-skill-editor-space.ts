import { CHARACTER_DISPLAY_HEIGHT } from '@/constants/sprites';
import { PACK_FX_MID_BODY_FACTOR, packFxDisplayScale } from '@/lib/pack-fx-scale';

/** Arena de jogo do editor (não é o tamanho CSS). O canvas preenche o preview. */
export const VSE_STAGE_WIDTH = 960;
export const VSE_STAGE_HEIGHT = 420;
export const VSE_GROUND_Y = 368;
export const VSE_CHAR_FEET_X = 160;
export const VSE_DUMMY_FEET_X = 800;
/** Só o preview — não grava na Skill. Personagens ~62px ficam legíveis na arena. */
export const VSE_PREVIEW_ACTOR_SCALE = 2.4;
export const VSE_MIN_HIT = 48;

export const VSE_ZOOM_PRESETS = [0.5, 0.75, 1, 1.5, 2] as const;
export type VseZoom = (typeof VSE_ZOOM_PRESETS)[number];

export const VSE_SNAP_PRESETS = [0, 1, 4, 8] as const;
export type VseSnap = (typeof VSE_SNAP_PRESETS)[number];

export const VSE_DISTANCE_MIN = 180;
export const VSE_DISTANCE_MAX = 720;
export const VSE_DISTANCE_DEFAULT = VSE_DUMMY_FEET_X - VSE_CHAR_FEET_X;
export const VSE_DISTANCE_PRESETS = { near: 220, medium: 420, far: 640 } as const;

export interface VseViewFit {
  scale: number;
  offsetX: number;
  offsetY: number;
  viewW: number;
  viewH: number;
}

export function vseViewFit(viewW: number, viewH: number, zoom: number): VseViewFit {
  const z = zoom > 0 ? zoom : 1;
  const base = Math.min(viewW / VSE_STAGE_WIDTH, viewH / VSE_STAGE_HEIGHT);
  const scale = Math.max(0.05, base * z);
  const drawW = VSE_STAGE_WIDTH * scale;
  const drawH = VSE_STAGE_HEIGHT * scale;
  return {
    scale,
    offsetX: (viewW - drawW) / 2,
    offsetY: (viewH - drawH) / 2,
    viewW,
    viewH,
  };
}

export function enemyFeetX(distance: number): number {
  const d = Math.min(VSE_DISTANCE_MAX, Math.max(VSE_DISTANCE_MIN, distance));
  return VSE_CHAR_FEET_X + d;
}

export function pointerToStage(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  fit: VseViewFit,
): { x: number; y: number } {
  if (rect.width <= 0 || fit.scale <= 0) return { x: 0, y: 0 };
  return {
    x: (clientX - rect.left - fit.offsetX) / fit.scale,
    y: (clientY - rect.top - fit.offsetY) / fit.scale,
  };
}

export function deltaToStage(dxScreen: number, dyScreen: number, fit: VseViewFit): { x: number; y: number } {
  if (fit.scale <= 0) return { x: 0, y: 0 };
  return { x: dxScreen / fit.scale, y: dyScreen / fit.scale };
}

export function expandHitBox(
  box: { x: number; y: number; w: number; h: number },
  minSize = VSE_MIN_HIT,
): { x: number; y: number; w: number; h: number } {
  const w = Math.max(box.w, minSize);
  const h = Math.max(box.h, minSize);
  return {
    x: box.x - (w - box.w) / 2,
    y: box.y - (h - box.h) / 2,
    w,
    h,
  };
}

export type VseEditorLayer = 'guides' | 'target' | 'character' | 'vfx';

export type VseSelectableId = 'vfx';

export function snapGameValue(value: number, snap: VseSnap): number {
  if (snap <= 0) return Math.round(value);
  return Math.round(value / snap) * snap;
}

export function screenDeltaToGame(dxScreen: number, dyScreen: number, zoom: number): { x: number; y: number } {
  const z = zoom > 0 ? zoom : 1;
  return { x: dxScreen / z, y: dyScreen / z };
}

export function characterDrawScale(poseFrameHeight: number): number {
  const h = Math.max(1, poseFrameHeight);
  return CHARACTER_DISPLAY_HEIGHT / h;
}

export function characterMidBody(feetX: number, feetY: number, bodyWorldH: number): { x: number; y: number } {
  return { x: feetX, y: feetY - bodyWorldH * PACK_FX_MID_BODY_FACTOR };
}

export function vfxWorldScale(input: {
  poseFrameHeight: number;
  poseFrameWidth: number;
  vfxFrameWidth: number;
  vfxFrameHeight: number;
  vfxScale: number;
}): number {
  const casterSpriteScaleX = characterDrawScale(input.poseFrameHeight);
  return packFxDisplayScale({
    bodyH: input.poseFrameHeight,
    fxW: input.vfxFrameWidth,
    fxH: input.vfxFrameHeight,
    casterSpriteScaleX,
    scaleMult: input.vfxScale,
  });
}

export function vfxOriginGame(input: {
  offsetX: number;
  offsetY: number;
  poseOffsetX: number;
  poseOffsetY: number;
  bodyWorldH: number;
}): { x: number; y: number } {
  const mid = characterMidBody(VSE_CHAR_FEET_X + input.poseOffsetX, VSE_GROUND_Y + input.poseOffsetY, input.bodyWorldH);
  return { x: mid.x + input.offsetX, y: mid.y + input.offsetY };
}

export function vfxAabbGame(input: {
  originX: number;
  originY: number;
  frameWidth: number;
  frameHeight: number;
  worldScale: number;
}): { x: number; y: number; w: number; h: number } {
  const w = input.frameWidth * input.worldScale;
  const h = input.frameHeight * input.worldScale;
  return { x: input.originX - w / 2, y: input.originY - h / 2, w, h };
}

export function pointInAabb(
  px: number,
  py: number,
  box: { x: number; y: number; w: number; h: number },
): boolean {
  return px >= box.x && py >= box.y && px <= box.x + box.w && py <= box.y + box.h;
}
