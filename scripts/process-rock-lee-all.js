/**
 * Rock Lee full pack — alpha-only frames (JUTSU COMPLETO zip set).
 *
 * walk → idle → combo (22f → 7+7+8) → damage (2 hurt + 3 death) → jutsu
 *   JUTSU COMPLETO (20f): Omote Renge only
 *
 * contentH 48 · residualGreen 0 · walk-matched scale
 *
 * npm run rock-lee:all
 * Input:  assets/naruto-source/nu/rock-lee/{idle,walk,combo,damage,jutsu}/frame_*.png
 * Output: public/sprites/player/rock-lee/*
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
  isChromaGreen,
  bbox,
} = require('./lib/alpha-frame-pack');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'rock-lee');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'rock-lee');
const PREVIEW = path.join(ROOT, 'public', 'sprites', 'player', 'previews', 'rock-lee.png');
const META_JSON = path.join(OUT_DIR, 'meta.json');
const QA_DIR = path.join(ROOT, 'assets-src', '_qa', 'rock-lee');
/** HQ: native pixels (scale=1). World size via contentHeight. */
const NATIVE_SCALE = 1;
const PAD = 2;

function measureBodyHeight(frames, fw, fh) {
  let maxH = 0;
  for (const frame of frames) {
    const b = bbox(frame, fw, fh);
    maxH = Math.max(maxH, b.height);
  }
  return Math.max(1, maxH);
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

function countGreen(data) {
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < ALPHA_KEEP) continue;
    if (isChromaGreen(data[i], data[i + 1], data[i + 2])) n += 1;
  }
  return n;
}

function countBlack(data) {
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < ALPHA_KEEP) continue;
    if (data[i] <= 12 && data[i + 1] <= 12 && data[i + 2] <= 12) n += 1;
  }
  return n;
}

function removeTinyIslands(frame, w, h, maxSize = 2) {
  const N = w * h;
  const seen = new Uint8Array(N);
  for (let start = 0; start < N; start += 1) {
    if (seen[start] || frame[start * 4 + 3] < ALPHA_KEEP) continue;
    const stack = [start];
    const cells = [];
    seen[start] = 1;
    while (stack.length) {
      const idx = stack.pop();
      cells.push(idx);
      const x = idx % w;
      const y = (idx / w) | 0;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        if (seen[ni] || frame[ni * 4 + 3] < ALPHA_KEEP) continue;
        seen[ni] = 1;
        stack.push(ni);
      }
    }
    if (cells.length <= maxSize) {
      for (const idx of cells) {
        const i = idx * 4;
        frame[i] = 0;
        frame[i + 1] = 0;
        frame[i + 2] = 0;
        frame[i + 3] = 0;
      }
    }
  }
}

async function packSequence(label, inputDir, expected, { absoluteScale = NATIVE_SCALE, contentHeight = null } = {}) {
  const keyed = await loadAlphaFrames(inputDir, expected);
  const frames = keyed.map((k) => scrub(k.frame));
  const widths = keyed.map((k) => k.width);
  const heights = keyed.map((k) => k.height);

  const packed = await packUniformGlobalScale(frames, widths, heights, {
    targetBodyH: contentHeight || 48,
    pad: PAD,
    absoluteScale,
    allowOversizedFrames: true,
  });

  for (let i = 0; i < packed.frames.length; i += 1) {
    removeTinyIslands(packed.frames[i], packed.frameWidth, packed.frameHeight, 2);
    const op = countOpaque(packed.frames[i]);
    if (op < 60) throw new Error(`${label} f${i + 1} too empty (${op}px)`);
  }

  const sheet = stitch(packed.frames, packed.frameWidth, packed.frameHeight);
  const residualGreen = countGreen(sheet.data);
  const pureBlack = countBlack(sheet.data);
  if (residualGreen > 0) {
    throw new Error(`${label}: residualGreen=${residualGreen}`);
  }

  const bodyH =
    contentHeight ||
    measureBodyHeight(packed.frames, packed.frameWidth, packed.frameHeight);

  console.log(
    `OK ${label} n=${packed.frames.length} fw=${packed.frameWidth} fh=${packed.frameHeight} scale=${packed.scale.toFixed(4)} contentH=${bodyH} black=${pureBlack}`,
  );

  return {
    sheet,
    frames: packed.frames,
    frameWidth: packed.frameWidth,
    frameHeight: packed.frameHeight,
    contentHeight: bodyH,
    scale: packed.scale,
    residualGreen,
    pureBlack,
    frameCount: packed.frames.length,
    maxContentH: packed.maxContentH,
  };
}

async function writeSheet(outName, packed, qaPrefix) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, outName);
  await writePng(outPath, packed.sheet.data, packed.sheet.width, packed.sheet.height);
  await writeFrameCrops(
    packed.sheet,
    {
      frames: packed.frames,
      frameWidth: packed.frameWidth,
      frameHeight: packed.frameHeight,
    },
    QA_DIR,
    qaPrefix,
    3,
  );
  return outPath;
}

