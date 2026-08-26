import type { CharacterUniverse } from '@/types/character-definition';

/**
 * Universos de pasta em `public/vfx/`. `shared` = reutilizável entre franquias.
 * Target Mode / Travel Speed NÃO entram aqui — são override da Skill.
 */
export const VFX_UNIVERSES = [
  'naruto',
  'dragon-ball',
  'bleach',
  'black-clover',
  'one-piece',
  'kenshin',
  'jujutsu',
  'hunter',
  'wonsr',
  'other',
  'shared',
] as const;

export type VfxUniverse = (typeof VFX_UNIVERSES)[number];

export function isVfxUniverse(value: unknown): value is VfxUniverse {
  return typeof value === 'string' && (VFX_UNIVERSES as readonly string[]).includes(value);
}

export function universeFolder(universe: VfxUniverse | CharacterUniverse): string {
  if (universe === 'jujutsu') return 'jujutsu';
  return universe;
}

export type VfxSourceType = 'spritesheet' | 'sequence';

/** Camada de render do VFX no mundo Phaser. Ausente = frente dos personagens. */
export const VFX_RENDER_LAYERS = ['behind-characters', 'front-of-characters', 'foreground'] as const;

export type VfxRenderLayer = (typeof VFX_RENDER_LAYERS)[number];

export const VFX_RENDER_LAYER_LABELS: Record<VfxRenderLayer, string> = {
  'behind-characters': 'Atrás dos personagens',
  'front-of-characters': 'Frente dos personagens',
  foreground: 'Primeiro plano',
};

export function isVfxRenderLayer(value: unknown): value is VfxRenderLayer {
  return typeof value === 'string' && (VFX_RENDER_LAYERS as readonly string[]).includes(value);
}

export function resolveVfxRenderLayer(value: VfxRenderLayer | null | undefined): VfxRenderLayer {
  return value && isVfxRenderLayer(value) ? value : 'front-of-characters';
}

export const VFX_FPS_PRESETS = [8, 12, 15, 20, 24, 30] as const;

/**
 * Definição global de um VFX reutilizável.
 * Não contém targeting nem travelSpeed — isso fica na Skill.
 *
 * `sourceType` (default `spritesheet`):
 * - spritesheet / imagem única: `url` aponta para o PNG/WEBP.
 * - sequence: `frames` lista cada PNG; o loader costura numa textura só.
 *
 * Engine: sprite sheet (fileira esquerda→direita, depois linhas).
 * `frameCount` limita quantos frames tocar.
 */
export interface SharedVfxDefinition {
  id: string;
  name: string;
  universe: VfxUniverse;
  /**
   * URL pública representativa.
   * Spritesheet: `/vfx/<universo>/<arquivo>.png|webp`.
   * Sequência: primeiro frame em `/vfx/<universo>/<id>/frame-001.png`.
   */
  url: string;
  /** Ausente = spritesheet (catálogo antigo). */
  sourceType?: VfxSourceType;
  /** URLs dos frames, na ordem de playback. Só para `sourceType: 'sequence'`. */
  frames?: readonly string[];
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  frameRate: number;
  loop: boolean;
  defaultScale: number;
  defaultOffsetX: number;
  defaultOffsetY: number;
  /** Ausente = `front-of-characters` (VFX ofensivo na frente do sprite). */
  renderLayer?: VfxRenderLayer;
}

export function isSequenceVfx(def: Pick<SharedVfxDefinition, 'sourceType'>): boolean {
  return (def.sourceType ?? 'spritesheet') === 'sequence';
}

export function vfxFrameUrls(def: SharedVfxDefinition): readonly string[] {
  if (isSequenceVfx(def) && def.frames && def.frames.length > 0) return def.frames;
  return def.url ? [def.url] : [];
}

/** Ordenação natural: frame-2 < frame-10, não frame-10 < frame-2. */
export function naturalNameSort(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

export function formatSequenceDimensionError(
  indexZeroBased: number,
  expected: { width: number; height: number },
  found: { width: number; height: number },
): string {
  return [
    `Frame ${indexZeroBased + 1} possui dimensão diferente.`,
    '',
    `Esperado: ${expected.width}×${expected.height}`,
    `Encontrado: ${found.width}×${found.height}`,
  ].join('\n');
}

export const VFX_ID_PATTERN = /^[a-z][a-z0-9-]{1,62}$/;

export function isVfxId(value: unknown): value is string {
  return typeof value === 'string' && VFX_ID_PATTERN.test(value);
}

export function suggestHorizontalFrameCount(
  imageWidth: number,
  imageHeight: number,
  frameWidth: number,
  frameHeight: number,
): number | null {
  if (!(frameWidth > 0) || !(frameHeight > 0)) return null;
  if (imageWidth % frameWidth !== 0) return null;
  if (imageHeight % frameHeight !== 0) return null;
  const cols = imageWidth / frameWidth;
  const rows = imageHeight / frameHeight;
  if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols < 1 || rows < 1) return null;
  return cols * rows;
}

