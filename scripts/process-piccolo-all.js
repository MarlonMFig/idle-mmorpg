/**
 * Piccolo pack — Namekian green preserved, maximum visual quality.
 *
 * Strategy:
 *   - absoluteScale = 1 (no nearest downscale → sharp original pixels)
 *   - contentHeight = idle body height (honest display ruler)
 *   - displayScale tunes world size without resampling the art
 *
 *   node scripts/import-piccolo-sources.js
 *   node scripts/process-piccolo-all.js
 *   node scripts/qa-piccolo-sprites.js
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const {
  ALPHA_KEEP,
  loadAlphaFrames,
  packUniformGlobalScale,
  stitch,
  writeFrameCrops,
  updateMeta,
  writePng,
  countOpaque,
  bbox,
} = require('./lib/alpha-frame-pack');

const ROOT = path.resolve(__dirname, '..');
const ID = 'piccolo';
const SRC = path.join(ROOT, 'assets', 'dragon-ball-source', 'nu', ID);
const OUT = path.join(ROOT, 'public', 'sprites', 'player', ID);
const QA = path.join(ROOT, 'assets-src', '_qa', ID);
const META = path.join(OUT, 'meta.json');
const PREVIEW = path.join(ROOT, 'public', 'sprites', 'player', 'previews', `${ID}.png`);

const COMBO_SPLITS = [7, 7, 7];
const HURT_N = 1;
const LOAD_OPTS = { chromaKey: false };
const PACK_GREEN = { preserveCostumeGreen: true };
/** Native pixels — best quality. World size via contentHeight + displayScale. */
const NATIVE_SCALE = 1;

/** True lime screen green only — never Namekian mid-tones (e.g. 33,107,66). */
function isStrictScreenGreen(r, g, b) {
  return g >= 200 && r <= 40 && b <= 40 && g >= r + 140 && g >= b + 140;
}

function countStrictScreenGreen(data) {
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < ALPHA_KEEP) continue;
    if (isStrictScreenGreen(data[i], data[i + 1], data[i + 2])) n += 1;
  }
  return n;
}

