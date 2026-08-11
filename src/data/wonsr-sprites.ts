import * as Phaser from 'phaser';

/**
 * Índice dos spritesheets exportados do WONSR (`npm run wonsr:sheets`).
 *
 * Layout das folhas: colunas = fases da animação, linhas = variação
 * (direção nos outfits; patternX/patternY nos efeitos e missiles).
 */
export const WONSR_SPRITE_INDEX_URL = '/data/wonsr/sprite-index.json';

export type WonsrDirection = 'north' | 'east' | 'south' | 'west';

/** Caixa dos pixels visíveis dentro de um frame (união de todos os frames). */
export interface WonsrContentBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface WonsrSheetBase {
  url: string;
  frameWidth: number;
  frameHeight: number;
  phases: number;
  tiles: { width: number; height: number };
  /** Ausente em manifestos gerados antes da medição de conteúdo. */
  content?: WonsrContentBounds;
}

export interface WonsrOutfitSheet extends WonsrSheetBase {
  directions: WonsrDirection[];
  /** Outfits do Tibia com layer de template de cor (não aplicamos tint ainda). */
  hasColorTemplate: boolean;
}

export interface WonsrAnimationSheet extends WonsrSheetBase {
  /** Combinações de patternX × patternY (direções do projétil, variantes do efeito). */
  variants: number;
}

export interface WonsrSpriteIndex {
  generatedAt: string;
  directions: WonsrDirection[];
  groups: {
    outfits: Record<string, WonsrOutfitSheet>;
    effects: Record<string, WonsrAnimationSheet>;
    missiles: Record<string, WonsrAnimationSheet>;
  };
  counts: Record<string, number>;
}

/** Chave de textura estável por grupo/id. */
export function wonsrTextureKey(
  group: keyof WonsrSpriteIndex['groups'],
  id: number | string,
): string {
  return `wonsr-${group}-${id}`;
}

/** Índice do frame na folha (linha = variação, coluna = fase). */
export function wonsrFrameIndex(
  sheet: WonsrSheetBase,
  row: number,
  phase: number,
): number {
  return row * sheet.phases + (phase % sheet.phases);
}

/** Frames de caminhada de um outfit numa direção. */
export function outfitWalkFrames(
  sheet: WonsrOutfitSheet,
  direction: WonsrDirection,
): number[] {
  const row = Math.max(0, sheet.directions.indexOf(direction));
  return Array.from({ length: sheet.phases }, (_, phase) =>
    wonsrFrameIndex(sheet, row, phase),
  );
}

/** Frame parado (fase 0) de um outfit numa direção. */
export function outfitIdleFrame(
  sheet: WonsrOutfitSheet,
  direction: WonsrDirection,
): number {
  const row = Math.max(0, sheet.directions.indexOf(direction));
  return wonsrFrameIndex(sheet, row, 0);
}

/** Como desenhar uma folha num tamanho padrão, com os pés no ponto do mundo. */
export interface WonsrSpriteFit {
  /** Escala Y (altura). Também usada em X se `scaleX` omitido. */
  scale: number;
  /** Escala X opcional (silhuetas largas). */
  scaleX?: number;
  originX: number;
  originY: number;
}

/**
 * Escala e âncora para que o desenho fique com `targetHeight` px de altura e
 * a base apoiada na posição do personagem. A origem sai do centro horizontal
 * e da base do conteúdo, e não da moldura, que costuma ter folga em volta.
 */
export function wonsrSpriteFit(
  sheet: WonsrSheetBase,
  targetHeight: number,
): WonsrSpriteFit {
  const content = sheet.content ?? {
    x: 0,
    y: 0,
    width: sheet.frameWidth,
    height: sheet.frameHeight,
  };

  return {
    scale: content.height > 0 ? targetHeight / content.height : 1,
    originX: (content.x + content.width / 2) / sheet.frameWidth,
    originY: (content.y + content.height) / sheet.frameHeight,
  };
}

/** Enfileira uma folha no loader do Phaser. Devolve a texture key. */
export function loadWonsrSheet(
  scene: Phaser.Scene,
  group: keyof WonsrSpriteIndex['groups'],
  id: number | string,
  sheet: WonsrSheetBase,
): string {
  const key = wonsrTextureKey(group, id);
  if (!scene.textures.exists(key)) {
    scene.load.spritesheet(key, sheet.url, {
      frameWidth: sheet.frameWidth,
      frameHeight: sheet.frameHeight,
    });
  }
  return key;
}

/**
 * Registra as quatro animações de caminhada de um outfit.
 * Retorna o mapa direção → chave da animação.
 */
export function ensureOutfitWalkAnims(
  scene: Phaser.Scene,
  lookType: number | string,
  sheet: WonsrOutfitSheet,
  frameRate = 8,
): Record<WonsrDirection, string> {
  const textureKey = wonsrTextureKey('outfits', lookType);
  const result = {} as Record<WonsrDirection, string>;

  for (const direction of sheet.directions) {
    const animKey = `${textureKey}-walk-${direction}`;
    result[direction] = animKey;
    if (scene.anims.exists(animKey)) continue;
    scene.anims.create({
      key: animKey,
      frames: outfitWalkFrames(sheet, direction).map((frame) => ({
        key: textureKey,
        frame,
      })),
      frameRate,
      repeat: -1,
    });
  }

  return result;
}

/**
 * Enfileira sob demanda as folhas de outfit de vários lookTypes e resolve
 * quando o loader termina. Sheets inexistentes ou já carregadas são ignoradas.
 */
export function loadOutfitSheets(
  scene: Phaser.Scene,
  index: WonsrSpriteIndex,
  lookTypes: Iterable<number | string>,
  extraSheets: Iterable<{
    group: 'effects' | 'missiles';
    id: number | string;
  }> = [],
): Promise<void> {
  let queued = 0;
  const seen = new Set<string>();

  for (const lookType of lookTypes) {
    const id = String(lookType);
    const ref = `outfits:${id}`;
    if (seen.has(ref)) continue;
    seen.add(ref);

    const sheet = index.groups.outfits[id];
    if (!sheet) continue;
    const key = wonsrTextureKey('outfits', id);
    if (scene.textures.exists(key)) continue;

    scene.load.spritesheet(key, sheet.url, {
      frameWidth: sheet.frameWidth,
      frameHeight: sheet.frameHeight,
    });
    queued++;
  }

  for (const { group, id: rawId } of extraSheets) {
    const id = String(rawId);
    const ref = `${group}:${id}`;
    if (seen.has(ref)) continue;
    seen.add(ref);

    const sheet = index.groups[group][id];
    if (!sheet) continue;
    const key = wonsrTextureKey(group, id);
    if (scene.textures.exists(key)) continue;

    scene.load.spritesheet(key, sheet.url, {
      frameWidth: sheet.frameWidth,
      frameHeight: sheet.frameHeight,
    });
    queued++;
  }

  if (queued === 0) return Promise.resolve();

  return new Promise((resolve) => {
    scene.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
    scene.load.start();
  });
}

let cached: Promise<WonsrSpriteIndex> | null = null;

/** Busca o índice uma única vez por sessão. */
export function fetchWonsrSpriteIndex(): Promise<WonsrSpriteIndex> {
  cached ??= fetch(WONSR_SPRITE_INDEX_URL).then((response) => {
    if (!response.ok) {
      throw new Error(`Índice de sprites WONSR: HTTP ${response.status}`);
    }
    return response.json() as Promise<WonsrSpriteIndex>;
  });
  return cached;
}
