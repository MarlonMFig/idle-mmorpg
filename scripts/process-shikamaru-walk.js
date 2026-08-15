/**
 * Shikamaru walk — 6 frames, alpha-only pack.
 *
 * npm run shikamaru:walk
 * Input:  assets/naruto-source/nu/shikamaru/walk/frame_001..006.png
 * Output: public/sprites/player/shikamaru/walk.png
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
const { hqLinearScale, hqAreaScale } = require('./lib/strip-hq-scale');

const ROOT = path.resolve(__dirname, '..');
const INPUT_DIR = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'shikamaru', 'walk');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'shikamaru');
const META_JSON = path.join(OUT_DIR, 'meta.json');
const QA_DIR = path.join(ROOT, 'assets-src', '_qa', 'shikamaru');
const HQ = { hq: { mode: 'match', metaPath: META_JSON, idleKey: 'shikamaru-idle' } };
const FRAME_RATE = 10;
const EXPECTED = 6;

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
    HQ,
  );
  const linear = hqLinearScale(scaled.contentHeight);
  const areaScale = hqAreaScale(scaled.contentHeight);
  const sheet = stitch(scaled.frames, scaled.frameWidth, scaled.frameHeight);
  const qa = qaSheet(
    sheet.data,
    sheet.width,
    scaled.frameHeight,
    scaled.frameWidth,
    scaled.frames.length,
    {
      requireSingleComponent: true,
      minBlackPerFrame: 12,
      minOlivePerFrame: 15,
      minBluePerFrame: 4,
      minOpaquePerFrame: 80,
      areaScale,
    },
  );

  console.log(
    `QA residualGreen=${qa.residualGreen} opaque=${qa.opaque} pureBlack=${qa.pureBlack} olive=${qa.olive} blue=${qa.blue} footSpread=${qa.footSpread}`,
  );
  console.log(
    `QA comps: ${qa.frameComps.map((c, i) => `f${i}=[${c.join(',')}]`).join(' ')}`,
  );

  if (qa.residualGreen > 0) {
    throw new Error(`QA fail: residual green = ${qa.residualGreen}`);
  }
  if (qa.pureBlack < 80) {
    throw new Error(`QA fail: pure black hair nearly gone (${qa.pureBlack})`);
  }
  if (qa.olive < 60) {
    throw new Error(`QA fail: olive jacket nearly gone (${qa.olive})`);
  }
  if (qa.footSpread > Math.round(4 * linear)) {
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
    image: '/sprites/player/shikamaru/walk.png',
    frameWidth: scaled.frameWidth,
    frameHeight: scaled.frameHeight,
    frameCount: scaled.frames.length,
    contentHeight: scaled.contentHeight,
    scale: scaled.scale,
    frameRate: FRAME_RATE,
    source: 'assets/naruto-source/nu/shikamaru/walk/frame_001..006.png',
    residualGreen: qa.residualGreen,
    residualExteriorBlack: 0,
    pureBlack: qa.pureBlack,
    olive: qa.olive,
    blue: qa.blue,
    note: '6-frame side walk RIGHT; alpha-only (no black flood/peel)',
  };
  updateMeta(META_JSON, 'shikamaru-walk', entry);

  console.log(
    `-> walk.png ${sheet.width}x${sheet.height} fw=${entry.frameWidth} fh=${entry.frameHeight} n=${entry.frameCount} contentH=${entry.contentHeight} scale=${entry.scale.toFixed(4)}`,
  );
  console.log(
    'Pack wire:',
    JSON.stringify({
      key: 'shikamaru-walk',
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
