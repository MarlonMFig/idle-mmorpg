import type { SpriteSheetDef } from '@/data/character-packs';
import { getDevVfx, mergeDevVfxCatalog } from '@/lib/dev/dev-runtime-registry';
import { VFX_BY_ID } from './catalog';
import { isSequenceVfx, vfxFrameUrls, type SharedVfxDefinition } from './types';
import { getWonsrVfx, listWonsrVfx } from './wonsr-catalog';

export function sharedVfxTextureKey(id: string): string {
  return `shared-vfx-${id}`;
}

export function sharedVfxToSheet(def: SharedVfxDefinition): SpriteSheetDef {
  const urls = vfxFrameUrls(def);
  return {
    key: sharedVfxTextureKey(def.id),
    url: urls[0] ?? def.url,
    frameWidth: def.frameWidth,
    frameHeight: def.frameHeight,
    frameCount: isSequenceVfx(def) ? urls.length || def.frameCount : def.frameCount,
    frameRate: def.frameRate,
    offsetX: def.defaultOffsetX,
    offsetY: def.defaultOffsetY,
  };
}

export function getVfxDefinition(vfxId: string | null | undefined): SharedVfxDefinition | null {
  if (!vfxId) return null;
  const overlay = getDevVfx(vfxId);
  if (overlay) return overlay;
  return VFX_BY_ID[vfxId] ?? getWonsrVfx(vfxId);
}

export function listVfxDefinitions(): SharedVfxDefinition[] {
  const merged = mergeDevVfxCatalog(VFX_BY_ID);
  for (const def of listWonsrVfx()) {
    if (!merged[def.id]) merged[def.id] = def;
  }
  return Object.values(merged).slice().sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

export function vfxMatchesQuery(def: SharedVfxDefinition, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    def.id.toLowerCase().includes(q) ||
    def.name.toLowerCase().includes(q) ||
    def.universe.toLowerCase().includes(q)
  );
}
