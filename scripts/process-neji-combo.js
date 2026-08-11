/**
 * Hyuga Neji combo attack — alpha-only frames (19f → 5+5+9).
 * Clean transparent sources: NO black key.
 *
 * Scale policy matches walk: same absoluteScale (walk density).
 *
 * npm run neji:combo
 * Input:  assets/naruto-source/nu/neji/combo/frame_001..019.png
 * Output: public/sprites/player/neji/{combo1,combo2,combo3,attack}.png
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

const ROOT = path.resolve(__dirname, '..');
const INPUT_DIR = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'neji', 'combo');
const WALK_DIR = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'neji', 'walk');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'neji');
const META_JSON = path.join(OUT_DIR, 'meta.json');
const QA_DIR = path.join(ROOT, 'assets-src', '_qa', 'neji');
const TARGET_BODY_H = 48;
const FRAME_RATE = 12;
const EXPECTED = 19;

/** Three multi-hit beats: palm | spin/kick | rapid palms + finisher (5+5+9). */
const SLICES = [
  { name: 'combo1', from: 0, to: 5, note: 'prep + first palms' },
  { name: 'combo2', from: 5, to: 10, note: 'second hit chain' },
  { name: 'combo3', from: 10, to: 19, note: 'finisher / recovery' },
];

function measureContentHeights(frames, fw, fh) {
  return frames.map((frame) => bbox(frame, fw, fh).height);
}

function resolveWalkScale() {
  if (fs.existsSync(META_JSON)) {
    try {
      const meta = JSON.parse(fs.readFileSync(META_JSON, 'utf8'));
      const w = meta['neji-walk'];
      if (w && typeof w.scale === 'number' && w.scale > 0) {
        return {
          scale: w.scale,
          source: 'meta.json neji-walk',
          walkMaxContentH:
            w.maxContentH ??
            (w.scale > 0 ? Math.round(TARGET_BODY_H / w.scale) : null),
        };
      }
    } catch {
      /* fall through */
    }
  }
  return null;
}

async function measureWalkSourceScale() {
  const walkKeyed = await loadAlphaFrames(WALK_DIR, 6);
  const heights = walkKeyed.map((k) => k.box.height);
  const maxH = Math.max(...heights);
  return {
    scale: TARGET_BODY_H / Math.max(1, maxH),
    source: 'walk source max contentH',
    walkMaxContentH: maxH,
    walkHeights: heights,
  };
}

