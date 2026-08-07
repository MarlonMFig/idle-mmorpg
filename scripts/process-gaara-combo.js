/**
 * Gaara combo — 15 alpha frames → combo1/2/3 (5+5+5) + full attack strip.
 *
 * Sources clean + transparent. Sand VFX may briefly freckle minor components —
 * allow tiny speckles only; never black-key hair/outline.
 *
 * npm run gaara:combo
 * Input:  assets/naruto-source/nu/gaara/combo/frame_001..015.png
 * Output: public/sprites/player/gaara/{combo1,combo2,combo3,attack,combo}.png
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
const INPUT_DIR = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'gaara', 'combo');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'gaara');
const META_JSON = path.join(OUT_DIR, 'meta.json');
const QA_DIR = path.join(ROOT, 'assets-src', '_qa', 'gaara');
const TARGET_BODY_H = 48;
const FRAME_RATE = 12;
const EXPECTED = 15;

/** Three equal beats of 5 frames each (prep/hit1 | hit2 | sand finisher). */
const SLICES = [
  { name: 'combo1', from: 0, to: 5, note: 'prep + first strike' },
  { name: 'combo2', from: 5, to: 10, note: 'second strike + sand rise' },
  { name: 'combo3', from: 10, to: 15, note: 'finisher / recovery' },
];

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

  // Standing height from early prep frames (ignore deep sand-wave bbox later)
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

  // Sand wave frames have freckle/sand-orb multi-comps (intentional VFX).
  // Early hit frames stay body-tight; full strip allows sand debris.
  const fullSheet = stitch(scaled.frames, scaled.frameWidth, scaled.frameHeight);
  const fullQa = qaSheet(
    fullSheet.data,
    fullSheet.width,
    scaled.frameHeight,
    scaled.frameWidth,
    scaled.frames.length,
    {
      requireSingleComponent: true,
      maxMinorComponent: 200,
      minBlackPerFrame: 8,
      minOlivePerFrame: 0,
      minBluePerFrame: 0,
      minOpaquePerFrame: 60,
    },
  );

  // Stricter body-only check on prep frames (no floating limbs)
  const earlyQa = qaSheet(
    fullSheet.data,
    fullSheet.width,
    scaled.frameHeight,
    scaled.frameWidth,
    5,
    {
      requireSingleComponent: true,
      maxMinorComponent: 8,
      minBlackPerFrame: 10,
      minOlivePerFrame: 0,
      minBluePerFrame: 0,
      minOpaquePerFrame: 70,
    },
  );
  console.log(
    `QA early0-4 comps: ${earlyQa.frameComps.map((c, i) => `f${i}=[${c.join(',')}]`).join(' ')}`,
  );
  const pal = countPalette(fullSheet.data);

  console.log(
    `QA full residualGreen=${fullQa.residualGreen} opaque=${fullQa.opaque} pureBlack=${fullQa.pureBlack} red=${pal.red} sand=${pal.sand} footSpread=${fullQa.footSpread}`,
  );
  console.log(
    `QA comps: ${fullQa.frameComps.map((c, i) => `f${i}=[${c.join(',')}]`).join(' ')}`,
  );

  if (fullQa.residualGreen > 0) {
    throw new Error(`QA fail: residual green = ${fullQa.residualGreen}`);
  }
  if (fullQa.pureBlack < 100) {
    throw new Error(`QA fail: pure black nearly gone (${fullQa.pureBlack})`);
  }
  if (pal.red < 80) {
    throw new Error(`QA fail: red hair nearly gone (${pal.red})`);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  await writePng(
    path.join(OUT_DIR, 'attack.png'),
    fullSheet.data,
    fullSheet.width,
    fullSheet.height,
  );
  await writePng(
    path.join(OUT_DIR, 'combo.png'),
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
        // combo3 carries the sand wave; combo1/2 stay tighter
        maxMinorComponent: slice.name === 'combo3' ? 200 : 40,
        minBlackPerFrame: 8,
        minOlivePerFrame: 0,
        minBluePerFrame: 0,
        minOpaquePerFrame: 60,
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
      image: `/sprites/player/gaara/${slice.name}.png`,
      frameWidth: scaled.frameWidth,
      frameHeight: scaled.frameHeight,
      frameCount: frames.length,
      contentHeight: scaled.contentHeight,
      scale: scaled.scale,
      frameRate: FRAME_RATE,
      source: 'assets/naruto-source/nu/gaara/combo/frame_001..015.png',
      range: [slice.from, slice.to],
      residualGreen: qa.residualGreen,
      note: `${slice.note} (${frames.length}f); alpha-only pack`,
    };
    updateMeta(META_JSON, `gaara-${slice.name}`, entry);
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

  updateMeta(META_JSON, 'gaara-attack', {
    image: '/sprites/player/gaara/attack.png',
    frameWidth: scaled.frameWidth,
    frameHeight: scaled.frameHeight,
    frameCount: scaled.frames.length,
    contentHeight: scaled.contentHeight,
    scale: scaled.scale,
    frameRate: FRAME_RATE,
    source: 'assets/naruto-source/nu/gaara/combo/frame_001..015.png',
    residualGreen: fullQa.residualGreen,
    note: `full combo strip (${scaled.frames.length}f); 5+5+5 splits; alpha-only`,
  });
  updateMeta(META_JSON, 'gaara-combo', {
    image: '/sprites/player/gaara/combo.png',
    frameWidth: scaled.frameWidth,
    frameHeight: scaled.frameHeight,
    frameCount: scaled.frames.length,
    contentHeight: scaled.contentHeight,
    scale: scaled.scale,
    frameRate: FRAME_RATE,
    source: 'assets/naruto-source/nu/gaara/combo/frame_001..015.png',
    residualGreen: fullQa.residualGreen,
    note: `full combo strip (${scaled.frames.length}f); alias of attack`,
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