export interface SpritesheetLayoutGuess {
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  cols: number;
  rows: number;
}

function positiveDivisors(n: number): number[] {
  const out: number[] = [];
  const limit = Math.floor(Math.sqrt(n));
  for (let i = 1; i <= limit; i += 1) {
    if (n % i !== 0) continue;
    out.push(i);
    const pair = n / i;
    if (pair !== i) out.push(pair);
  }
  return out.sort((a, b) => a - b);
}

/**
 * Infere layout de uma spritesheet completa (fileira L→R, depois linhas).
 * Prioriza faixas horizontais de frames quadrados (altura = frame) e grids
 * quadrados; depois tenta divisores comuns da largura com altura = frame.
 */
export function detectSpritesheetLayout(
  imageWidth: number,
  imageHeight: number,
): SpritesheetLayoutGuess | null {
  if (!(imageWidth > 0) || !(imageHeight > 0)) return null;

  const candidates: SpritesheetLayoutGuess[] = [];
  const push = (frameWidth: number, frameHeight: number) => {
    const count = suggestHorizontalFrameCount(imageWidth, imageHeight, frameWidth, frameHeight);
    if (count == null || count < 1) return;
    if (frameWidth < 16 || frameHeight < 16) return;
    candidates.push({
      frameWidth,
      frameHeight,
      frameCount: count,
      cols: imageWidth / frameWidth,
      rows: imageHeight / frameHeight,
    });
  };

  // Sempre candidata: imagem inteira = 1 frame (VFX estático / sheet já cortada).
  push(imageWidth, imageHeight);

  // 1) Faixa horizontal de frames quadrados (H×H).
  if (imageWidth % imageHeight === 0 && imageWidth / imageHeight >= 2) {
    push(imageHeight, imageHeight);
  }
  // 2) Coluna vertical de frames quadrados (W×W).
  if (imageHeight % imageWidth === 0 && imageHeight / imageWidth >= 2) {
    push(imageWidth, imageWidth);
  }
  // 3) Grid de células quadradas (ex.: 4×4).
  const cellSizes = positiveDivisors(Math.min(imageWidth, imageHeight)).filter((n) => n >= 16);
  for (let i = cellSizes.length - 1; i >= 0; i -= 1) {
    push(cellSizes[i], cellSizes[i]);
  }
  // 4) Faixa única (altura = frameHeight), largura divide em N frames.
  for (const cols of positiveDivisors(imageWidth)) {
    if (cols < 2 || cols > 128) continue;
    const frameWidth = imageWidth / cols;
    if (frameWidth < 16) continue;
    push(frameWidth, imageHeight);
  }

  if (!candidates.length) {
    return {
      frameWidth: imageWidth,
      frameHeight: imageHeight,
      frameCount: 1,
      cols: 1,
      rows: 1,
    };
  }

  const score = (c: SpritesheetLayoutGuess): number => {
    const aspect = c.frameWidth / Math.max(1, c.frameHeight);
    const aspectPenalty = aspect < 0.25 || aspect > 4 ? 800 : Math.abs(Math.log(aspect)) * 40;
    const squareBonus = c.frameWidth === c.frameHeight ? -50 : 0;
    // Faixa horizontal clássica: altura da imagem = altura do frame.
    const stripBonus = c.rows === 1 && c.frameHeight === imageHeight && c.frameCount >= 2 ? -120 : 0;
    const singleRowBonus = c.rows === 1 ? -40 : c.rows > 4 ? 80 : 20;
    const squareImage = imageWidth === imageHeight;
    const squareImageGridBonus =
      squareImage && c.frameWidth === c.frameHeight && c.cols >= 2 && c.rows >= 2 ? -90 : 0;
    // Quadrado pequeno: quase sempre 1 frame; strip larga: nunca 1 frame.
    const singleFrameScore =
      c.frameCount === 1
        ? squareImage
          ? -160
          : imageWidth >= imageHeight * 2
            ? 300
            : -20
        : 0;
    const countBonus = [4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 24, 32].includes(c.frameCount) ? -35 : 0;
    const tooMany = c.frameCount > 48 ? (c.frameCount - 48) * 8 : 0;
    const tinyCell = c.frameWidth < 24 || c.frameHeight < 24 ? 120 : 0;
    return (
      aspectPenalty +
      squareBonus +
      stripBonus +
      singleRowBonus +
      squareImageGridBonus +
      singleFrameScore +
      countBonus +
      tooMany +
      tinyCell -
      Math.min(c.frameCount, 24)
    );
  };

  candidates.sort((a, b) => score(a) - score(b) || b.frameWidth - a.frameWidth);
  return candidates[0];
}
