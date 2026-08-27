import type { CharacterPack } from '@/data/character-packs';
import { getPackAnimation } from '@/data/characters/animation-slots';
import type { CharacterAnimSlot } from '@/types/character-definition';

export type SheetScale = { scaleX: number; scaleY: number };

const BODY_SLOTS: readonly CharacterAnimSlot[] = [
  'idle',
  'walk',
  'attack',
  'combo1',
  'combo2',
  'combo3',
  'hurt',
  'death',
];

/** Slots de locomção/combo/reação (não special — esses usam cast.scale na aba VFX). */
export function isBodyAnimSlot(slot: CharacterAnimSlot): boolean {
  return (BODY_SLOTS as readonly string[]).includes(slot);
}

export function readSheetScale(pack: CharacterPack, slot: CharacterAnimSlot): SheetScale {
  const sheet = getPackAnimation(pack, slot);
  return {
    scaleX: sheet?.scaleX ?? 1,
    scaleY: sheet?.scaleY ?? 1,
  };
}

/** Mutação ao vivo no pack (preview Lab). Persistência via patch no fonte. */
export function writeSheetScale(
  pack: CharacterPack,
  slot: CharacterAnimSlot,
  scale: SheetScale,
): boolean {
  const sheet = getPackAnimation(pack, slot);
  if (!sheet) return false;
  const sx = Number.isFinite(scale.scaleX) ? Math.max(0.05, scale.scaleX) : 1;
  const sy = Number.isFinite(scale.scaleY) ? Math.max(0.05, scale.scaleY) : 1;
  sheet.scaleX = sx;
  sheet.scaleY = sy;
  return true;
}

export function sheetScaleDirty(
  drafts: Partial<Record<CharacterAnimSlot, SheetScale>>,
  originals: Partial<Record<CharacterAnimSlot, SheetScale>>,
): boolean {
  for (const slot of Object.keys(drafts) as CharacterAnimSlot[]) {
    const d = drafts[slot];
    if (!d) continue;
    const o = originals[slot] ?? { scaleX: 1, scaleY: 1 };
    if (Math.abs(d.scaleX - o.scaleX) > 0.0001 || Math.abs(d.scaleY - o.scaleY) > 0.0001) {
      return true;
    }
  }
  return false;
}
