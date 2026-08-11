/**
 * Jiraiya damage / death — alpha-only frames (7f total).
 *
 * Frame plan (inspected: contentH 219→222→234 then collapse 201→135→132→99):
 *   1–3 = hurt (standing hit reaction)
 *   4–7 = death (fall → flat hold)
 *
 * Clean transparent sources: NO black flood/peel. Never key white hair.
 *
 * npm run jiraiya:damage
 * Input:  assets/naruto-source/nu/jiraiya/damage/frame_001..007.png
 * Output: public/sprites/player/jiraiya/hurt.png + death.png
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

const ROOT = path.resolve(__dirname, '..');
const INPUT_DIR = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'jiraiya', 'damage');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'jiraiya');
const META_JSON = path.join(OUT_DIR, 'meta.json');
const QA_DIR = path.join(ROOT, 'assets-src', '_qa', 'jiraiya');
const TARGET_BODY_H = 48;
const EXPECTED = 7;
const HURT_N = 3;
const DEATH_N = 4;
const HURT_FRAME_RATE = 9;
const DEATH_FRAME_RATE = 8;

function isWhiteHair(r, g, b) {
  if (r <= 14 && g <= 14 && b <= 14) return false;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const avg = (r + g + b) / 3;
  if (avg >= 185 && mx - mn <= 36) return true;
  if (avg >= 160 && mx - mn <= 28 && Math.max(g - r, 0) < 12 && Math.max(g - b, 0) < 12) {
    return true;
  }
  if (r >= 200 && g >= 195 && b >= 185 && mx - mn <= 40) return true;
  return false;
}

function countWhite(sheetData) {
  let n = 0;
  for (let i = 0; i < sheetData.length; i += 4) {
    if (sheetData[i + 3] < ALPHA_KEEP) continue;
    if (isWhiteHair(sheetData[i], sheetData[i + 1], sheetData[i + 2])) n += 1;
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
      maxMinorComponent: 14,
      minBlackPerFrame: 12,
      minOlivePerFrame: 0,
      minBluePerFrame: 0,
      minOpaquePerFrame: 50,
    },
  );
  const white = countWhite(sheet.data);

  console.log(
    `QA ${name} residualGreen=${qa.residualGreen} opaque=${qa.opaque} pureBlack=${qa.pureBlack} whiteHair=${white} footSpread=${qa.footSpread}`,
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
  if (white < 15) {
    throw new Error(`QA fail ${name}: white hair nearly gone (${white})`);
  }

  await writePng(
    path.join(OUT_DIR, `${name}.png`),
    sheet.data,
    sheet.width,
    sheet.height,
  );
  await writeFrameCrops(sheet, { ...scaled, frames }, QA_DIR, name, 4);

  const entry = {
    image: `/sprites/player/jiraiya/${name}.png`,
    frameWidth: scaled.frameWidth,
    frameHeight: scaled.frameHeight,
    frameCount: frames.length,
    contentHeight: scaled.contentHeight,
    scale: scaled.scale,
    frameRate,
    source: 'assets/naruto-source/nu/jiraiya/damage/frame_001..007.png',
    residualGreen: qa.residualGreen,
    residualExteriorBlack: 0,
    pureBlack: qa.pureBlack,
    whiteHair: white,
    note,
  };
  updateMeta(META_JSON, `jiraiya-${name}`, entry);

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
    TARGET_BODY_H,
  );

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const hurtFrames = scaled.frames.slice(0, HURT_N);
  const deathFrames = scaled.frames.slice(HURT_N, HURT_N + DEATH_N);

  const hurt = await writeSlice(
    'hurt',
    hurtFrames,
    scaled,
    HURT_FRAME_RATE,
    'frames 1–3 hit reaction; alpha-only; white hair preserved',
  );
  const death = await writeSlice(
    'death',
    deathFrames,
    scaled,
    DEATH_FRAME_RATE,
    'frames 4–7 death collapse hold last; alpha-only; white hair preserved',
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
