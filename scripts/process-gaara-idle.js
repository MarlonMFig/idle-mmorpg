/**
 * Gaara idle — 4 frames, alpha-only pack.
 *
 * Sources already have true transparency. Opaque pure black IS outline —
 * NEVER flood-key or peel (same class of bug as Naruto/Hinata black-key damage).
 * Red hair + sand beige must stay intact.
 *
 * npm run gaara:idle
 * Input:  assets/naruto-source/nu/gaara/idle/frame_001..004.png
 * Output: public/sprites/player/gaara/idle.png
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
  ALPHA_KEEP,
} = require('./lib/alpha-frame-pack');

const ROOT = path.resolve(__dirname, '..');
const INPUT_DIR = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'gaara', 'idle');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'gaara');
const PREVIEW = path.join(ROOT, 'public', 'sprites', 'player', 'previews', 'gaara.png');
const META_JSON = path.join(OUT_DIR, 'meta.json');
const QA_DIR = path.join(ROOT, 'assets-src', '_qa', 'gaara');
const TARGET_BODY_H = 48;
const FRAME_RATE = 7;
const EXPECTED = 4;

function isRedHair(r, g, b) {
  return r >= 90 && r >= g + 25 && r >= b + 15;
}

function isSand(r, g, b) {
  return r >= 130 && g >= 90 && b >= 50 && r >= b && Math.abs(r - g) < 90 && g >= b - 10;
}

function countPalette(sheetData) {
  let red = 0;
  let sand = 0;
  for (let i = 0; i < sheetData.length; i += 4) {
    if (sheetData[i + 3] < ALPHA_KEEP) continue;
    const r = sheetData[i];
    const g = sheetData[i + 1];
    const b = sheetData[i + 2];
    if (isRedHair(r, g, b)) red += 1;
    if (isSand(r, g, b)) sand += 1;
  }
  return { red, sand };
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
      minBlackPerFrame: 20,
      minOlivePerFrame: 0,
      minBluePerFrame: 0,
      minOpaquePerFrame: 100,
    },
  );
  const pal = countPalette(sheet.data);

  console.log(
    `QA residualGreen=${qa.residualGreen} opaque=${qa.opaque} pureBlack=${qa.pureBlack} red=${pal.red} sand=${pal.sand} footSpread=${qa.footSpread}`,
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
  if (pal.red < 40) {
    throw new Error(`QA fail: red hair/kanji nearly gone (${pal.red})`);
  }
  if (pal.sand < 20) {
    throw new Error(`QA fail: sand beige nearly gone (${pal.sand})`);
  }
  if (qa.footSpread > 4) {
    console.warn(`WARN footSpread=${qa.footSpread}`);
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
    image: '/sprites/player/gaara/idle.png',
    frameWidth: scaled.frameWidth,
    frameHeight: scaled.frameHeight,
    frameCount: scaled.frames.length,
    contentHeight: scaled.contentHeight,
    scale: scaled.scale,
    frameRate: FRAME_RATE,
    source: 'assets/naruto-source/nu/gaara/idle/frame_001..004.png',
    residualGreen: qa.residualGreen,
    residualExteriorBlack: 0,
    pureBlack: qa.pureBlack,
    red: pal.red,
    sand: pal.sand,
    note: '4-frame idle; alpha-only (no black flood/peel); red hair+sand preserved',
  };
  updateMeta(META_JSON, 'gaara-idle', entry);

  console.log(
    `-> idle.png ${sheet.width}x${sheet.height} fw=${entry.frameWidth} fh=${entry.frameHeight} n=${entry.frameCount} contentH=${entry.contentHeight} scale=${entry.scale.toFixed(4)}`,
  );
  console.log(
    'Pack wire:',
    JSON.stringify({
      key: 'gaara-idle',
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
