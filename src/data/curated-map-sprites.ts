import type { CharacterPack, SpriteSheetDef } from '@/data/character-packs';
import {
  CHOUJI_CURATED_LOOK_TYPE,
  GAARA_LOOK_TYPES,
  getCuratedPackByLookType,
  GUY_CURATED_LOOK_TYPE,
  HINATA_CURATED_LOOK_TYPE,
  INO_CURATED_LOOK_TYPE,
  INO_LOOK_TYPES,
  JIRAIYA_LOOK_TYPES,
  JIROBO_LOOK_TYPES,
  KAKASHI_CURATED_LOOK_TYPE,
  listPackSheets,
  NARUTO_CLASSIC_LOOK_TYPE,
  NARUTO_SENNIN_LOOK_TYPE,
  NEJI_CURATED_LOOK_TYPE,
  NEJI_LOOK_TYPES,
  ROCK_LEE_LOOK_TYPE,
  SAKURA_LOOK_TYPES,
  SASUKE_CLASSIC_LOOK_TYPE,
  SHIKAMARU_LOOK_TYPE,
  TSUNADE_CURATED_LOOK_TYPE,
  UCHIHA_ITACHI_LOOK_TYPE,
  SHISUI_LOOK_TYPES,
  NARUTO_SHIPPUDEN_LOOK_TYPES,
  KABUTO_CURATED_LOOK_TYPE,
  KIBA_CURATED_LOOK_TYPE,
  KIMIMARO_CURATED_LOOK_TYPE,
  SASUKE_CURSED_CURATED_LOOK_TYPE,
  OROCHIMARU_CURATED_LOOK_TYPE,
  NARUTO_KYUBI_CURATED_LOOK_TYPE,
  KISAME_CURATED_LOOK_TYPE,
  DEIDARA_CURATED_LOOK_TYPE,
  SAKURA_SHIPPUDEN_CURATED_LOOK_TYPE,
  TENTEN_CURATED_LOOK_TYPE,
  TEMARI_CURATED_LOOK_TYPE,
  TAYUYA_CURATED_LOOK_TYPE,
  SHINO_CURATED_LOOK_TYPE,
} from '@/data/character-packs';
import { JUMP_FORCE_PREVIEW_BY_LOOK_TYPE } from '@/data/jump-force-packs';
import { NUN5_BATCH_PREVIEW_BY_LOOK_TYPE } from '@/data/nun5-batch-packs';

/** Preview estático (UI caças / inventário). */
const PREVIEW_BY_LOOK_TYPE: Record<number, string> = {
  [NARUTO_CLASSIC_LOOK_TYPE]: '/sprites/player/previews/naruto.png',
  [SASUKE_CLASSIC_LOOK_TYPE]: '/sprites/player/previews/sasuke.png',
  [ROCK_LEE_LOOK_TYPE]: '/sprites/player/previews/rock-lee.png',
  [SHIKAMARU_LOOK_TYPE]: '/sprites/player/previews/shikamaru.png',
  ...Object.fromEntries(NEJI_LOOK_TYPES.map((look) => [look, '/sprites/player/previews/neji.png'])),
  [NEJI_CURATED_LOOK_TYPE]: '/sprites/player/previews/neji.png',
  ...Object.fromEntries(GAARA_LOOK_TYPES.map((look) => [look, '/sprites/player/previews/gaara.png'])),
  ...Object.fromEntries(SAKURA_LOOK_TYPES.map((look) => [look, '/sprites/player/previews/sakura.png'])),
  [CHOUJI_CURATED_LOOK_TYPE]: '/sprites/player/previews/chouji.png',
  [HINATA_CURATED_LOOK_TYPE]: '/sprites/player/previews/hinata.png',
  [GUY_CURATED_LOOK_TYPE]: '/sprites/player/previews/guy.png',
  ...Object.fromEntries(INO_LOOK_TYPES.map((look) => [look, '/sprites/player/previews/ino.png'])),
  [INO_CURATED_LOOK_TYPE]: '/sprites/player/previews/ino.png',
  [KAKASHI_CURATED_LOOK_TYPE]: '/sprites/player/previews/kakashi.png',
  [NARUTO_SENNIN_LOOK_TYPE]: '/sprites/player/previews/naruto-sennin.png',
  [UCHIHA_ITACHI_LOOK_TYPE]: '/sprites/player/previews/itachi.png',
  ...Object.fromEntries(
    SHISUI_LOOK_TYPES.map((look) => [look, '/sprites/player/previews/shisui.png']),
  ),
  ...Object.fromEntries(
    NARUTO_SHIPPUDEN_LOOK_TYPES.map(
      (look) => [look, '/sprites/player/previews/naruto-shippuden.png'],
    ),
  ),
  ...Object.fromEntries(
    JIRAIYA_LOOK_TYPES.map((look) => [look, '/sprites/player/previews/jiraiya.png']),
  ),
  ...Object.fromEntries(
    JIROBO_LOOK_TYPES.map((look) => [look, '/sprites/player/previews/jirobo.png']),
  ),
  [KABUTO_CURATED_LOOK_TYPE]: '/sprites/player/previews/kabuto.png',
  [TSUNADE_CURATED_LOOK_TYPE]: '/sprites/player/previews/tsunade.png',
  [KIBA_CURATED_LOOK_TYPE]: '/sprites/player/previews/kiba.png',
  [KIMIMARO_CURATED_LOOK_TYPE]: '/sprites/player/previews/kimimaro.png',
  [SASUKE_CURSED_CURATED_LOOK_TYPE]: '/sprites/player/previews/sasuke-cursed.png',
  [OROCHIMARU_CURATED_LOOK_TYPE]: '/sprites/player/previews/orochimaru.png',
  [NARUTO_KYUBI_CURATED_LOOK_TYPE]: '/sprites/player/previews/naruto-kyubi.png',
  [KISAME_CURATED_LOOK_TYPE]: '/sprites/player/previews/kisame.png',
  [DEIDARA_CURATED_LOOK_TYPE]: '/sprites/player/previews/deidara.png',
  [SAKURA_SHIPPUDEN_CURATED_LOOK_TYPE]: '/sprites/player/previews/sakura-shippuden.png',
  [TENTEN_CURATED_LOOK_TYPE]: '/sprites/player/previews/tenten.png',
  [TEMARI_CURATED_LOOK_TYPE]: '/sprites/player/previews/temari.png',
  [TAYUYA_CURATED_LOOK_TYPE]: '/sprites/player/previews/tayuya.png',
  [SHINO_CURATED_LOOK_TYPE]: '/sprites/player/previews/shino.png',
  ...JUMP_FORCE_PREVIEW_BY_LOOK_TYPE,
  ...NUN5_BATCH_PREVIEW_BY_LOOK_TYPE,
};

/** lookTypes com pack lateral no mapa (em vez do atlas/outfit WONSR). */
export function getCuratedMapPack(lookType: number): CharacterPack | null {
  return getCuratedPackByLookType(lookType);
}

export function getCuratedPortraitUrl(lookType: number): string | null {
  return getCuratedMapPack(lookType) ? (PREVIEW_BY_LOOK_TYPE[lookType] ?? null) : null;
}

/** Preview da coleção / Test Mode — não depende do pack estar ativo na Hunt. */
export function getCharacterPreviewUrl(lookType: number): string {
  return PREVIEW_BY_LOOK_TYPE[lookType] ?? `/sprites/wonsr/outfits/${lookType}.png`;
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
