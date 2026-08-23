/**
 * Regression: timing visual da Skill (pose FPS, lock, VFX duration).
 * Não altera dados salvos no DEV Lab.
 */
import { applySharedVfxToAnim } from '../src/data/vfx/apply-skill-vfx';
import { characterLateralOrigin, getCharacterPackById } from '../src/data/character-packs';
import {
  framesDurationMs,
  skillActionLockMs,
  skillPoseDurationMs,
  skillVisualTimeline,
} from '../src/lib/combat-visual-timing';
import type { CharacterSkillAnimDef } from '../src/data/character-packs';

function assert(name: string, cond: boolean, detail?: string): void {
  if (!cond) throw new Error(`FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  console.log(`ok  ${name}`);
}

function huntRuntimeAnim(anim: CharacterSkillAnimDef): CharacterSkillAnimDef {
  return applySharedVfxToAnim(anim, anim.vfxId ?? null);
}

const poseOnly: CharacterSkillAnimDef = {
  key: 'pose-12',
  url: '/sprites/test.png',
  frameWidth: 32,
  frameHeight: 32,
  frameCount: 12,
  frameRate: 12,
  durationMs: 400,
  hitDelayMs: 200,
};

assert('12 frames @ 12fps = 1000ms', framesDurationMs(12, 12) === 1000);
assert('8 frames @ 8fps = 1000ms', framesDurationMs(8, 8) === 1000);
assert('FPS 12 não é frameDuration 12ms', framesDurationMs(1, 12) === 83);

assert(
  'lock usa pose, não durationMs curto',
  skillActionLockMs(poseOnly) >= skillPoseDurationMs(poseOnly) && skillActionLockMs(poseOnly) >= 1000,
  `lock=${skillActionLockMs(poseOnly)} pose=${skillPoseDurationMs(poseOnly)}`,
);
assert('cooldown não entra no lock', skillActionLockMs({ ...poseOnly, durationMs: 1000 }) === 1000);

const completeSkill: CharacterSkillAnimDef = {
  key: 'complete',
  url: '/sprites/pose.png',
  frameWidth: 32,
  frameHeight: 32,
  frameCount: 8,
  frameRate: 8,
  durationMs: 1000,
  hitDelayMs: 700,
  castDelayMs: 700,
  targeting: { mode: 'caster', travelSpeed: 0, spawnOffsetX: 0, spawnOffsetY: 0, targetOffsetX: 0, targetOffsetY: 0 },
  fx: {
    key: 'fx',
    url: '/sprites/fx.png',
    frameWidth: 32,
    frameHeight: 32,
    frameCount: 10,
    frameRate: 10,
  },
};
const complete = skillVisualTimeline(completeSkill);
assert('timeline pose 1000ms', complete.poseDurationMs === 1000);
assert('timeline effect start = cast delay 700', complete.effectStartMs === 700);
assert('timeline effect 10@10 = 1000ms', complete.effectDurationMs === 1000);
assert('timeline effect end 1700', complete.effectEndMs === 1700);
assert('timeline execution end >= pose', complete.executionEndMs >= 1000);

const naruto = getCharacterPackById('naruto-classic', { includeInactive: true });
const sasuke = getCharacterPackById('sasuke-classic', { includeInactive: true });
const kisame = getCharacterPackById('kisame', { includeInactive: true });
assert('pack naruto', Boolean(naruto));
assert('pack sasuke', Boolean(sasuke));
assert('pack kisame', Boolean(kisame));

const rasengan = naruto!.skillAnims['skill-rasengan'];
assert('rasengan existe', Boolean(rasengan));
const rasenganFile = skillVisualTimeline(rasengan);
const rasenganHunt = skillVisualTimeline(huntRuntimeAnim(rasengan));
assert('rasengan Lab=Hunt pose FPS', rasenganFile.poseFps === rasenganHunt.poseFps);
assert('rasengan Lab=Hunt pose duration', rasenganFile.poseDurationMs === rasenganHunt.poseDurationMs);
assert(
  'rasengan 48@12 ≈ 4000ms',
  rasenganFile.poseDurationMs === framesDurationMs(rasengan.frameCount, rasengan.frameRate),
);

const gokakyu = sasuke!.skillAnims['skill-katon-gokakyu'];
assert('gokakyu existe', Boolean(gokakyu));
const gokakyuFile = skillVisualTimeline(gokakyu);
const gokakyuHunt = skillVisualTimeline(huntRuntimeAnim(gokakyu));
assert('gokakyu Lab=Hunt pose duration', gokakyuFile.poseDurationMs === gokakyuHunt.poseDurationMs);
assert('gokakyu Lab=Hunt effect duration', gokakyuFile.effectDurationMs === gokakyuHunt.effectDurationMs);

const geyser = kisame!.skillAnims['skill-kisame-mizu-kanketsusen'];
const lance = kisame!.skillAnims['kisame-suiton-lance'];
assert('geyser sequence VFX', Boolean(geyser?.fx));
assert('lance travel-to-target', lance?.targeting?.mode === 'travel-to-target');
const geyserHuntAnim = huntRuntimeAnim(geyser);
const geyserTl = skillVisualTimeline(geyserHuntAnim);
const lanceTl = skillVisualTimeline(huntRuntimeAnim(lance));
assert(
  'geyser effect duration = frames/FPS do runtime',
  geyserTl.effectDurationMs === framesDurationMs(geyserHuntAnim.fx?.frameCount, geyserHuntAnim.fx?.frameRate),
);
assert('lance travel speed preservado', lanceTl.travelSpeed === lance.targeting?.travelSpeed);
assert('lance lock >= pose (não corta em durationMs 292 se FPS cair)', skillActionLockMs(lance) >= skillPoseDurationMs(lance));

const originA = characterLateralOrigin(naruto!, naruto!.idle);
const originShifted = characterLateralOrigin(naruto!, {
  ...naruto!.idle!,
  offsetX: (naruto!.idle?.offsetX ?? 0) + 40,
});
assert('offset muda origin, não é world X', originA.x !== originShifted.x);
assert('sprite sizes diferentes (naruto vs kisame)', naruto!.walk.frameWidth !== kisame!.walk.frameWidth);
assert('sasuke frameHeight != naruto', sasuke!.walk.frameHeight !== naruto!.walk.frameHeight);

console.log('\n--- DEV LAB × Hunt (mesma fonte) ---');
for (const row of [
  { pack: 'naruto-classic', skill: 'skill-rasengan', tl: rasenganHunt, kind: 'single-hit / pose longa' },
  { pack: 'kisame', skill: 'kisame-suiton-lance', tl: lanceTl, kind: 'travel-to-target' },
  { pack: 'kisame', skill: 'skill-kisame-mizu-kanketsusen', tl: geyserTl, kind: 'sequence VFX' },
]) {
  console.log(
    `${row.pack} ${row.skill} (${row.kind})\n` +
      `  Pose FPS ${row.tl.poseFps}  Pose ${row.tl.poseDurationMs}ms  Cast ${row.tl.castDelayMs}ms\n` +
      `  Effect FPS ${row.tl.effectFps}  Effect ${row.tl.effectDurationMs}ms  Travel ${row.tl.travelSpeed ?? '—'}\n` +
      `  Execution ${row.tl.executionEndMs}ms`,
  );
}

console.log('ok  all combat visual timing tests');
