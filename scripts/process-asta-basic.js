/**
 * Asta (MUGEN Time Skip) — idle + walk + combo básico.
 * Fonte: Black Clover Mugen V8 / chars/Asta Time Skip/Asta.sff
 *
 * npm run asta:basic
 */
const fs = require('fs');
const path = require('path');
const { openSff, getSprite } = require('./lib/sff-v2');
const {
  packUniformGlobalScale,
  stitch,
  writePng,
  updateMeta,
} = require('./lib/alpha-frame-pack');
const { assertAstaSheet, writeAstaQa } = require('./lib/asta-qa');

const ROOT = path.resolve(__dirname, '..');
const SFF = path.join(
  process.env.USERPROFILE || '',
  'Downloads',
  'Black Clover Mugen V8 (DirectX)',
  'Black Clover Mugen V8 (DirectX)',
  'chars',
  'Asta Time Skip',
  'Asta.sff',
);
const ID = 'asta';
const SRC_DIR = path.join(ROOT, 'assets', 'black-clover-source', 'nu', ID);
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', ID);
const QA_DIR = path.join(ROOT, 'assets-src', '_qa', ID);
const PREVIEW = path.join(ROOT, 'public', 'sprites', 'player', 'previews', `${ID}.png`);
const META = path.join(OUT_DIR, 'meta.json');

/** AIR actions → sprite group/index. */
const SEQUENCES = {
  idle: [
    [0, 0],
    [0, 1],
    [0, 2],
    [0, 3],
  ],
  walk: [
    [0, 31],
    [0, 32],
    [0, 33],
    [0, 34],
    [0, 35],
    [0, 36],
    [0, 37],
  ],
  combo1: [
    [200, 4],
    [200, 5],
    [200, 6],
  ],
  combo2: [
    [200, 0],
    [200, 1],
    [200, 2],
    [200, 3],
  ],
  combo3: [
    [200, 7],
    [200, 4],
    [200, 8],
    [200, 14],
  ],
};

function measureBodyH(frames, fw, fh) {
  let maxH = 0;
  for (const frame of frames) {
    let minY = fh;
    let maxY = -1;
    for (let y = 0; y < fh; y += 1) {
      for (let x = 0; x < fw; x += 1) {
        if (frame[(y * fw + x) * 4 + 3] < 16) continue;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    if (maxY >= 0) maxH = Math.max(maxH, maxY - minY + 1);
  }
  return Math.max(1, maxH);
}

async function packSheet(extracted) {
  return packUniformGlobalScale(
    extracted.map((s) => s.rgba),
    extracted.map((s) => s.width),
    extracted.map((s) => s.height),
    {
      absoluteScale: 1,
      allowOversizedFrames: true,
      alignX: 'feet',
    },
  );
}

async function writeSheet(name, packed, contentHeight) {
  const sheet = stitch(packed.frames, packed.frameWidth, packed.frameHeight);
  assertAstaSheet(
    sheet.data,
    sheet.width,
    packed.frameHeight,
    packed.frameWidth,
    packed.frames.length,
    name,
  );
  const outFile = path.join(OUT_DIR, `${name}.png`);
  await writePng(outFile, sheet.data, sheet.width, sheet.height);
  await writePng(
    path.join(QA_DIR, `${name}.png`),
    sheet.data,
    sheet.width,
    sheet.height,
  );
  await writeAstaQa(sheet, QA_DIR, name);
  updateMeta(META, `${ID}-${name}`, {
    image: `/sprites/player/${ID}/${name}.png`,
    frameWidth: packed.frameWidth,
    frameHeight: packed.frameHeight,
    frameCount: packed.frames.length,
    contentHeight,
    scale: packed.scale,
    originX: packed.originX,
  });
  console.log(
    `${name}: ${packed.frames.length}f ${packed.frameWidth}x${packed.frameHeight} contentH=${contentHeight} scale=${packed.scale.toFixed(4)} originX=${packed.originX.toFixed(3)}`,
  );
  return packed;
}

async function main() {
  if (!fs.existsSync(SFF)) {
    throw new Error(`SFF not found: ${SFF}`);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(QA_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(PREVIEW), { recursive: true });

  const sff = openSff(SFF);
  const extracted = {};
  for (const [name, pairs] of Object.entries(SEQUENCES)) {
    const dir = path.join(SRC_DIR, name);
    fs.mkdirSync(dir, { recursive: true });
    extracted[name] = [];
    for (let i = 0; i < pairs.length; i += 1) {
      const [group, number] = pairs[i];
      const sprite = getSprite(sff, group, number);
      extracted[name].push(sprite);
      await writePng(
        path.join(dir, `frame_${String(i + 1).padStart(3, '0')}.png`),
        sprite.rgba,
        sprite.width,
        sprite.height,
      );
    }
  }

  const idlePacked = await packUniformGlobalScale(
    extracted.idle.map((s) => s.rgba),
    extracted.idle.map((s) => s.width),
    extracted.idle.map((s) => s.height),
    { absoluteScale: 1, allowOversizedFrames: true, alignX: 'feet' },
  );
  const idleBodyH = measureBodyH(
    idlePacked.frames,
    idlePacked.frameWidth,
    idlePacked.frameHeight,
  );
  console.log(`asta: idle body ruler contentHeight=${idleBodyH}`);

  await writeSheet('idle', idlePacked, idleBodyH);

  for (const name of ['walk', 'combo1', 'combo2', 'combo3']) {
    const packed = await packSheet(extracted[name]);
    await writeSheet(name, packed, idleBodyH);
  }

  const previewFrame = idlePacked.frames[0];
  await writePng(PREVIEW, previewFrame, idlePacked.frameWidth, idlePacked.frameHeight);
  console.log(`preview: ${PREVIEW}`);
  console.log(
    JSON.stringify(
      {
        id: ID,
        contentHeight: idleBodyH,
        idle: {
          frameWidth: idlePacked.frameWidth,
          frameHeight: idlePacked.frameHeight,
          frameCount: idlePacked.frames.length,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