async function processIdle() {
  const packed = await packSequence('idle', path.join(SRC, 'idle'), 6, {
    absoluteScale: NATIVE_SCALE,
  });
  await writeSheet('idle.png', packed, 'idle');
  // Preview from idle f0
  const f0 = packed.frames[0];
  await sharp(f0, {
    raw: { width: packed.frameWidth, height: packed.frameHeight, channels: 4 },
  })
    .png()
    .toFile(PREVIEW);
  updateMeta(META_JSON, 'rock-lee-idle', {
    image: '/sprites/player/rock-lee/idle.png',
    frameWidth: packed.frameWidth,
    frameHeight: packed.frameHeight,
    frameCount: packed.frameCount,
    contentHeight: packed.contentHeight,
    scale: packed.scale,
    residualGreen: packed.residualGreen,
    pureBlack: packed.pureBlack,
    source: 'assets/naruto-source/nu/rock-lee/idle',
  });
  return packed;
}

async function processWalk(contentHeight) {
  const packed = await packSequence('walk', path.join(SRC, 'walk'), 6, {
    absoluteScale: NATIVE_SCALE,
    contentHeight,
  });
  await writeSheet('walk.png', packed, 'walk');
  updateMeta(META_JSON, 'rock-lee-walk', {
    image: '/sprites/player/rock-lee/walk.png',
    frameWidth: packed.frameWidth,
    frameHeight: packed.frameHeight,
    frameCount: packed.frameCount,
    contentHeight,
    scale: packed.scale,
    residualGreen: packed.residualGreen,
    pureBlack: packed.pureBlack,
    source: 'assets/naruto-source/nu/rock-lee/walk',
  });
  return { ...packed, contentHeight };
}

async function processCombo(contentHeight) {
  const packed = await packSequence('combo', path.join(SRC, 'combo'), 22, {
    absoluteScale: NATIVE_SCALE,
    contentHeight,
  });
  // 7 + 7 + 8
  const splits = [
    { name: 'combo1.png', key: 'rock-lee-combo1', from: 0, to: 7 },
    { name: 'combo2.png', key: 'rock-lee-combo2', from: 7, to: 14 },
    { name: 'combo3.png', key: 'rock-lee-combo3', from: 14, to: 22 },
  ];
  const parts = [];
  for (const sp of splits) {
    const frames = packed.frames.slice(sp.from, sp.to);
    const sheet = stitch(frames, packed.frameWidth, packed.frameHeight);
    await writePng(path.join(OUT_DIR, sp.name), sheet.data, sheet.width, sheet.height);
    await writeFrameCrops(
      sheet,
      { frames, frameWidth: packed.frameWidth, frameHeight: packed.frameHeight },
      QA_DIR,
      sp.key.replace('rock-lee-', ''),
      3,
    );
    const entry = {
      image: `/sprites/player/rock-lee/${sp.name}`,
      frameWidth: packed.frameWidth,
      frameHeight: packed.frameHeight,
      frameCount: frames.length,
      contentHeight,
      scale: packed.scale,
      residualGreen: 0,
      range: [sp.from, sp.to],
    };
    updateMeta(META_JSON, sp.key, entry);
    parts.push(entry);
    console.log(`-> ${sp.name} n=${frames.length}`);
  }
  // Full attack strip (debug / optional)
  await writeSheet('attack.png', packed, 'attack');
  updateMeta(META_JSON, 'rock-lee-attack', {
    image: '/sprites/player/rock-lee/attack.png',
    frameWidth: packed.frameWidth,
    frameHeight: packed.frameHeight,
    frameCount: packed.frameCount,
    contentHeight,
    scale: packed.scale,
  });
  return { packed, parts };
}

