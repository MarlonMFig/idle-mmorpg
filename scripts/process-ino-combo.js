/**
 * Ino Yamanaka combo attack — alpha-only frames (14f → 5+5+4).
 * Clean transparent sources: NO black flood/peel. Never key purple hair.
 *
 * npm run ino:combo
 * Input:  assets/naruto-source/nu/ino/combo/frame_001..014.png
 * Output: public/sprites/player/ino/{combo1,combo2,combo3,attack}.png
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
const INPUT_DIR = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'ino', 'combo');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'ino');
const META_JSON = path.join(OUT_DIR, 'meta.json');
const QA_DIR = path.join(ROOT, 'assets-src', '_qa', 'ino');
const TARGET_BODY_H = 48;
const FRAME_RATE = 12;
const EXPECTED = 14;

/** Three multi-hit beats: hit1 | hit2 | finisher (5+5+4). */
const SLICES = [
  { name: 'combo1', from: 0, to: 5, note: 'prep + first strike' },
  { name: 'combo2', from: 5, to: 10, note: 'second strike' },
  { name: 'combo3', from: 10, to: 14, note: 'finisher / recovery' },
];

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

  // Standing height from early prep frames (ignore deep lunge bbox later)
  const norm = normalize(
    keyed.map((k) => k.frame),
    keyed.map((k) => k.width),
    keyed.map((k) => k.height),
    { contentFromN: 3 },
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

  const fullSheet = stitch(scaled.frames, scaled.frameWidth, scaled.frameHeight);
  const fullQa = qaSheet(
    fullSheet.data,
    fullSheet.width,
    scaled.frameHeight,
    scaled.frameWidth,
    scaled.frames.length,
    {
      requireSingleComponent: true,
      // Combo hair strands / motion flecks near body may detach by 1–2px after nearest scale
      maxMinorComponent: 16,
      minBlackPerFrame: 15,
      minOlivePerFrame: 0,
      minBluePerFrame: 0,
      minOpaquePerFrame: 80,
    },
  );
  const purple = countPurple(fullSheet.data);

  console.log(
    `QA full residualGreen=${fullQa.residualGreen} opaque=${fullQa.opaque} pureBlack=${fullQa.pureBlack} purpleHair=${purple} footSpread=${fullQa.footSpread}`,
  );
  console.log(
    `QA comps: ${fullQa.frameComps.map((c, i) => `f${i}=[${c.join(',')}]`).join(' ')}`,
  );

  if (fullQa.residualGreen > 0) {
    throw new Error(`QA fail: residual green = ${fullQa.residualGreen}`);
  }
  if (fullQa.pureBlack < 120) {
    throw new Error(`QA fail: pure black nearly gone (${fullQa.pureBlack})`);
  }
  if (purple < 50) {
    throw new Error(`QA fail: purple hair nearly gone (${purple})`);
  }
  if (fullQa.footSpread > 6) {
    console.warn(`WARN footSpread=${fullQa.footSpread}`);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  await writePng(
    path.join(OUT_DIR, 'attack.png'),
    fullSheet.data,
    fullSheet.width,
    fullSheet.height,
  );
  await writeFrameCrops(fullSheet, scaled, QA_DIR, 'combo', 3);

  const wire = {};
  for (const slice of SLICES) {
    const frames = scaled.frames.slice(slice.from, slice.to);
    const sheet = stitch(frames, scaled.frameWidth, scaled.frameHeight);
    const qa = qaSheet(
      sheet.data,
      sheet.width,
      scaled.frameHeight,
      scaled.frameWidth,
      frames.length,
      {
        requireSingleComponent: true,
        maxMinorComponent: 16,
        minBlackPerFrame: 15,
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
      image: `/sprites/player/ino/${slice.name}.png`,
      frameWidth: scaled.frameWidth,
      frameHeight: scaled.frameHeight,
      frameCount: frames.length,
      contentHeight: scaled.contentHeight,
      scale: scaled.scale,
      frameRate: FRAME_RATE,
      source: 'assets/naruto-source/nu/ino/combo/frame_001..014.png',
      range: [slice.from, slice.to],
      residualGreen: qa.residualGreen,
      note: `${slice.note} (${frames.length}f); alpha-only pack`,
    };
    updateMeta(META_JSON, `ino-${slice.name}`, entry);
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

  updateMeta(META_JSON, 'ino-attack', {
    image: '/sprites/player/ino/attack.png',
    frameWidth: scaled.frameWidth,
    frameHeight: scaled.frameHeight,
    frameCount: scaled.frames.length,
    contentHeight: scaled.contentHeight,
    scale: scaled.scale,
    frameRate: FRAME_RATE,
    source: 'assets/naruto-source/nu/ino/combo/frame_001..014.png',
    residualGreen: fullQa.residualGreen,
    purpleHair: purple,
    note: `full combo strip (${scaled.frames.length}f); 5+5+4 splits; alpha-only`,
  });

  console.log(
    `-> attack.png ${fullSheet.width}x${fullSheet.height} fw=${scaled.frameWidth} fh=${scaled.frameHeight} n=${scaled.frames.length} contentH=${scaled.contentHeight} scale=${scaled.scale.toFixed(4)}`,
  );
  console.log('Pack wire:', JSON.stringify(wire, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
