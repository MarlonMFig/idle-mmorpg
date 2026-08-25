/**
 * Loop de frames (Pose e VFX). UI/API 1-based (frame 1 = primeiro quadro).
 *
 * Compat: `loop: false` → none; `loop: true` → full.
 * `range` (legado) = `persistent-range`.
 *
 * persistent-range:
 *   FIRST PASS = todos os frames 1..N uma vez
 *   depois PERSISTENT LOOP = start..end até duração / fim da skill.
 *
 * Outro (`play-rest`) fica no schema mas o Hunt ainda não tem "effect ended" fiável.
 */

export const FRAME_LOOP_MODES = ['none', 'full', 'persistent-range'] as const;
export type FrameLoopMode = (typeof FRAME_LOOP_MODES)[number];

/** Aceite legado `range` na leitura. */
export type FrameLoopModeInput = FrameLoopMode | 'range';

export const AFTER_LOOP_MODES = ['hold', 'play-rest'] as const;
export type AfterLoopMode = (typeof AFTER_LOOP_MODES)[number];

export type FrameLoopPhase = 'first-pass' | 'persistent-loop' | 'done';

export interface FrameLoopConfig {
  mode: FrameLoopMode;
  /** 1-based, inclusive. */
  startFrame: number;
  /** 1-based, inclusive. */
  endFrame: number;
  afterLoop?: AfterLoopMode;
  /** Duração do persistent loop em ms. 0 = só untilSkillEnd / default. */
  durationMs?: number;
  untilSkillEnd?: boolean;
}

export interface FrameLoopState {
  phase: FrameLoopPhase;
  /** 0-based. */
  frameIndex: number;
  loopElapsedMs: number;
}

export function isFrameLoopMode(value: unknown): value is FrameLoopModeInput {
  return value === 'none' || value === 'full' || value === 'persistent-range' || value === 'range';
}

export function canonicalizeLoopMode(value: unknown): FrameLoopMode | null {
  if (value === 'range' || value === 'persistent-range') return 'persistent-range';
  if (value === 'none' || value === 'full') return value;
  return null;
}

export function loopModeFromLegacy(
  loop: boolean | undefined,
  mode?: FrameLoopModeInput | null,
): FrameLoopMode {
  const canonical = canonicalizeLoopMode(mode);
  if (canonical) return canonical;
  return loop ? 'full' : 'none';
}

export function legacyLoopFromMode(mode: FrameLoopMode): boolean {
  return mode !== 'none';
}

export function clampLoopRange(
  frameCount: number,
  startFrame: number,
  endFrame: number,
): { startFrame: number; endFrame: number } {
  const total = Math.max(1, Math.floor(frameCount));
  let start = Math.round(startFrame);
  let end = Math.round(endFrame);
  if (!Number.isFinite(start)) start = 1;
  if (!Number.isFinite(end)) end = total;
  start = Math.min(total, Math.max(1, start));
  end = Math.min(total, Math.max(1, end));
  if (start > end) {
    const swap = start;
    start = end;
    end = swap;
  }
  return { startFrame: start, endFrame: end };
}

export function normalizeFrameLoop(
  frameCount: number,
  partial?: Partial<FrameLoopConfig> & { loop?: boolean; mode?: FrameLoopModeInput | null },
): FrameLoopConfig {
  const mode = loopModeFromLegacy(partial?.loop, partial?.mode);
  const range = clampLoopRange(
    frameCount,
    partial?.startFrame ?? 1,
    partial?.endFrame ?? Math.max(1, frameCount),
  );
  return {
    mode,
    startFrame: range.startFrame,
    endFrame: range.endFrame,
    afterLoop: partial?.afterLoop === 'play-rest' ? 'play-rest' : 'hold',
    durationMs: partial?.durationMs,
    untilSkillEnd: Boolean(partial?.untilSkillEnd),
  };
}

export function createFrameLoopState(): FrameLoopState {
  return { phase: 'first-pass', frameIndex: 0, loopElapsedMs: 0 };
}

