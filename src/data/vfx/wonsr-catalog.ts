import { fetchWonsrSpriteIndex, type WonsrAnimationSheet } from '@/data/wonsr-sprites';
import type { SharedVfxDefinition } from './types';

const byId: Record<string, SharedVfxDefinition> = {};
let loaded = false;
let inflight: Promise<void> | null = null;

export const WONSR_FX_PREFIX = 'wonsr-fx-';
export const WONSR_AURA_PREFIX = 'wonsr-aura-';

function frameRateForPhases(phases: number, loop: boolean): number {
  if (loop) return phases >= 16 ? 10 : 8;
  if (phases >= 20) return 16;
  if (phases <= 4) return 10;
  return 12;
}

function defaultScale(sheet: WonsrAnimationSheet): number {
  const height = sheet.content?.height || sheet.frameHeight;
  if (height <= 48) return 1.15;
  if (height >= 192) return 0.72;
  return 1;
}

function toDef(
  numericId: string,
  sheet: WonsrAnimationSheet,
  kind: 'fx' | 'aura',
): SharedVfxDefinition {
  const phases = Math.max(1, sheet.phases);
  const loop = kind === 'aura';
  return {
    id: `${kind === 'fx' ? WONSR_FX_PREFIX : WONSR_AURA_PREFIX}${numericId}`,
    name: kind === 'fx' ? `WONSR FX ${numericId}` : `WONSR Aura ${numericId}`,
    universe: 'wonsr',
    url: sheet.url,
    frameWidth: sheet.frameWidth,
    frameHeight: sheet.frameHeight,
    frameCount: phases,
    frameRate: frameRateForPhases(phases, loop),
    loop,
    defaultScale: defaultScale(sheet),
    defaultOffsetX: 0,
    defaultOffsetY: loop ? -8 : 0,
    renderLayer: loop ? 'behind-characters' : 'front-of-characters',
  };
}

function ingest(): Promise<void> {
  inflight ??= fetchWonsrSpriteIndex()
    .then((index) => {
      for (const [id, sheet] of Object.entries(index.groups.effects)) {
        byId[`${WONSR_FX_PREFIX}${id}`] = toDef(id, sheet, 'fx');
        byId[`${WONSR_AURA_PREFIX}${id}`] = toDef(id, sheet, 'aura');
      }
      loaded = true;
    })
    .catch((error) => {
      inflight = null;
      throw error;
    });
  return inflight;
}

export function isWonsrVfxId(id: string | null | undefined): boolean {
  if (!id) return false;
  return id.startsWith(WONSR_FX_PREFIX) || id.startsWith(WONSR_AURA_PREFIX);
}

export function getWonsrVfx(id: string | null | undefined): SharedVfxDefinition | null {
  if (!id) return null;
  return byId[id] ?? null;
}

export function listWonsrVfx(): SharedVfxDefinition[] {
  return Object.values(byId);
}

export function wonsrVfxCatalogReady(): boolean {
  return loaded;
}

/** Carrega só effects (sem missiles/outfits) para o Lab. */
export function ensureWonsrVfxCatalog(): Promise<void> {
  if (loaded) return Promise.resolve();
  return ingest();
}
