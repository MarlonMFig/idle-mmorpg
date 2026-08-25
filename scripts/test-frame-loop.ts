/**
 * Playback visual: first pass completo → persistent range.
 * Run: npx --yes tsx scripts/test-frame-loop.ts
 */
import {
  collectFrameSequence,
  createFrameLoopState,
  loopModeFromLegacy,
  stepFrameLoop,
  type FrameLoopConfig,
} from '../src/lib/frame-loop';

function assert(name: string, cond: boolean, detail?: string): void {
  if (!cond) throw new Error(`FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  console.log(`ok  ${name}`);
}

function take(frames: number[], n: number): number[] {
  return frames.slice(0, n);
}

const persistent: FrameLoopConfig = {
  mode: 'persistent-range',
  startFrame: 9,
  endFrame: 16,
  durationMs: 3000,
};

{
  const { frames, phases } = collectFrameSequence(16, persistent, 80, 125);
  assert('compat loop false → none', loopModeFromLegacy(false) === 'none');
  assert('compat loop true → full', loopModeFromLegacy(true) === 'full');
  assert('compat range → persistent-range', loopModeFromLegacy(false, 'range') === 'persistent-range');
  assert(
    'first pass 1–16',
    take(frames, 16).join(',') === '1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16',
    frames.slice(0, 16).join(','),
  );
  assert('first 16 frames still first-pass or entering loop', phases[15] === 'first-pass');
  assert('frame 17 starts persistent at 9', frames[16] === 9, `got ${frames[16]} phase ${phases[16]}`);
  assert('phase after first pass is persistent-loop', phases[16] === 'persistent-loop');
  assert(
    'then 9–16',
    take(frames.slice(16), 8).join(',') === '9,10,11,12,13,14,15,16',
    frames.slice(16, 24).join(','),
  );
  const firstSixteen = frames.slice(0, 16);
  assert('never skipped first pass', firstSixteen[8] === 9 && firstSixteen[15] === 16);
}

{
  const { frames } = collectFrameSequence(
    16,
    { mode: 'persistent-range', startFrame: 9, endFrame: 13, durationMs: 5000 },
    40,
    125,
  );
  assert('9–13 after full 1–16', take(frames, 16).join(',').startsWith('1,2,3,4,5,6,7,8,9'));
  assert('loop 9–13', take(frames.slice(16), 5).join(',') === '9,10,11,12,13', frames.slice(16, 21).join(','));
}

{
  const { frames } = collectFrameSequence(
    16,
    { mode: 'persistent-range', startFrame: 12, endFrame: 12, durationMs: 1000 },
    24,
    125,
  );
  assert('12–12 after 1–16', frames[15] === 16 && frames[16] === 12 && frames[17] === 12);
}

{
  const { frames, phases } = collectFrameSequence(8, { mode: 'none', startFrame: 1, endFrame: 8 }, 20, 125);
  assert('no loop stops at last', frames[7] === 8 && phases[frames.length - 1] === 'done');
}

{
  const { frames } = collectFrameSequence(4, { mode: 'full', startFrame: 1, endFrame: 4 }, 8, 125);
  assert('full loop wraps', take(frames, 8).join(',') === '1,2,3,4,1,2,3,4');
}

{
  let state = createFrameLoopState();
  const cfg: FrameLoopConfig = { mode: 'persistent-range', startFrame: 9, endFrame: 16, durationMs: 3000 };
  for (let i = 0; i < 10; i += 1) state = stepFrameLoop(state, 16, cfg, 125);
  assert('pause mid first-pass stays first-pass', state.phase === 'first-pass' && state.frameIndex === 10);
  state = stepFrameLoop(state, 16, cfg, 125);
  assert('resume continues first-pass', state.frameIndex === 11 && state.phase === 'first-pass');
}

{
  let state = createFrameLoopState();
  const cfg: FrameLoopConfig = { mode: 'persistent-range', startFrame: 9, endFrame: 16, durationMs: 3000 };
  for (let i = 0; i < 16; i += 1) state = stepFrameLoop(state, 16, cfg, 125);
  assert('entered loop', state.phase === 'persistent-loop' && state.frameIndex === 8);
  state = stepFrameLoop(state, 16, cfg, 125);
  assert('resume in loop', state.phase === 'persistent-loop' && state.frameIndex === 9);
}

{
  const { frames, phases } = collectFrameSequence(
    4,
    { mode: 'persistent-range', startFrame: 2, endFrame: 3, untilSkillEnd: true },
    20,
    125,
  );
  assert('first pass still 1-4 without vfx', take(frames, 4).join(',') === '1,2,3,4');
  assert('until skill end keeps looping', phases[phases.length - 1] === 'persistent-loop');
}

{
  const { phases } = collectFrameSequence(
    4,
    { mode: 'persistent-range', startFrame: 2, endFrame: 3, untilSkillEnd: true, durationMs: 250 },
    20,
    125,
  );
  assert('until skill end with known duration eventually done', phases.includes('done'));
}

console.log('all frame-loop tests passed');
