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
  if (frameHeight > imageHeight) return null;
  const cols = imageWidth / frameWidth;
  if (!Number.isInteger(cols) || cols < 1) return null;
  return cols;
}