function scrubAlphaOnly(frame) {
  const d = Buffer.from(frame);
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < ALPHA_KEEP) {
      d[i] = 0;
      d[i + 1] = 0;
      d[i + 2] = 0;
      d[i + 3] = 0;
      continue;
    }
    if (d[i] >= 250 && d[i + 1] <= 5 && d[i + 2] >= 250) {
      d[i] = 0;
      d[i + 1] = 0;
      d[i + 2] = 0;
      d[i + 3] = 0;
      continue;
    }
    if (isStrictScreenGreen(d[i], d[i + 1], d[i + 2])) {
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

/** Max opaque height across packed frames (display ruler). */
function measureBodyHeight(frames, fw, fh) {
  let maxH = 0;
  for (const frame of frames) {
    let minY = fh;
    let maxY = -1;
    for (let y = 0; y < fh; y += 1) {
      for (let x = 0; x < fw; x += 1) {
        if (frame[(y * fw + x) * 4 + 3] < ALPHA_KEEP) continue;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    if (maxY >= 0) maxH = Math.max(maxH, maxY - minY + 1);
  }
  return Math.max(1, maxH);
}

async function packFolder(label, dir, expected, opts) {
  const keyed = await loadAlphaFrames(dir, expected, LOAD_OPTS);
  const frames = keyed.map((k) => scrubAlphaOnly(k.frame));
  const packed = await packUniformGlobalScale(
    frames,
    keyed.map((k) => k.width),
    keyed.map((k) => k.height),
    {
      // targetBodyH unused when absoluteScale is set; keep for API.
      targetBodyH: 48,
      pad: 2,
      absoluteScale: NATIVE_SCALE,
      allowOversizedFrames: true,
      ...PACK_GREEN,
      ...opts,
    },
  );
  for (let i = 0; i < packed.frames.length; i += 1) {
    const op = countOpaque(packed.frames[i]);
    if (op < 80) throw new Error(`${label} f${i + 1} too empty (${op}px)`);
  }
  const sheet = stitch(packed.frames, packed.frameWidth, packed.frameHeight);
  const screenGreen = countStrictScreenGreen(sheet.data);
  if (screenGreen > 0) throw new Error(`${label}: strictScreenGreen=${screenGreen}`);
  console.log(
    `OK ${label} n=${packed.frames.length} fw=${packed.frameWidth} fh=${packed.frameHeight} scale=${packed.scale.toFixed(4)}`,
  );
  return { ...packed, sheet, frameCount: packed.frames.length };
}

async function writeSheet(name, packed, qaPrefix) {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(QA, { recursive: true });
  await writePng(path.join(OUT, name), packed.sheet.data, packed.sheet.width, packed.sheet.height);
  await writeFrameCrops(
    packed.sheet,
    {
      frames: packed.frames,
      frameWidth: packed.frameWidth,
      frameHeight: packed.frameHeight,
    },
    QA,
    qaPrefix,
    3,
  );
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(QA, { recursive: true });
  fs.mkdirSync(path.dirname(PREVIEW), { recursive: true });

  console.log(`native scale=${NATIVE_SCALE} (no art downscale — max quality)`);

  const idle = await packFolder('piccolo-idle', path.join(SRC, 'idle'), 4, {
    alignX: 'feet',
  });
  const contentHeight = measureBodyHeight(idle.frames, idle.frameWidth, idle.frameHeight);
  console.log(`contentHeight=${contentHeight} (idle body ruler)`);

  await writeSheet('idle.png', idle, 'idle');
  await sharp(idle.frames[0], {
    raw: { width: idle.frameWidth, height: idle.frameHeight, channels: 4 },
  })
    .png()
    .toFile(PREVIEW);
  updateMeta(META, 'piccolo-idle', {
    image: '/sprites/player/piccolo/idle.png',
    frameWidth: idle.frameWidth,
    frameHeight: idle.frameHeight,
    frameCount: idle.frameCount,
    contentHeight,
    scale: idle.scale,
    note: 'native pixels; world size via contentHeight + displayScale',
  });

  const walk = await packFolder('piccolo-walk', path.join(SRC, 'walk'), 4, {
    alignX: 'feet',
  });
  await writeSheet('walk.png', walk, 'walk');
  updateMeta(META, 'piccolo-walk', {
    image: '/sprites/player/piccolo/walk.png',
    frameWidth: walk.frameWidth,
    frameHeight: walk.frameHeight,
    frameCount: walk.frameCount,
    contentHeight,
    scale: walk.scale,
  });

  const combo = await packFolder('piccolo-combo', path.join(SRC, 'combo'), 21, {
    alignX: 'bbox',
    pad: 3,
  });
  const sum = COMBO_SPLITS.reduce((a, b) => a + b, 0);
  if (sum !== combo.frameCount) {
    throw new Error(`combo splits ${sum} != ${combo.frameCount}`);
  }
  let cursor = 0;
  const comboParts = [];
  for (let s = 0; s < COMBO_SPLITS.length; s += 1) {
    const n = COMBO_SPLITS[s];
    const frames = combo.frames.slice(cursor, cursor + n);
    const sheet = stitch(frames, combo.frameWidth, combo.frameHeight);
    const name = `combo${s + 1}.png`;
    await writePng(path.join(OUT, name), sheet.data, sheet.width, sheet.height);
    await writeFrameCrops(
      sheet,
      { frames, frameWidth: combo.frameWidth, frameHeight: combo.frameHeight },
      QA,
      `combo${s + 1}`,
      3,
    );
    const part = {
      frameWidth: combo.frameWidth,
      frameHeight: combo.frameHeight,
      frameCount: n,
      contentHeight,
    };
    comboParts.push(part);
    updateMeta(META, `piccolo-combo${s + 1}`, {
      image: `/sprites/player/piccolo/${name}`,
      ...part,
      scale: combo.scale,
      range: [cursor, cursor + n],
    });
    console.log(`-> ${name} n=${n}`);
    cursor += n;
  }
  await writeSheet('attack.png', combo, 'attack');

  const damageKeyed = await loadAlphaFrames(path.join(SRC, 'damage'), 4, LOAD_OPTS);
  let hurtMaxAxis = 0;
  for (let i = 0; i < HURT_N; i += 1) {
    const k = damageKeyed[i];
    const b = bbox(scrubAlphaOnly(k.frame), k.width, k.height);
    hurtMaxAxis = Math.max(hurtMaxAxis, b.width, b.height);
  }
  const damageScale =
    hurtMaxAxis > 0 ? Math.min(1, contentHeight / hurtMaxAxis) : NATIVE_SCALE;
  console.log(
    `damage scale=${damageScale.toFixed(4)} (hurtMaxAxis=${hurtMaxAxis} → ≤contentHeight=${contentHeight})`,
  );
  const damage = await packFolder('piccolo-damage', path.join(SRC, 'damage'), 4, {
    alignX: 'feet',
    absoluteScale: damageScale,
    allowOversizedFrames: true,
    targetBodyH: contentHeight,
  });
  const hurtFrames = damage.frames.slice(0, HURT_N);
  const deathFrames = damage.frames.slice(HURT_N);
  const hurtSheet = stitch(hurtFrames, damage.frameWidth, damage.frameHeight);
  const deathSheet = stitch(deathFrames, damage.frameWidth, damage.frameHeight);
  await writePng(path.join(OUT, 'hurt.png'), hurtSheet.data, hurtSheet.width, hurtSheet.height);
  await writePng(path.join(OUT, 'death.png'), deathSheet.data, deathSheet.width, deathSheet.height);
  await writeFrameCrops(
    hurtSheet,
    { frames: hurtFrames, frameWidth: damage.frameWidth, frameHeight: damage.frameHeight },
    QA,
    'hurt',
    3,
  );
  await writeFrameCrops(
    deathSheet,
    { frames: deathFrames, frameWidth: damage.frameWidth, frameHeight: damage.frameHeight },
    QA,
    'death',
    3,
  );
  updateMeta(META, 'piccolo-hurt', {
    image: '/sprites/player/piccolo/hurt.png',
    frameWidth: damage.frameWidth,
    frameHeight: damage.frameHeight,
    frameCount: hurtFrames.length,
    contentHeight,
    frameRate: 10,
    scale: damage.scale,
  });
  updateMeta(META, 'piccolo-death', {
    image: '/sprites/player/piccolo/death.png',
    frameWidth: damage.frameWidth,
    frameHeight: damage.frameHeight,
    frameCount: deathFrames.length,
    contentHeight,
    frameRate: 8,
    scale: damage.scale,
  });
  console.log(`-> hurt.png n=${hurtFrames.length} death.png n=${deathFrames.length}`);

  // Suggest displayScale so world height ≈ CHARACTER_DISPLAY_HEIGHT (42).
  const suggestDisplay = Number((contentHeight / 42).toFixed(3));
  const wire = {
    walk: {
      frameWidth: walk.frameWidth,
      frameHeight: walk.frameHeight,
      frameCount: walk.frameCount,
      scale: walk.scale,
    },
    idle: {
      frameWidth: idle.frameWidth,
      frameHeight: idle.frameHeight,
      frameCount: idle.frameCount,
      scale: idle.scale,
      contentHeight,
    },
    combo: comboParts,
    hurt: { frameWidth: damage.frameWidth, frameHeight: damage.frameHeight, frameCount: HURT_N },
    death: {
      frameWidth: damage.frameWidth,
      frameHeight: damage.frameHeight,
      frameCount: deathFrames.length,
    },
    contentHeight,
    suggestDisplayScale: suggestDisplay,
    note: 'native scale=1; set pack.displayScale ≈ suggestDisplayScale for ~42px world height',
  };
  console.log('PICCOLO_WIRE', JSON.stringify(wire, null, 2));
  return wire;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
