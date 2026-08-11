/**
 * Ino Yamanaka walk — alpha-only per-frame sequence (6f side walk).
 * Clean transparent sources: NO black flood/peel. Never key purple hair.
 *
 * npm run ino:walk
 * Input:  assets/naruto-source/nu/ino/walk/frame_*.png
 * Output: public/sprites/player/ino/walk.png
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
const INPUT_DIR = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'ino', 'walk');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'ino');
const META_JSON = path.join(OUT_DIR, 'meta.json');
const QA_DIR = path.join(ROOT, 'assets-src', '_qa', 'ino');
const TARGET_BODY_H = 48;
const FRAME_RATE = 10;
const EXPECTED = 6;

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

async function main() {
  const keyed = await loadAlphaFrames(INPUT_DIR, EXPECTED);

  const norm = normalize(
    keyed.map((k) => k.frame),
    keyed.map((k) => k.width),
    keyed.map((k) => k.height),
    { contentFromN: 2 },
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
  const sheet = stitch(scaled.frames, scaled.frameWidth, scaled.frameHeight);
  const qa = qaSheet(
    sheet.data,
    sheet.width,
    scaled.frameHeight,
    scaled.frameWidth,
    scaled.frames.length,
    {
      requireSingleComponent: true,
      maxMinorComponent: 4,
      minBlackPerFrame: 20,
      minOlivePerFrame: 0,
      minBluePerFrame: 0,
      minOpaquePerFrame: 100,
    },
  );
  const purple = countPurple(sheet.data);

  console.log(
    `QA residualGreen=${qa.residualGreen} opaque=${qa.opaque} pureBlack=${qa.pureBlack} purpleHair=${purple} footSpread=${qa.footSpread}`,
  );
  console.log(
    `QA comps: ${qa.frameComps.map((c, i) => `f${i}=[${c.join(',')}]`).join(' ')}`,
  );

  if (qa.residualGreen > 0) {
    throw new Error(`QA fail: residual green = ${qa.residualGreen}`);
  }
  if (qa.pureBlack < 80) {
    throw new Error(`QA fail: pure black outline nearly gone (${qa.pureBlack})`);
  }
  if (purple < 40) {
    throw new Error(`QA fail: purple/lavender hair nearly gone (${purple})`);
  }
  if (qa.footSpread > 4) {
    console.warn(`WARN footSpread=${qa.footSpread}`);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  await writePng(
    path.join(OUT_DIR, 'walk.png'),
    sheet.data,
    sheet.width,
    sheet.height,
  );
  await writeFrameCrops(sheet, scaled, QA_DIR, 'walk', 4);

  const entry = {
    image: '/sprites/player/ino/walk.png',
    frameWidth: scaled.frameWidth,
    frameHeight: scaled.frameHeight,
    frameCount: scaled.frames.length,
    contentHeight: scaled.contentHeight,
    scale: scaled.scale,
    frameRate: FRAME_RATE,
    source: 'assets/naruto-source/nu/ino/walk/frame_001..006.png',
    residualGreen: qa.residualGreen,
    residualExteriorBlack: 0,
    pureBlack: qa.pureBlack,
    purpleHair: purple,
    note: '6-frame side walk RIGHT; alpha-only (no black flood/peel)',
  };
  updateMeta(META_JSON, 'ino-walk', entry);

  console.log(
    `-> walk.png ${sheet.width}x${sheet.height} fw=${entry.frameWidth} fh=${entry.frameHeight} n=${entry.frameCount} contentH=${entry.contentHeight} scale=${entry.scale.toFixed(4)}`,
  );
  console.log(
    'Pack wire:',
    JSON.stringify({
      key: 'ino-walk',
      frameWidth: entry.frameWidth,
      frameHeight: entry.frameHeight,
      frameCount: entry.frameCount,
      contentHeight: entry.contentHeight,
    }),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
