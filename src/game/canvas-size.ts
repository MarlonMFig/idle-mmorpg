/** Resolução inicial do canvas (RESIZE ajusta ao parent em tempo real). */
export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

/** WebGL exige framebuffer >= 2px; evita "Incomplete Attachment" com parent 0×0. */
export function resolveCanvasSize(parent: HTMLElement): { width: number; height: number } {
  return {
    width: Math.max(2, parent.clientWidth || GAME_WIDTH),
    height: Math.max(2, parent.clientHeight || GAME_HEIGHT),
  };
}
