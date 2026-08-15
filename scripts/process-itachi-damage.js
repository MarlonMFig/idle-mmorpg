/**
 * Uchiha Itachi damage / death — alpha-only frames (5f total).
 *
 * Frame plan (Gaara/Ino/Kakashi pattern, inspected from sequence):
 *   1–2 = hurt (standing hit reaction; contentH ~118–125)
 *   3–5 = death (collapse → hold final; contentH 115 → 59 → 47)
 *
 * Clean transparent sources: NO black flood/peel. Never key pure black hair.
 *
 * HQ: nativePixels — scaled so body density matches the idle contentHeight ruler.
 *
 * npm run itachi:damage
 * Input:  assets/naruto-source/nu/itachi/damage/frame_001..005.png
 * Output: public/sprites/player/itachi/hurt.png + death.png
 */
const fs = require('fs');
const path = require('path');
const {
  loadAlphaFrames,
  normalize,
  scaleFrames,
  stitch,
  qaSheet,
  writeFrameCrops,
  updateMeta,
  writePng,
} = require('./lib/alpha-frame-pack');

const ROOT = path.resolve(__dirname, '..');
const INPUT_DIR = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'itachi', 'damage');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'itachi');
const META_JSON = path.join(OUT_DIR, 'meta.json');
const QA_DIR = path.join(ROOT, 'assets-src', '_qa', 'itachi');
const HQ = { mode: 'match', metaPath: META_JSON, idleKey: 'itachi-idle' };
const EXPECTED = 5;
const HURT_N = 2;
const DEATH_N = 3;
const HURT_FRAME_RATE = 9;
const DEATH_FRAME_RATE = 8;

async function writeSlice(name, frames, scaled, frameRate, note) {
  const sheet = stitch(frames, scaled.frameWidth, scaled.frameHeight);
  const qa = qaSheet(
    sheet.data,
    sheet.width,
    scaled.frameHeight,
    scaled.frameWidth,
    frames.length,
    {
      requireSingleComponent: true,
      maxMinorComponent: 10,
      minBlackPerFrame: 40,
      minOlivePerFrame: 0,
      minBluePerFrame: 0,
      minOpaquePerFrame: 50,
    },
  );

  console.log(
    `QA ${name} residualGreen=${qa.residualGreen} opaque=${qa.opaque} pureBlack=${qa.pureBlack} footSpread=${qa.footSpread}`,
  );
  console.log(
    `QA ${name} comps: ${qa.frameComps.map((c, i) => `f${i}=[${c.join(',')}]`).join(' ')}`,
  );

  if (qa.residualGreen > 0) {
    throw new Error(`QA fail ${name}: residual green = ${qa.residualGreen}`);
  }
  if (qa.pureBlack < 80) {
    throw new Error(`QA fail ${name}: pure black nearly gone (${qa.pureBlack})`);
  }

  await writePng(
    path.join(OUT_DIR, `${name}.png`),
    sheet.data,
    sheet.width,
    sheet.height,
  );
  await writeFrameCrops(sheet, { ...scaled, frames }, QA_DIR, name, 4);

  const entry = {
    image: `/sprites/player/itachi/${name}.png`,
    frameWidth: scaled.frameWidth,
    frameHeight: scaled.frameHeight,
    frameCount: frames.length,
    contentHeight: scaled.contentHeight,
    scale: scaled.scale,
    frameRate,
    source: 'assets/naruto-source/nu/itachi/damage/frame_001..005.png',
    residualGreen: qa.residualGreen,
    residualExteriorBlack: 0,
    pureBlack: qa.pureBlack,
    note,
  };
  updateMeta(META_JSON, `itachi-${name}`, entry);

  console.log(
    `-> ${name}.png ${sheet.width}x${sheet.height} fw=${entry.frameWidth} fh=${entry.frameHeight} n=${entry.frameCount} contentH=${entry.contentHeight}`,
  );
  return entry;
}

async function main() {
  const keyed = await loadAlphaFrames(INPUT_DIR, EXPECTED);

  // Standing body height from hurt frames (death collapses are shorter).
  const norm = normalize(
    keyed.map((k) => k.frame),
    keyed.map((k) => k.width),
    keyed.map((k) => k.height),
    { contentFromN: HURT_N },
  );
  console.log(
    `normalize fw=${norm.frameWidth} fh=${norm.frameHeight} contentH=${norm.contentHeight}`,
  );

  const scaled = await scaleFrames(
    norm.frames,
    norm.frameWidth,
    norm.frameHeight,
    norm.contentHeight,
    { hq: HQ },
  );
  console.log(
    `HQ damage scale=${scaled.scale.toFixed(4)} bodyH=${norm.contentHeight} → idle contentH=${scaled.contentHeight}`,
  );

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const hurtFrames = scaled.frames.slice(0, HURT_N);
  const deathFrames = scaled.frames.slice(HURT_N, HURT_N + DEATH_N);

  const hurt = await writeSlice(
    'hurt',
    hurtFrames,
    scaled,
    HURT_FRAME_RATE,
    'frames 1–2 hit reaction; alpha-only; black hair preserved',
  );
  const death = await writeSlice(
    'death',
    deathFrames,
    scaled,
    DEATH_FRAME_RATE,
    'frames 3–5 death collapse hold last; alpha-only; black hair preserved',
  );

  console.log(
    'Pack wire:',
    JSON.stringify(
      {
        hurt: {
          frameWidth: hurt.frameWidth,
          frameHeight: hurt.frameHeight,
          frameCount: hurt.frameCount,
          contentHeight: hurt.contentHeight,
          frameRate: HURT_FRAME_RATE,
        },
        death: {
          frameWidth: death.frameWidth,
          frameHeight: death.frameHeight,
          frameCount: death.frameCount,
          contentHeight: death.contentHeight,
          frameRate: DEATH_FRAME_RATE,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
