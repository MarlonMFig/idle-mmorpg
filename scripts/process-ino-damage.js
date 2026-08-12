/**
 * Ino Yamanaka damage / death — alpha-only frames (5f total).
 *
 * Frame plan (Gaara pattern, inspected from sequence):
 *   1–2 = hurt (still standing hit reaction)
 *   3–5 = death (collapse → hold final)
 *
 * Clean transparent sources: NO black flood/peel. Never key purple hair.
 *
 * npm run ino:damage
 * Input:  assets/naruto-source/nu/ino/damage/frame_001..005.png
 * Output: public/sprites/player/ino/hurt.png + death.png
 */
const fs = require('fs');
const path = require('path');
const {
  ALPHA_KEEP,
  loadAlphaFrames,
  normalize,
  scaleFrames,
  stitch,
  qaSheet,
  writeFrameCrops,
  updateMeta,
  writePng,
} = require('./lib/alpha-frame-pack');
const { hqAreaScale } = require('./lib/strip-hq-scale');

const ROOT = path.resolve(__dirname, '..');
const INPUT_DIR = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'ino', 'damage');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'ino');
const META_JSON = path.join(OUT_DIR, 'meta.json');
const QA_DIR = path.join(ROOT, 'assets-src', '_qa', 'ino');
const HQ = { hq: { mode: 'match', metaPath: META_JSON, idleKey: 'ino-idle' } };
const EXPECTED = 5;
const HURT_N = 2;
const DEATH_N = 3;
const HURT_FRAME_RATE = 9;
const DEATH_FRAME_RATE = 8;

function isPurpleHair(r, g, b) {
  if (r <= 14 && g <= 14 && b <= 14) return false;
  if (b >= 70 && b >= r - 5 && b >= g + 10 && r >= 35 && Math.max(r, g, b) - Math.min(r, g, b) >= 18) {
    return true;
  }
  if (r >= 140 && g >= 100 && b >= 130 && b >= g && r >= g - 10) return true;
  return false;
}

function countPurple(sheetData) {
  let n = 0;
  for (let i = 0; i < sheetData.length; i += 4) {
    if (sheetData[i + 3] < ALPHA_KEEP) continue;
    if (isPurpleHair(sheetData[i], sheetData[i + 1], sheetData[i + 2])) n += 1;
  }
  return n;
}

async function writeSlice(name, frames, scaled, meta, frameRate, note) {
  const sheet = stitch(frames, scaled.frameWidth, scaled.frameHeight);
  // Death frames may have more horizontal spread (lying body) — still continuous body.
  const qa = qaSheet(
    sheet.data,
    sheet.width,
    scaled.frameHeight,
    scaled.frameWidth,
    frames.length,
    {
      requireSingleComponent: true,
      maxMinorComponent: 10,
      minBlackPerFrame: 12,
      minOlivePerFrame: 0,
      minBluePerFrame: 0,
      minOpaquePerFrame: 50,
      areaScale: hqAreaScale(scaled.contentHeight),
    },
  );
  const purple = countPurple(sheet.data);

  console.log(
    `QA ${name} residualGreen=${qa.residualGreen} opaque=${qa.opaque} pureBlack=${qa.pureBlack} purpleHair=${purple} footSpread=${qa.footSpread}`,
  );
  console.log(
    `QA ${name} comps: ${qa.frameComps.map((c, i) => `f${i}=[${c.join(',')}]`).join(' ')}`,
  );

  if (qa.residualGreen > 0) {
    throw new Error(`QA fail ${name}: residual green = ${qa.residualGreen}`);
  }
  if (qa.pureBlack < 40) {
    throw new Error(`QA fail ${name}: pure black nearly gone (${qa.pureBlack})`);
  }
  if (purple < 15) {
    throw new Error(`QA fail ${name}: purple hair nearly gone (${purple})`);
  }

  await writePng(
    path.join(OUT_DIR, `${name}.png`),
    sheet.data,
    sheet.width,
    sheet.height,
  );
  await writeFrameCrops(
    sheet,
    { ...scaled, frames },
    QA_DIR,
    name,
    4,
  );

  const entry = {
    image: `/sprites/player/ino/${name}.png`,
    frameWidth: scaled.frameWidth,
    frameHeight: scaled.frameHeight,
    frameCount: frames.length,
    contentHeight: scaled.contentHeight,
    scale: scaled.scale,
    frameRate,
    source: 'assets/naruto-source/nu/ino/damage/frame_001..005.png',
    residualGreen: qa.residualGreen,
    residualExteriorBlack: 0,
    pureBlack: qa.pureBlack,
    purpleHair: purple,
    note,
  };
  updateMeta(META_JSON, `ino-${name}`, entry);

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
    HQ,
  );

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const hurtFrames = scaled.frames.slice(0, HURT_N);
  const deathFrames = scaled.frames.slice(HURT_N, HURT_N + DEATH_N);

  const hurt = await writeSlice(
    'hurt',
    hurtFrames,
    scaled,
    META_JSON,
    HURT_FRAME_RATE,
    'frames 1–2 hit reaction; alpha-only; purple hair preserved',
  );
  const death = await writeSlice(
    'death',
    deathFrames,
    scaled,
    META_JSON,
    DEATH_FRAME_RATE,
    'frames 3–5 death collapse hold last; alpha-only; purple hair preserved',
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