async function main() {
  const keyed = await loadAlphaFrames(INPUT_DIR, EXPECTED);

  const beforeH = keyed.map((k) => k.box.height);
  console.log(
    `BEFORE contentH per frame: ${beforeH.map((h, i) => `f${i}=${h}`).join(' ')} ` +
      `(min=${Math.min(...beforeH)} max=${Math.max(...beforeH)} Δ=${Math.max(...beforeH) - Math.min(...beforeH)})`,
  );

  let walkScaleInfo = resolveWalkScale();
  if (!walkScaleInfo) {
    walkScaleInfo = await measureWalkSourceScale();
  }
  const absoluteScale = walkScaleInfo.scale;
  console.log(
    `walk-matched absoluteScale=${absoluteScale.toFixed(6)} (${walkScaleInfo.source}` +
      (walkScaleInfo.walkMaxContentH != null
        ? `, walkMaxContentH≈${walkScaleInfo.walkMaxContentH}`
        : '') +
      `)`,
  );

  const packed = await packUniformGlobalScale(
    keyed.map((k) => k.frame),
    keyed.map((k) => k.width),
    keyed.map((k) => k.height),
    { targetBodyH: TARGET_BODY_H, pad: 2, absoluteScale },
  );

  const afterH = measureContentHeights(packed.frames, packed.frameWidth, packed.frameHeight);
  console.log(
    `AFTER contentH per frame: ${afterH.map((h, i) => `f${i}=${h}`).join(' ')} ` +
      `(min=${Math.min(...afterH)} max=${Math.max(...afterH)} Δ=${Math.max(...afterH) - Math.min(...afterH)})`,
  );
  console.log(
    `cell fw=${packed.frameWidth} fh=${packed.frameHeight} contentH=${packed.contentHeight} ` +
      `scale=${packed.scale.toFixed(6)} scaledW=[${packed.scaledWidths.join(',')}] scaledH=[${packed.scaledHeights.join(',')}]`,
  );

  const fullSheet = stitch(packed.frames, packed.frameWidth, packed.frameHeight);
  const fullQa = qaSheet(
    fullSheet.data,
    fullSheet.width,
    packed.frameHeight,
    packed.frameWidth,
    packed.frames.length,
    {
      requireSingleComponent: true,
      maxMinorComponent: 24,
      minBlackPerFrame: 30,
      minOlivePerFrame: 0,
      minBluePerFrame: 0,
      minOpaquePerFrame: 80,
    },
  );

  console.log(
    `QA full residualGreen=${fullQa.residualGreen} opaque=${fullQa.opaque} pureBlack=${fullQa.pureBlack} footSpread=${fullQa.footSpread}`,
  );
  console.log(
    `QA comps: ${fullQa.frameComps.map((c, i) => `f${i}=[${c.join(',')}]`).join(' ')}`,
  );

  if (fullQa.residualGreen > 0) {
    throw new Error(`QA fail: residual green = ${fullQa.residualGreen}`);
  }
  if (fullQa.pureBlack < 200) {
    throw new Error(`QA fail: pure black nearly gone (${fullQa.pureBlack})`);
  }
  if (fullQa.footSpread > 8) {
    console.warn(`WARN footSpread=${fullQa.footSpread}`);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  await writePng(
    path.join(OUT_DIR, 'attack.png'),
    fullSheet.data,
    fullSheet.width,
    fullSheet.height,
  );
  await writeFrameCrops(
    fullSheet,
    {
      frames: packed.frames,
      frameWidth: packed.frameWidth,
      frameHeight: packed.frameHeight,
    },
    QA_DIR,
    'combo',
    3,
  );

  const wire = {};
  for (const slice of SLICES) {
    const frames = packed.frames.slice(slice.from, slice.to);
    const contentHeights = afterH.slice(slice.from, slice.to);
    const sheet = stitch(frames, packed.frameWidth, packed.frameHeight);
    const qa = qaSheet(
      sheet.data,
      sheet.width,
      packed.frameHeight,
      packed.frameWidth,
      frames.length,
      {
        requireSingleComponent: true,
        maxMinorComponent: 24,
        minBlackPerFrame: 30,
        minOlivePerFrame: 0,
        minBluePerFrame: 0,
        minOpaquePerFrame: 80,
      },
    );
    if (qa.residualGreen > 0) {
      throw new Error(`${slice.name} residual green = ${qa.residualGreen}`);
    }
    await writePng(
      path.join(OUT_DIR, `${slice.name}.png`),
      sheet.data,
      sheet.width,
      sheet.height,
    );
    const entry = {
      image: `/sprites/player/neji/${slice.name}.png`,
      frameWidth: packed.frameWidth,
      frameHeight: packed.frameHeight,
      frameCount: frames.length,
      contentHeight: packed.contentHeight,
      scale: packed.scale,
      frameRate: FRAME_RATE,
      source: 'assets/naruto-source/nu/neji/combo/frame_001..019.png',
      range: [slice.from, slice.to],
      residualGreen: qa.residualGreen,
      pureBlack: qa.pureBlack,
      bodyHeightVariance: Math.max(...contentHeights) - Math.min(...contentHeights),
      contentHeights,
      note: `${slice.note} (${frames.length}f); alpha-only; uniform global scale matched to walk`,
    };
    updateMeta(META_JSON, `neji-${slice.name}`, entry);
    wire[slice.name] = {
      frameWidth: entry.frameWidth,
      frameHeight: entry.frameHeight,
      frameCount: entry.frameCount,
      contentHeight: entry.contentHeight,
    };
    console.log(
      `-> ${slice.name}.png ${sheet.width}x${sheet.height} n=${entry.frameCount} residualGreen=${qa.residualGreen}`,
    );
  }

  updateMeta(META_JSON, 'neji-attack', {
    image: '/sprites/player/neji/attack.png',
    frameWidth: packed.frameWidth,
    frameHeight: packed.frameHeight,
    frameCount: packed.frames.length,
    contentHeight: packed.contentHeight,
    scale: packed.scale,
    frameRate: FRAME_RATE,
    source: 'assets/naruto-source/nu/neji/combo/frame_001..019.png',
    residualGreen: fullQa.residualGreen,
    pureBlack: fullQa.pureBlack,
    walkMatchedScale: absoluteScale,
    contentHeights: afterH,
    note: `full combo strip (${packed.frames.length}f); 5+5+9 splits; alpha-only; scale=${absoluteScale.toFixed(4)} matched walk`,
  });

  console.log(
    `-> attack.png ${fullSheet.width}x${fullSheet.height} fw=${packed.frameWidth} fh=${packed.frameHeight} n=${packed.frames.length} contentH=${packed.contentHeight} scale=${packed.scale.toFixed(4)}`,
  );
  console.log('Pack wire:', JSON.stringify(wire, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
