/**
 * Escala de VFX no Hunt (`pack-fx.ts`). O Visual Skill Editor reutiliza
 * estas contas para o preview coincidir com o combate, sem números soltos.
 *
 * `bodyH` / `fxW` / `fxH` são pixels de textura (frame), não de tela.
 */
export const PACK_FX_AIR_BODY_SCALE = 1.15;
export const PACK_FX_GROUND_BODY_SCALE = 1.05;
/** Centro do corpo: pés − altura × este fator. Igual a `playPackFx`. */
export const PACK_FX_MID_BODY_FACTOR = 0.5;

export function packFxFitScale(bodyH: number, fxW: number, fxH: number): number {
  const fitH = bodyH > 0 && fxH > bodyH * 1.35 ? Math.min(1, (bodyH * 1.85) / fxH) : 1;
  const fitW = bodyH > 0 && fxW > bodyH * 2.8 ? Math.min(1, (bodyH * 3.2) / fxW) : 1;
  return Math.min(fitH, fitW);
}

export function packFxDisplayScale(input: {
  bodyH: number;
  fxW: number;
  fxH: number;
  casterSpriteScaleX: number;
  scaleMult: number;
  ground?: boolean;
  independentScale?: boolean;
  worldScale?: number;
}): number {
  const scaleMult = input.scaleMult > 0 ? input.scaleMult : 1;
  if (input.independentScale) {
    return (input.worldScale ?? 1) * scaleMult;
  }
  const fit = packFxFitScale(input.bodyH, input.fxW, input.fxH);
  const body = input.ground ? PACK_FX_GROUND_BODY_SCALE : PACK_FX_AIR_BODY_SCALE;
  return input.casterSpriteScaleX * body * fit * scaleMult;
}