export function resolvePersistentLoopDuration(input: {
  durationMs?: number | null;
  untilSkillEnd?: boolean;
  skillDurationMs?: number | null;
}): { untilSkillEnd: boolean; durationMs: number } {
  if (input.untilSkillEnd) {
    const skill =
      input.skillDurationMs != null && input.skillDurationMs > 0
        ? input.skillDurationMs
        : input.durationMs != null && input.durationMs > 0
          ? input.durationMs
          : 0;
    return { untilSkillEnd: true, durationMs: skill };
  }
  if (input.durationMs != null && input.durationMs > 0) {
    return { untilSkillEnd: false, durationMs: Math.round(input.durationMs) };
  }
  if (input.skillDurationMs != null && input.skillDurationMs > 0) {
    return { untilSkillEnd: false, durationMs: Math.round(input.skillDurationMs) };
  }
  return { untilSkillEnd: false, durationMs: 3000 };
}

/**
 * Avança um frame. `frameDurationMs` = 1000/fps (mesmo FPS no first pass e no loop).
 * `null` no sentido antigo não existe: `phase === 'done'` segura o último quadro.
 */
export function stepFrameLoop(
  state: FrameLoopState,
  frameCount: number,
  config: FrameLoopConfig,
  frameDurationMs: number,
): FrameLoopState {
  const total = Math.max(1, frameCount);
  const cfg = normalizeFrameLoop(total, config);
  const dt = Math.max(0, frameDurationMs);
  const start0 = cfg.startFrame - 1;
  const end0 = cfg.endFrame - 1;
  let { phase, frameIndex, loopElapsedMs } = state;
  frameIndex = Math.min(total - 1, Math.max(0, frameIndex));

  if (phase === 'done') {
    return { phase, frameIndex, loopElapsedMs };
  }

  if (cfg.mode === 'none') {
    if (frameIndex + 1 >= total) return { phase: 'done', frameIndex, loopElapsedMs };
    return { phase: 'first-pass', frameIndex: frameIndex + 1, loopElapsedMs };
  }

  if (cfg.mode === 'full') {
    return { phase: 'first-pass', frameIndex: (frameIndex + 1) % total, loopElapsedMs };
  }

  if (phase === 'first-pass') {
    if (frameIndex + 1 < total) {
      return { phase: 'first-pass', frameIndex: frameIndex + 1, loopElapsedMs: 0 };
    }
    return { phase: 'persistent-loop', frameIndex: start0, loopElapsedMs: 0 };
  }

  const resolved = resolvePersistentLoopDuration({
    durationMs: cfg.durationMs,
    untilSkillEnd: cfg.untilSkillEnd,
  });
  const nextElapsed = loopElapsedMs + dt;
  if (resolved.untilSkillEnd) {
    if (resolved.durationMs > 0 && nextElapsed >= resolved.durationMs) {
      return { phase: 'done', frameIndex, loopElapsedMs: nextElapsed };
    }
  } else if (resolved.durationMs > 0 && nextElapsed >= resolved.durationMs) {
    return { phase: 'done', frameIndex, loopElapsedMs: nextElapsed };
  }
  const nextFrame = frameIndex >= end0 ? start0 : frameIndex + 1;
  return { phase: 'persistent-loop', frameIndex: nextFrame, loopElapsedMs: nextElapsed };
}

export function isIndexInLoopRange(
  zeroBased: number,
  frameCount: number,
  config: FrameLoopConfig,
): boolean {
  const { mode, startFrame, endFrame } = normalizeFrameLoop(frameCount, config);
  if (mode !== 'persistent-range') return false;
  const n = zeroBased + 1;
  return n >= startFrame && n <= endFrame;
}

/** Sequência 1-based para testes. */
export function collectFrameSequence(
  frameCount: number,
  config: FrameLoopConfig,
  steps: number,
  frameDurationMs = 125,
): { frames: number[]; phases: FrameLoopPhase[] } {
  let state = createFrameLoopState();
  const frames = [state.frameIndex + 1];
  const phases: FrameLoopPhase[] = [state.phase];
  for (let i = 0; i < steps; i += 1) {
    state = stepFrameLoop(state, frameCount, config, frameDurationMs);
    frames.push(state.frameIndex + 1);
    phases.push(state.phase);
    if (state.phase === 'done') break;
  }
  return { frames, phases };
}
