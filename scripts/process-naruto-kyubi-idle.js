/**
 * Reprocess only Naruto Kyubi idle (feet-locked) after horizontal drift fix.
 * npm run naruto-kyubi:idle
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const {
  packUniformGlobalScale,
  loadAlphaFrames,
  stitch,
  writePng,
  writeFrameCrops,
  updateMeta,
  countOpaque,
  isChromaGreen,
  ALPHA_KEEP,
} = require('./lib/alpha-frame-pack');

const ROOT = path.resolve(__dirname, '..');
const ID = 'naruto-kyubi';
const SRC = path.join(ROOT, 'assets', 'naruto-source', 'nu', ID);
const OUT = path.join(ROOT, 'public', 'sprites', 'player', ID);
const PREVIEW = path.join(ROOT, 'public', 'sprites', 'player', 'previews', `${ID}.png`);
const META = path.join(OUT, 'meta.json');
const QA = path.join(ROOT, 'assets-src', '_qa', ID);
const TARGET = 48;
const PAD = 2;

function scrub(frame) {
  const d = Buffer.from(frame);
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < ALPHA_KEEP) {
      d[i] = d[i + 1] = d[i + 2] = d[i + 3] = 0;
      continue;
    }
    if (isChromaGreen(d[i], d[i + 1], d[i + 2])) {
      d[i] = d[i + 1] = d[i + 2] = d[i + 3] = 0;
      continue;
    }
    d[i + 3] = 255;
  }
  return d;
}

function footCxInCell(data, fw, fh) {
  let sum = 0;
  let n = 0;
  let maxY = -1;
  for (let y = 0; y < fh; y += 1) {
    for (let x = 0; x < fw; x += 1) {
      if (data[(y * fw + x) * 4 + 3] < ALPHA_KEEP) continue;
      if (y > maxY) maxY = y;
    }
  }
  const y0 = Math.max(0, maxY - 4);
  for (let y = y0; y <= maxY; y += 1) {
    for (let x = 0; x < fw; x += 1) {
      if (data[(y * fw + x) * 4 + 3] < ALPHA_KEEP) continue;
      sum += x;
      n += 1;
    }
  }
  return n > 0 ? sum / n : fw / 2;
}

async function main() {
  // Match walk scale used when full pack was built.
  const walkKeyed = await loadAlphaFrames(path.join(SRC, 'walk'), 6);
  const walkFrames = walkKeyed.map((k) => scrub(k.frame));
  const walkPack = await packUniformGlobalScale(
    walkFrames,
    walkKeyed.map((k) => k.width),
    walkKeyed.map((k) => k.height),
    { targetBodyH: TARGET, pad: PAD },
  );
  const walkScale = walkPack.scale;

  const keyed = await loadAlphaFrames(path.join(SRC, 'idle'), 6);
  const frames = keyed.map((k) => scrub(k.frame));
  const packed = await packUniformGlobalScale(
    frames,
    keyed.map((k) => k.width),
    keyed.map((k) => k.height),
    {
      targetBodyH: TARGET,
      pad: PAD,
      absoluteScale: walkScale,
      alignX: 'feet',
    },
  );

  for (let i = 0; i < packed.frames.length; i += 1) {
    if (countOpaque(packed.frames[i]) < 50) {
      throw new Error(`idle f${i + 1} empty`);
    }
  }

  const feet = packed.frames.map((f) => footCxInCell(f, packed.frameWidth, packed.frameHeight));
  const minF = Math.min(...feet);
  const maxF = Math.max(...feet);
  console.log(
    `feetX locked: min=${minF.toFixed(2)} max=${maxF.toFixed(2)} Δ=${(maxF - minF).toFixed(2)}`,
  );
  if (maxF - minF > 1.2) {
    throw new Error(`idle feet still drift Δ=${(maxF - minF).toFixed(2)}px`);
  }

  const sheet = stitch(packed.frames, packed.frameWidth, packed.frameHeight);
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(QA, { recursive: true });
  await writePng(path.join(OUT, 'idle.png'), sheet.data, sheet.width, sheet.height);
  await writeFrameCrops(
    sheet,
    {
      frames: packed.frames,
      frameWidth: packed.frameWidth,
      frameHeight: packed.frameHeight,
    },
    QA,
    'idle',
    3,
  );
  await sharp(packed.frames[0], {
    raw: { width: packed.frameWidth, height: packed.frameHeight, channels: 4 },
  })
    .png()
    .toFile(PREVIEW);

  updateMeta(META, `${ID}-idle`, {
    image: `/sprites/player/${ID}/idle.png`,
    frameWidth: packed.frameWidth,
    frameHeight: packed.frameHeight,
    frameCount: packed.frameCount ?? packed.frames.length,
    contentHeight: 48,
    scale: packed.scale,
    alignX: 'feet',
    feetDriftPx: maxF - minF,
  });

  console.log(
    'PACK_WIRE idle',
    JSON.stringify({
      frameWidth: packed.frameWidth,
      frameHeight: packed.frameHeight,
      frameCount: packed.frames.length,
      scale: packed.scale,
    }),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
