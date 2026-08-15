/**
 * Hyuga Neji walk — alpha-only 6f side walk.
 * Clean transparent sources: NO black key (dark hair must survive).
 *
 * Uniform global scale (max contentH → 48). contentH 48.
 *
 * npm run neji:walk  (alias: neji:run)
 * Input:  assets/naruto-source/nu/neji/walk/frame_*.png
 * Output: public/sprites/player/neji/walk.png
 */
const fs = require('fs');
const path = require('path');
const {
  loadAlphaFrames,
  packUniformGlobalScale,
  stitch,
  qaSheet,
  writeFrameCrops,
  updateMeta,
  writePng,
  bbox,
} = require('./lib/alpha-frame-pack');
const { hqLinearScale, hqAreaScale } = require('./lib/strip-hq-scale');

const ROOT = path.resolve(__dirname, '..');
const INPUT_DIR = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'neji', 'walk');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'neji');
const PREVIEW = path.join(ROOT, 'public', 'sprites', 'player', 'previews', 'neji.png');
const META_JSON = path.join(OUT_DIR, 'meta.json');
const QA_DIR = path.join(ROOT, 'assets-src', '_qa', 'neji');
/** Walk is Neji's body ruler: native pixels here, every other anim matches it. */
const HQ = { mode: 'idle' };
const FRAME_RATE = 10;
const EXPECTED = 6;
const MAX_BODY_H_VARIANCE = 4;

function measureContentHeights(frames, fw, fh) {
  return frames.map((frame) => bbox(frame, fw, fh).height);
}

async function main() {
  const keyed = await loadAlphaFrames(INPUT_DIR, EXPECTED);

  const beforeH = keyed.map((k) => k.box.height);
  console.log(
    `BEFORE contentH per frame: ${beforeH.map((h, i) => `f${i}=${h}`).join(' ')} ` +
      `(min=${Math.min(...beforeH)} max=${Math.max(...beforeH)} Δ=${Math.max(...beforeH) - Math.min(...beforeH)})`,
  );

  const packed = await packUniformGlobalScale(
    keyed.map((k) => k.frame),
    keyed.map((k) => k.width),
    keyed.map((k) => k.height),
    { pad: 2, hq: HQ },
  );
  const linear = hqLinearScale(packed.contentHeight);
  const areaScale = hqAreaScale(packed.contentHeight);
  const maxBodyHVariance = Math.round(MAX_BODY_H_VARIANCE * linear);

  const afterH = measureContentHeights(packed.frames, packed.frameWidth, packed.frameHeight);
  const bodyHVar = Math.max(...afterH) - Math.min(...afterH);
  console.log(
    `AFTER contentH per frame: ${afterH.map((h, i) => `f${i}=${h}`).join(' ')} ` +
      `(min=${Math.min(...afterH)} max=${Math.max(...afterH)} Δ=${bodyHVar})`,
  );
  console.log(
    `globalScale=${packed.scale.toFixed(6)} from maxContentH=${packed.maxContentH} → target=${packed.contentHeight}`,
  );
  console.log(
    `cell fw=${packed.frameWidth} fh=${packed.frameHeight} contentH=${packed.contentHeight} ` +
      `scaledW=[${packed.scaledWidths.join(',')}] scaledH=[${packed.scaledHeights.join(',')}]`,
  );

  if (bodyHVar > maxBodyHVariance) {
    throw new Error(
      `QA fail: body height variance ${bodyHVar}px > ${maxBodyHVariance}px across walk frames`,
    );
  }

  const sheet = stitch(packed.frames, packed.frameWidth, packed.frameHeight);
  const qa = qaSheet(
    sheet.data,
    sheet.width,
    packed.frameHeight,
    packed.frameWidth,
    packed.frames.length,
    {
      requireSingleComponent: true,
      maxMinorComponent: 8,
      minBlackPerFrame: 40,
      minOlivePerFrame: 0,
      minBluePerFrame: 0,
      minOpaquePerFrame: 80,
      areaScale,
    },
  );

  console.log(
    `QA residualGreen=${qa.residualGreen} opaque=${qa.opaque} pureBlack=${qa.pureBlack} footSpread=${qa.footSpread}`,
  );
  console.log(
    `QA comps: ${qa.frameComps.map((c, i) => `f${i}=[${c.join(',')}]`).join(' ')}`,
  );

  if (qa.residualGreen > 0) {
    throw new Error(`QA fail: residual green = ${qa.residualGreen}`);
  }
  if (qa.pureBlack < 150) {
    throw new Error(`QA fail: pure black hair/outline nearly gone (${qa.pureBlack})`);
  }
  if (qa.footSpread > Math.round(4 * linear)) {
    console.warn(`WARN footSpread=${qa.footSpread}`);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  await writePng(path.join(OUT_DIR, 'walk.png'), sheet.data, sheet.width, sheet.height);

  if (!fs.existsSync(PREVIEW)) {
    fs.mkdirSync(path.dirname(PREVIEW), { recursive: true });
    await writePng(PREVIEW, packed.frames[0], packed.frameWidth, packed.frameHeight);
  }

  await writeFrameCrops(
    sheet,
    {
      frames: packed.frames,
      frameWidth: packed.frameWidth,
      frameHeight: packed.frameHeight,
    },
    QA_DIR,
    'walk',
    4,
  );

  const entry = {
    image: '/sprites/player/neji/walk.png',
    frameWidth: packed.frameWidth,
    frameHeight: packed.frameHeight,
    frameCount: packed.frames.length,
    contentHeight: packed.contentHeight,
    scale: packed.scale,
    maxContentH: packed.maxContentH,
    frameRate: FRAME_RATE,
    source: 'assets/naruto-source/nu/neji/walk/frame_001..006.png',
    residualGreen: qa.residualGreen,
    residualExteriorBlack: 0,
    pureBlack: qa.pureBlack,
    contentHeights: afterH,
    bodyHeightVariance: bodyHVar,
    direction: 'right',
    note: '6-frame walk; alpha-only; uniform global scale (max contentH → 48); black hair preserved',
  };
  updateMeta(META_JSON, 'neji-walk', entry);

  console.log(
    `-> walk.png ${sheet.width}x${sheet.height} fw=${entry.frameWidth} fh=${entry.frameHeight} n=${entry.frameCount} contentH=${entry.contentHeight} scale=${entry.scale.toFixed(4)}`,
  );
  console.log(
    'Pack wire:',
    JSON.stringify({
      frameWidth: entry.frameWidth,
      frameHeight: entry.frameHeight,
      frameCount: entry.frameCount,
      contentHeight: entry.contentHeight,
      scale: entry.scale,
    }),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
