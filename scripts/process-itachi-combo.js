/**
 * Uchiha Itachi combo attack — alpha-only frames (13f → 5+5+3).
 * Clean transparent sources: NO black flood/peel. Never key pure black hair.
 *
 * HQ: nativePixels — one uniform global scale mapping the max frame body height
 * onto the idle contentHeight ruler, so crouch/prep poses keep walk density.
 *
 * npm run itachi:combo
 * Input:  assets/naruto-source/nu/itachi/combo/frame_001..013.png
 * Output: public/sprites/player/itachi/{combo1,combo2,combo3,attack}.png
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
const { hqAreaScale } = require('./lib/strip-hq-scale');

const ROOT = path.resolve(__dirname, '..');
const INPUT_DIR = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'itachi', 'combo');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'itachi');
const META_JSON = path.join(OUT_DIR, 'meta.json');
const QA_DIR = path.join(ROOT, 'assets-src', '_qa', 'itachi');
const HQ = { mode: 'match', metaPath: META_JSON, idleKey: 'itachi-idle' };
/**
 * Thrown shuriken/kunai legitimately leave the silhouette mid-combo, so the
 * detached-pixel budget has to cover them (area-scaled to the native body).
 */
const MAX_DETACHED = 32;
const FRAME_RATE = 12;
const EXPECTED = 13;

/** Three multi-hit beats: hit1 | hit2 | finisher (5+5+3). */
const SLICES = [
  { name: 'combo1', from: 0, to: 5, note: 'prep + first strike' },
  { name: 'combo2', from: 5, to: 10, note: 'second strike' },
  { name: 'combo3', from: 10, to: 13, note: 'finisher / recovery' },
];

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
    { hq: HQ, pad: 2 },
  );
  const absoluteScale = packed.scale;
  console.log(
    `HQ combo scale=${absoluteScale.toFixed(6)} from maxContentH=${packed.maxContentH} → idle ruler=${packed.targetBodyH}`,
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
      maxMinorComponent: MAX_DETACHED,
      areaScale: hqAreaScale(packed.contentHeight),
      minBlackPerFrame: 40,
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
        maxMinorComponent: MAX_DETACHED,
        areaScale: hqAreaScale(packed.contentHeight),
        minBlackPerFrame: 40,
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
      image: `/sprites/player/itachi/${slice.name}.png`,
      frameWidth: packed.frameWidth,
      frameHeight: packed.frameHeight,
      frameCount: frames.length,
      contentHeight: packed.contentHeight,
      scale: packed.scale,
      frameRate: FRAME_RATE,
      source: 'assets/naruto-source/nu/itachi/combo/frame_001..013.png',
      range: [slice.from, slice.to],
      residualGreen: qa.residualGreen,
      pureBlack: qa.pureBlack,
      bodyHeightVariance: Math.max(...contentHeights) - Math.min(...contentHeights),
      contentHeights,
      note: `${slice.note} (${frames.length}f); alpha-only; uniform global scale matched to walk`,
    };
    updateMeta(META_JSON, `itachi-${slice.name}`, entry);
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

  updateMeta(META_JSON, 'itachi-attack', {
    image: '/sprites/player/itachi/attack.png',
    frameWidth: packed.frameWidth,
    frameHeight: packed.frameHeight,
    frameCount: packed.frames.length,
    contentHeight: packed.contentHeight,
    scale: packed.scale,
    frameRate: FRAME_RATE,
    source: 'assets/naruto-source/nu/itachi/combo/frame_001..013.png',
    residualGreen: fullQa.residualGreen,
    pureBlack: fullQa.pureBlack,
    nativePixels: true,
    contentHeights: afterH,
    note: `full combo strip (${packed.frames.length}f); 5+5+3 splits; alpha-only; HQ nativePixels scale=${absoluteScale.toFixed(4)} → idle contentH`,
  });

  console.log(
    `-> attack.png ${fullSheet.width}x${fullSheet.height} fw=${packed.frameWidth} fh=${packed.frameHeight} n=${packed.frames.length} contentH=${packed.contentHeight} scale=${packed.scale.toFixed(4)}`,
  );
  console.log('Pack wire:', JSON.stringify(wire, null, 2));
  console.log(
    'baseScale formula: CHARACTER_DISPLAY_HEIGHT / walk.contentHeight = 52 / 48 ≈ 1.0833 (player uses walk only)',
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
