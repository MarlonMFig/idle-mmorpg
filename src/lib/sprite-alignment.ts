/**
 * Alignment visual global por personagem (Hub / Hunt).
 * Não altera PNG, frame size, hitbox, mapas nem timing de animação.
 * Compõe com offsets de pose/skill; não os substitui.
 */

export type SpriteAlignmentContext = 'hub' | 'hunt';

/** Contextos futuros (não usados na UI ainda). */
export type SpriteAlignmentContextFuture = SpriteAlignmentContext | 'boss' | 'dialogue' | 'preview' | 'character-select';

export interface SpriteAlignmentPoint {
  x: number;
  y: number;
}

export interface SpriteAlignmentConfig {
  hub?: SpriteAlignmentPoint;
  hunt?: SpriteAlignmentPoint;
}

export const ZERO_ALIGNMENT: SpriteAlignmentPoint = { x: 0, y: 0 };

export function normalizeAlignmentPoint(
  point?: Partial<SpriteAlignmentPoint> | null,
): SpriteAlignmentPoint {
  const x = Number(point?.x);
  const y = Number(point?.y);
  return {
    x: Number.isFinite(x) ? Math.round(x) : 0,
    y: Number.isFinite(y) ? Math.round(y) : 0,
  };
}

export function normalizeSpriteAlignment(
  config?: SpriteAlignmentConfig | null,
): Required<SpriteAlignmentConfig> {
  return {
    hub: normalizeAlignmentPoint(config?.hub),
    hunt: normalizeAlignmentPoint(config?.hunt),
  };
}

export function resolveSpriteAlignment(
  config: SpriteAlignmentConfig | undefined | null,
  context: SpriteAlignmentContext,
): SpriteAlignmentPoint {
  return normalizeAlignmentPoint(config?.[context]);
}

export function alignmentsEqual(
  a?: SpriteAlignmentConfig | null,
  b?: SpriteAlignmentConfig | null,
): boolean {
  const left = normalizeSpriteAlignment(a);
  const right = normalizeSpriteAlignment(b);
  return (
    left.hub.x === right.hub.x &&
    left.hub.y === right.hub.y &&
    left.hunt.x === right.hunt.x &&
    left.hunt.y === right.hunt.y
  );
}

/** Pose/skill offset (folha) — separado do global. */
export function composeRenderOffsets(input: {
  alignment: SpriteAlignmentPoint;
  poseOffset: SpriteAlignmentPoint;
}): SpriteAlignmentPoint {
  return {
    x: input.alignment.x + input.poseOffset.x,
    y: input.alignment.y + input.poseOffset.y,
  };
}

/**
 * Posição visual diagnóstica (não força sprite.x/y no gameplay).
 * Base → Character Global → Pose/Skill.
 */
export function composeFinalVisualPosition(input: {
  base: SpriteAlignmentPoint;
  alignment: SpriteAlignmentPoint;
  poseOffset: SpriteAlignmentPoint;
}): SpriteAlignmentPoint {
  return {
    x: input.base.x + input.alignment.x + input.poseOffset.x,
    y: input.base.y + input.alignment.y + input.poseOffset.y,
  };
}

export function formatSignedPx(value: number): string {
  if (value > 0) return `+${value}`;
  return String(value);
}
