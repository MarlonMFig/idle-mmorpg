/**
 * Shino combo attack — 16 alpha frames → combo1/2/3 (5+5+6) + attack strip.
 * Native HQ: match idle body ruler, never downscale. Keep black kikaichū dots.
 *
 * npm run shino:combo
 * Input:  assets/naruto-source/nu/shino/combo/frame_001..016.png
 * Output: public/sprites/player/shino/{combo1,combo2,combo3,attack}.png
 */
const fs = require('fs');
const path = require('path');
const {
  ALPHA_KEEP,
  loadAlphaFrames,
  packUniformGlobalScale,
  stitch,
  qaSheet,
  writeFrameCrops,
  updateMeta,
  writePng,
  bbox,
  isChromaGreen,
} = require('./lib/alpha-frame-pack');
const { preferNativeScale } = require('./lib/strip-hq-scale');

const ROOT = path.resolve(__dirname, '..');
const INPUT_DIR = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'shino', 'combo');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'shino');
const META_JSON = path.join(OUT_DIR, 'meta.json');
const QA_DIR = path.join(ROOT, 'assets-src', '_qa', 'shino');
const EXPECTED = 16;
const SLICES = [
  { name: 'combo1', from: 0, to: 5, note: 'prep + first punches' },
  { name: 'combo2', from: 5, to: 10, note: 'second beat + insect puff' },
  { name: 'combo3', from: 10, to: 16, note: 'kikaichū slash + recovery' },
];

function idleBodyH() {
  const meta = JSON.parse(fs.readFileSync(META_JSON, 'utf8'));
  const h = meta['shino-idle']?.contentHeight;
  if (!h) throw new Error('shino-idle contentHeight missing — pack idle first');
  return h;
}

function scrub(frame) {
  const d = Buffer.from(frame);
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < ALPHA_KEEP) {
      d[i] = 0;
      d[i + 1] = 0;
      d[i + 2] = 0;
      d[i + 3] = 0;
      continue;
    }
    if (isChromaGreen(d[i], d[i + 1], d[i + 2])) {
      d[i] = 0;
      d[i + 1] = 0;
      d[i + 2] = 0;
      d[i + 3] = 0;
      continue;
    }
    d[i + 3] = 255;
  }
  return d;
}

async function main() {
  const contentHeight = idleBodyH();
  const keyed = await loadAlphaFrames(INPUT_DIR, EXPECTED);
  const frames = keyed.map((k) => scrub(k.frame));
  const widths = keyed.map((k) => k.width);
  const heights = keyed.map((k) => k.height);

  let comboMaxH = 0;
  for (let i = 0; i < frames.length; i += 1) {
    comboMaxH = Math.max(comboMaxH, bbox(frames[i], widths[i], heights[i]).height);
  }
  const comboScale = preferNativeScale(comboMaxH > 0 ? contentHeight / comboMaxH : 1);
  if (comboScale < 1) {
    throw new Error(`refusing downscale ${comboScale} (comboMaxH=${comboMaxH} contentH=${contentHeight})`);
  }
  console.log(`combo scale=${comboScale.toFixed(4)} comboMaxH=${comboMaxH} → idle ${contentHeight}`);

  const packed = await packUniformGlobalScale(frames, widths, heights, {
    absoluteScale: comboScale,
    allowOversizedFrames: true,
    targetBodyH: contentHeight,
    alignX: 'feet',
  });

  const fullSheet = stitch(packed.frames, packed.frameWidth, packed.frameHeight);
  const areaScale = (contentHeight / 48) ** 2;
  const fullQa = qaSheet(
    fullSheet.data,
    fullSheet.width,
    packed.frameHeight,
    packed.frameWidth,
    packed.frames.length,
    {
      requireSingleComponent: true,
      // Insect swarm particles are intentionally detached.
      maxMinorComponent: 400,
      minBlackPerFrame: 20,
      minOlivePerFrame: 0,
      minBluePerFrame: 4,
      minOpaquePerFrame: 80,
      areaScale,
    },
  );
  console.log(
    `QA residualGreen=${fullQa.residualGreen} opaque=${fullQa.opaque} pureBlack=${fullQa.pureBlack} blue=${fullQa.blue} footSpread=${fullQa.footSpread}`,
  );
  console.log(
    `QA comps: ${fullQa.frameComps.map((c, i) => `f${i}=[${c.slice(0, 4).join(',')}]`).join(' ')}`,
  );
  if (fullQa.residualGreen > 0) throw new Error(`QA fail: residual green = ${fullQa.residualGreen}`);
  if (fullQa.pureBlack < 200) throw new Error(`QA fail: black hair/insects gone (${fullQa.pureBlack})`);
  if (fullQa.footSpread > 2) throw new Error(`QA fail: feet not locked (spread=${fullQa.footSpread})`);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(QA_DIR, { recursive: true });
  await writePng(path.join(OUT_DIR, 'attack.png'), fullSheet.data, fullSheet.width, fullSheet.height);
  await writeFrameCrops(fullSheet, packed, QA_DIR, 'combo', 3);

  for (const slice of SLICES) {
    const sliceFrames = packed.frames.slice(slice.from, slice.to);
    const sheet = stitch(sliceFrames, packed.frameWidth, packed.frameHeight);
    const qa = qaSheet(
      sheet.data,
      sheet.width,
      packed.frameHeight,
      packed.frameWidth,
      sliceFrames.length,
      {
        requireSingleComponent: true,
        maxMinorComponent: slice.name === 'combo3' ? 400 : 220,
        minBlackPerFrame: 20,
        minOlivePerFrame: 0,
        minBluePerFrame: 4,
        minOpaquePerFrame: 80,
        areaScale,
      },
    );
    if (qa.residualGreen > 0) throw new Error(`${slice.name}: residual green`);
    if (qa.footSpread > 2) throw new Error(`${slice.name}: feet spread=${qa.footSpread}`);
    await writePng(path.join(OUT_DIR, `${slice.name}.png`), sheet.data, sheet.width, sheet.height);
    await writeFrameCrops(sheet, {
      frames: sliceFrames,
      frameWidth: packed.frameWidth,
      frameHeight: packed.frameHeight,
    }, QA_DIR, slice.name, 3);
    updateMeta(META_JSON, `shino-${slice.name}`, {
      image: `/sprites/player/shino/${slice.name}.png`,
      frameWidth: packed.frameWidth,
      frameHeight: packed.frameHeight,
      frameCount: sliceFrames.length,
      contentHeight,
      scale: packed.scale,
      originX: packed.originX,
      range: [slice.from, slice.to],
      source: 'shino/combo (COMBO ATACK.zip, 16f)',
    });
    console.log(`-> ${slice.name}.png n=${sliceFrames.length} ${packed.frameWidth}x${packed.frameHeight} originX=${packed.originX.toFixed(3)} ${slice.note}`);
  }

  updateMeta(META_JSON, 'shino-attack', {
    image: '/sprites/player/shino/attack.png',
    frameWidth: packed.frameWidth,
    frameHeight: packed.frameHeight,
    frameCount: packed.frames.length,
    contentHeight,
    scale: packed.scale,
    originX: packed.originX,
    source: 'shino/combo (COMBO ATACK.zip, 16f)',
  });
  console.log('OK shino combo', packed.frameWidth, packed.frameHeight, 'scale', packed.scale);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