async function processDamage(contentHeight) {
  const packed = await packSequence('damage', path.join(SRC, 'damage'), 5, {
    absoluteScale: NATIVE_SCALE,
    contentHeight,
  });
  // 2 hurt + 3 death
  const hurtFrames = packed.frames.slice(0, 2);
  const deathFrames = packed.frames.slice(2, 5);
  const hurtSheet = stitch(hurtFrames, packed.frameWidth, packed.frameHeight);
  const deathSheet = stitch(deathFrames, packed.frameWidth, packed.frameHeight);
  await writePng(path.join(OUT_DIR, 'hurt.png'), hurtSheet.data, hurtSheet.width, hurtSheet.height);
  await writePng(
    path.join(OUT_DIR, 'death.png'),
    deathSheet.data,
    deathSheet.width,
    deathSheet.height,
  );
  await writeFrameCrops(
    hurtSheet,
    {
      frames: hurtFrames,
      frameWidth: packed.frameWidth,
      frameHeight: packed.frameHeight,
    },
    QA_DIR,
    'hurt',
    3,
  );
  await writeFrameCrops(
    deathSheet,
    {
      frames: deathFrames,
      frameWidth: packed.frameWidth,
      frameHeight: packed.frameHeight,
    },
    QA_DIR,
    'death',
    3,
  );
  const hurt = {
    image: '/sprites/player/rock-lee/hurt.png',
    frameWidth: packed.frameWidth,
    frameHeight: packed.frameHeight,
    frameCount: 2,
    contentHeight,
    scale: packed.scale,
    frameRate: 10,
  };
  const death = {
    image: '/sprites/player/rock-lee/death.png',
    frameWidth: packed.frameWidth,
    frameHeight: packed.frameHeight,
    frameCount: 3,
    contentHeight,
    scale: packed.scale,
    frameRate: 8,
  };
  updateMeta(META_JSON, 'rock-lee-hurt', hurt);
  updateMeta(META_JSON, 'rock-lee-death', death);
  console.log('-> hurt.png n=2 death.png n=3');
  return { hurt, death, packed };
}

async function processJutsu(contentHeight) {
  // JUTSU COMPLETO.zip — 20 sequential alpha frames (frame_001…020) → Omote Renge
  const packed = await packSequence('jutsu', path.join(SRC, 'jutsu'), 20, {
    absoluteScale: NATIVE_SCALE,
    contentHeight,
  });
  const scale = packed.scale;

  await writeSheet('omote-renge.png', packed, 'omote-renge');

  const FRAME_RATE = 14;
  // f1 jump · f2–15 air · f16 ground impact · f17–20 recovery (1-based)
  const omoteHitFrame = 15; // 0-based index of frame 16
  const omote = {
    image: '/sprites/player/rock-lee/omote-renge.png',
    frameWidth: packed.frameWidth,
    frameHeight: packed.frameHeight,
    frameCount: packed.frameCount,
    contentHeight,
    scale,
    frameRate: FRAME_RATE,
    durationMs: Math.round((packed.frameCount / FRAME_RATE) * 1000),
    hitDelayMs: Math.round((omoteHitFrame / FRAME_RATE) * 1000),
    residualGreen: 0,
    pureBlack: packed.pureBlack,
    source: 'assets/naruto-source/nu/rock-lee/jutsu frames 1–20 (JUTSU COMPLETO)',
  };
  updateMeta(META_JSON, 'rock-lee-omote-renge', omote);
  updateMeta(META_JSON, 'skill-omote-renge', omote);
  // Drop legacy Konoha Senpu sheets from meta if present
  try {
    const meta = JSON.parse(fs.readFileSync(META_JSON, 'utf8'));
    delete meta['rock-lee-konoha-senpu'];
    delete meta['skill-konoha-senpu'];
    fs.writeFileSync(META_JSON, `${JSON.stringify(meta, null, 2)}\n`);
  } catch {
    /* ignore */
  }
  const konohaPath = path.join(OUT_DIR, 'konoha-senpu.png');
  if (fs.existsSync(konohaPath)) fs.unlinkSync(konohaPath);
  console.log(
    `-> omote-renge.png n=${omote.frameCount} hit=${omote.hitDelayMs}ms fw=${packed.frameWidth} fh=${packed.frameHeight}`,
  );
  return { omote, packed };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(QA_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(PREVIEW), { recursive: true });

  console.log('rock-lee HQ native scale=1');
  const idle = await processIdle();
  const contentHeight = idle.contentHeight;
  console.log(`contentHeight=${contentHeight} (idle body ruler)`);
  const walk = await processWalk(contentHeight);
  const combo = await processCombo(contentHeight);
  const damage = await processDamage(contentHeight);
  const jutsu = await processJutsu(contentHeight);

  const wire = {
    walk: {
      frameWidth: walk.frameWidth,
      frameHeight: walk.frameHeight,
      frameCount: walk.frameCount,
      contentHeight,
      scale: walk.scale,
    },
    idle: {
      frameWidth: idle.frameWidth,
      frameHeight: idle.frameHeight,
      frameCount: idle.frameCount,
      contentHeight,
    },
    combo: combo.parts.map((p) => ({
      frameWidth: p.frameWidth,
      frameHeight: p.frameHeight,
      frameCount: p.frameCount,
      contentHeight,
    })),
    hurt: damage.hurt,
    death: damage.death,
    omote: {
      frameWidth: jutsu.omote.frameWidth,
      frameHeight: jutsu.omote.frameHeight,
      frameCount: jutsu.omote.frameCount,
      contentHeight,
      durationMs: jutsu.omote.durationMs,
      hitDelayMs: jutsu.omote.hitDelayMs,
      frameRate: jutsu.omote.frameRate,
    },
    nativePixels: true,
  };
  console.log('PACK_WIRE', JSON.stringify(wire, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
