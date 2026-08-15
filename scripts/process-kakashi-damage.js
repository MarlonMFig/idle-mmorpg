/**
 * Kakashi Hatake damage / death — alpha-only frames (5f total).
 *
 * Frame plan (Gaara/Ino pattern, inspected from sequence):
 *   1–2 = hurt (still standing hit reaction; contentH ~115–124)
 *   3–5 = death (collapse → hold final; contentH 110 → 64 → 57)
 *
 * Clean transparent sources: NO black flood/peel. Never key dark silver hair.
 *
 * npm run kakashi:damage
 * Input:  assets/naruto-source/nu/kakashi/damage/frame_001..005.png
 * Output: public/sprites/player/kakashi/hurt.png + death.png
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
const INPUT_DIR = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'kakashi', 'damage');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'kakashi');
const META_JSON = path.join(OUT_DIR, 'meta.json');
const QA_DIR = path.join(ROOT, 'assets-src', '_qa', 'kakashi');
const HQ = { hq: { mode: 'match', metaPath: META_JSON, idleKey: 'kakashi-walk' } };
const EXPECTED = 5;
const HURT_N = 2;
const DEATH_N = 3;
const HURT_FRAME_RATE = 9;
const DEATH_FRAME_RATE = 8;

function isSilverHair(r, g, b) {
  if (r <= 14 && g <= 14 && b <= 14) return false;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  if (mx >= 18 && mx <= 150 && mx - mn <= 28 && b >= g - 8 && b >= r - 5) return true;
  if (r >= 40 && r <= 130 && g >= 40 && g <= 140 && b >= 50 && b <= 160 && Math.abs(r - g) <= 20) {
    return true;
  }
  return false;
}

function countSilver(sheetData) {
  let n = 0;
  for (let i = 0; i < sheetData.length; i += 4) {
    if (sheetData[i + 3] < ALPHA_KEEP) continue;
    if (isSilverHair(sheetData[i], sheetData[i + 1], sheetData[i + 2])) n += 1;
  }
  return n;
}

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
      minBlackPerFrame: 12,
      minOlivePerFrame: 0,
      minBluePerFrame: 0,
      minOpaquePerFrame: 50,
      areaScale: typeof scaled !== 'undefined' && scaled.contentHeight
        ? (scaled.contentHeight / 48) ** 2
        : 1,
    },
  );
  const silver = countSilver(sheet.data);

  console.log(
    `QA ${name} residualGreen=${qa.residualGreen} opaque=${qa.opaque} pureBlack=${qa.pureBlack} silverHair=${silver} footSpread=${qa.footSpread}`,
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
  if (silver < 15) {
    throw new Error(`QA fail ${name}: silver hair nearly gone (${silver})`);
  }

  await writePng(
    path.join(OUT_DIR, `${name}.png`),
    sheet.data,
    sheet.width,
    sheet.height,
  );
  await writeFrameCrops(sheet, { ...scaled, frames }, QA_DIR, name, 4);

  const entry = {
    image: `/sprites/player/kakashi/${name}.png`,
    frameWidth: scaled.frameWidth,
    frameHeight: scaled.frameHeight,
    frameCount: frames.length,
    contentHeight: scaled.contentHeight,
    scale: scaled.scale,
    frameRate,
    source: 'assets/naruto-source/nu/kakashi/damage/frame_001..005.png',
    residualGreen: qa.residualGreen,
    residualExteriorBlack: 0,
    pureBlack: qa.pureBlack,
    silverHair: silver,
    note,
  };
  updateMeta(META_JSON, `kakashi-${name}`, entry);

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
  const areaScale = hqAreaScale(scaled.contentHeight);

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const hurtFrames = scaled.frames.slice(0, HURT_N);
  const deathFrames = scaled.frames.slice(HURT_N, HURT_N + DEATH_N);

  const hurt = await writeSlice(
    'hurt',
    hurtFrames,
    scaled,
    HURT_FRAME_RATE,
    'frames 1–2 hit reaction; alpha-only; dark silver hair preserved',
  );
  const death = await writeSlice(
    'death',
    deathFrames,
    scaled,
    DEATH_FRAME_RATE,
    'frames 3–5 death collapse hold last; alpha-only; dark silver hair preserved',
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
