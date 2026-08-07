import type { CharacterPack, SpriteSheetDef } from '@/data/character-packs';
import {
  CHOUJI_CURATED_LOOK_TYPE,
  GAARA_LOOK_TYPES,
  getCuratedPackByLookType,
  HINATA_CURATED_LOOK_TYPE,
  listPackSheets,
  NARUTO_SENNIN_LOOK_TYPE,
  NEJI_CURATED_LOOK_TYPE,
  NEJI_LOOK_TYPES,
  SAKURA_LOOK_TYPES,
  SHIKAMARU_LOOK_TYPE,
  UCHIHA_ITACHI_LOOK_TYPE,
} from '@/data/character-packs';

/** Preview estático (UI caças / inventário). */
const PREVIEW_BY_LOOK_TYPE: Record<number, string> = {
  [SHIKAMARU_LOOK_TYPE]: '/sprites/player/previews/shikamaru.png',
  ...Object.fromEntries(NEJI_LOOK_TYPES.map((look) => [look, '/sprites/player/previews/neji.png'])),
  [NEJI_CURATED_LOOK_TYPE]: '/sprites/player/previews/neji.png',
  ...Object.fromEntries(GAARA_LOOK_TYPES.map((look) => [look, '/sprites/player/previews/gaara.png'])),
  ...Object.fromEntries(SAKURA_LOOK_TYPES.map((look) => [look, '/sprites/player/previews/sakura.png'])),
  [CHOUJI_CURATED_LOOK_TYPE]: '/sprites/player/previews/chouji.png',
  [HINATA_CURATED_LOOK_TYPE]: '/sprites/player/previews/hinata.png',
  [NARUTO_SENNIN_LOOK_TYPE]: '/sprites/player/previews/naruto-sennin.png',
  [UCHIHA_ITACHI_LOOK_TYPE]: '/sprites/player/previews/itachi.png',
};

/** lookTypes com pack lateral no mapa (em vez do atlas/outfit WONSR). */
export function getCuratedMapPack(lookType: number): CharacterPack | null {
  return getCuratedPackByLookType(lookType);
}

export function getCuratedPortraitUrl(lookType: number): string | null {
  return PREVIEW_BY_LOOK_TYPE[lookType] ?? null;
}

export function listCuratedMapLookTypes(lookTypes: Iterable<number>): number[] {
  const out: number[] = [];
  for (const lookType of lookTypes) {
    if (getCuratedMapPack(lookType)) out.push(lookType);
  }
  return out;
}

/** lookTypes que ainda usam outfit WONSR no mapa. */
export function filterOutfitLookTypes(lookTypes: Iterable<number>): number[] {
  const out: number[] = [];
  for (const lookType of lookTypes) {
    if (!getCuratedMapPack(lookType)) out.push(lookType);
  }
  return out;
}

export function listSheetsForLookTypes(lookTypes: Iterable<number>): SpriteSheetDef[] {
  const seen = new Set<string>();
  const sheets: SpriteSheetDef[] = [];
  for (const lookType of lookTypes) {
    const pack = getCuratedMapPack(lookType);
    if (!pack) continue;
    for (const sheet of listPackSheets(pack)) {
      if (seen.has(sheet.key)) continue;
      seen.add(sheet.key);
      sheets.push(sheet);
    }
  }
  return sheets;
}
