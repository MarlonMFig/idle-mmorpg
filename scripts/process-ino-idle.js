/**
 * Ino Yamanaka idle — alpha-only per-frame sequence (6f breath).
 * Clean transparent sources: NO black flood/peel, NO green flood.
 * Preserves purple hair + pure-black outline / dark clothing.
 *
 * npm run ino:idle
 * Input:  assets/naruto-source/nu/ino/idle/frame_*.png
 * Output: public/sprites/player/ino/idle.png + preview
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
const INPUT_DIR = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'ino', 'idle');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'ino');
const PREVIEW = path.join(ROOT, 'public', 'sprites', 'player', 'previews', 'ino.png');
const META_JSON = path.join(OUT_DIR, 'meta.json');
const QA_DIR = path.join(ROOT, 'assets-src', '_qa', 'ino');
const TARGET_BODY_H = 48;
const FRAME_RATE = 7;
const EXPECTED = 6;

/** Blonde/lavender Ino hair (not pure black outline). */
function isPurpleHair(r, g, b) {
  if (r <= 14 && g <= 14 && b <= 14) return false;
  // lavender / violet: blue≥red, blue≥green, not near-grey
  if (b >= 70 && b >= r - 5 && b >= g + 10 && r >= 35 && Math.max(r, g, b) - Math.min(r, g, b) >= 18) {
    return true;
  }
  // pale blonde highlights that tint purple-pink
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
      maxMinorComponent: 2,
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
  if (Math.abs(scaled.contentHeight - TARGET_BODY_H) > 2) {
    console.warn(
      `WARN contentHeight=${scaled.contentHeight} (target ${TARGET_BODY_H})`,
    );
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  await writePng(
    path.join(OUT_DIR, 'idle.png'),
    sheet.data,
    sheet.width,
    sheet.height,
  );

  fs.mkdirSync(path.dirname(PREVIEW), { recursive: true });
  await writePng(PREVIEW, scaled.frames[0], scaled.frameWidth, scaled.frameHeight);

  await writeFrameCrops(sheet, scaled, QA_DIR, 'idle', 4);

  const entry = {
    image: '/sprites/player/ino/idle.png',
    frameWidth: scaled.frameWidth,
    frameHeight: scaled.frameHeight,
    frameCount: scaled.frames.length,
    contentHeight: scaled.contentHeight,
    scale: scaled.scale,
    frameRate: FRAME_RATE,
    source: 'assets/naruto-source/nu/ino/idle/frame_001..006.png',
    residualGreen: qa.residualGreen,
    residualExteriorBlack: 0,
    pureBlack: qa.pureBlack,
    purpleHair: purple,
    note: '6-frame idle; alpha-only (no black flood/peel); purple hair preserved',
  };
  updateMeta(META_JSON, 'ino-idle', entry);

  console.log(
    `-> idle.png ${sheet.width}x${sheet.height} fw=${entry.frameWidth} fh=${entry.frameHeight} n=${entry.frameCount} contentH=${entry.contentHeight} scale=${entry.scale.toFixed(4)}`,
  );
  console.log(
    'Pack wire:',
    JSON.stringify({
      key: 'ino-idle',
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
