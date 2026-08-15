/**
 * Monkey D. Luffy — pack lateral HQ (alpha frames).
 * Fontes: Downloads/SPRITES JOGO/LUFFY → assets/one-piece-source/nu/luffy/
 *
 * Idle scale=1 (native). Walk/combo/damage/jutsu match idle body so the
 * character stays the same world size; combo/jutsu never crush the straw hat.
 *
 * npm run luffy:all
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
  writeMagentaPreview,
} = require('./lib/alpha-frame-pack');
const { preferNativeScale } = require('./lib/strip-hq-scale');

const ROOT = path.resolve(__dirname, '..');
const ID = 'luffy';
const SRC = path.join(ROOT, 'assets', 'one-piece-source', 'nu', ID);
const OUT = path.join(ROOT, 'public', 'sprites', 'player', ID);
const QA = path.join(ROOT, 'assets-src', '_qa', ID);
const PREVIEW = path.join(ROOT, 'public', 'sprites', 'player', 'previews', `${ID}.png`);
const META = path.join(OUT, 'meta.json');

const EXPECTED = { idle: 4, walk: 8, combo: 19, damage: 4, jutsu: 14 };
const COMBO_SPLITS = [6, 6, 7];
const HURT_N = 3;

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

function measureBodyH(frames, fw, fh) {
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

function assertSheet(sheetData, sheetW, fh, fw, n, name, { lockFeet = true } = {}) {
  let residualGreen = 0;
  const footY = [];
  for (let f = 0; f < n; f += 1) {
    let opaque = 0;
    let maxFoot = -1;
    let yellow = 0;
    for (let y = 0; y < fh; y += 1) {
      for (let x = 0; x < fw; x += 1) {
        const i = (y * sheetW + f * fw + x) * 4;
        if (sheetData[i + 3] < ALPHA_KEEP) continue;
        opaque += 1;
        if (isChromaGreen(sheetData[i], sheetData[i + 1], sheetData[i + 2])) {
          residualGreen += 1;
        }
        // Straw hat: yellow/tan must survive chroma punch.
        if (sheetData[i] >= 160 && sheetData[i + 1] >= 120 && sheetData[i + 2] <= 90) {
          yellow += 1;
        }
        if (y > maxFoot) maxFoot = y;
      }
    }
    if (opaque < 40) {
      throw new Error(`${name} frame ${f} too empty (${opaque}px)`);
    }
    if (name === 'idle' && yellow < 8) {
      throw new Error(`${name} frame ${f}: straw hat yellow missing (${yellow}px)`);
    }
    footY.push(maxFoot);
  }
  if (residualGreen > 0) {
    throw new Error(`${name}: residual chroma green ${residualGreen}px`);
  }
  const feet = footY.filter((y) => y >= 0);
  const spread = feet.length ? Math.max(...feet) - Math.min(...feet) : 0;
  if (lockFeet && spread > 2) {
    throw new Error(`${name}: feet not locked (spread=${spread} ${feet.join(',')})`);
  }
  return { residualGreen, footSpread: spread };
}

async function packDir(label, dir, expected, opts) {
  const keyed = await loadAlphaFrames(dir, expected);
  const frames = keyed.map((k) => scrub(k.frame));
  const widths = keyed.map((k) => k.width);
  const heights = keyed.map((k) => k.height);
  const packed = await packUniformGlobalScale(frames, widths, heights, {
    pad: 2,
    allowOversizedFrames: true,
    alignX: 'feet',
    ...opts,
  });
  for (let i = 0; i < packed.frames.length; i += 1) {
    removeTinyIslands(packed.frames[i], packed.frameWidth, packed.frameHeight, 2);
    const op = countOpaque(packed.frames[i]);
    if (op < 50) throw new Error(`${label} f${i + 1} too empty (${op}px)`);
  }
  const sheet = stitch(packed.frames, packed.frameWidth, packed.frameHeight);
  const residualGreen = countGreen(sheet.data);
  if (residualGreen > 0) throw new Error(`${label}: residualGreen=${residualGreen}`);
  console.log(
    `OK ${label} n=${packed.frames.length} fw=${packed.frameWidth} fh=${packed.frameHeight} scale=${packed.scale.toFixed(4)} originX=${packed.originX.toFixed(3)}`,
  );
  return { ...packed, sheet, residualGreen, frameCount: packed.frames.length };
}

async function writeNamed(name, packed, contentHeight, { lockFeet = true, frameRate } = {}) {
  assertSheet(
    packed.sheet.data,
    packed.sheet.width,
    packed.frameHeight,
    packed.frameWidth,
    packed.frames.length,
    name,
    { lockFeet },
  );
  await writePng(path.join(OUT, `${name}.png`), packed.sheet.data, packed.sheet.width, packed.sheet.height);
  await writeMagentaPreview(packed.sheet, path.join(QA, `${name}-magenta.png`));
  await writeFrameCrops(
    packed.sheet,
    {
      frames: packed.frames,
      frameWidth: packed.frameWidth,
      frameHeight: packed.frameHeight,
    },
    QA,
    name,
    3,
  );
  const meta = {
    image: `/sprites/player/${ID}/${name}.png`,
    frameWidth: packed.frameWidth,
    frameHeight: packed.frameHeight,
    frameCount: packed.frames.length,
    contentHeight,
    scale: packed.scale,
    originX: packed.originX,
  };
  if (frameRate != null) meta.frameRate = frameRate;
  updateMeta(META, `${ID}-${name}`, meta);
  return meta;
}

function maxBBoxH(keyed, n = keyed.length) {
  let h = 0;
  for (let i = 0; i < Math.min(n, keyed.length); i += 1) {
    const b = bbox(scrub(keyed[i].frame), keyed[i].width, keyed[i].height);
    h = Math.max(h, b.height);
  }
  return h;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(QA, { recursive: true });
  fs.mkdirSync(path.dirname(PREVIEW), { recursive: true });

  const idle = await packDir(`${ID}-idle`, path.join(SRC, 'idle'), EXPECTED.idle, {
    absoluteScale: 1,
  });
  const contentHeight = measureBodyH(idle.frames, idle.frameWidth, idle.frameHeight);
  console.log(`${ID}: idle body ruler contentHeight=${contentHeight}`);

  const walkKeyed = await loadAlphaFrames(path.join(SRC, 'walk'), EXPECTED.walk);
  const walkScale = preferNativeScale(contentHeight / Math.max(1, maxBBoxH(walkKeyed)));
  console.log(`${ID}: walk scale=${walkScale.toFixed(4)}`);
  const walk = await packDir(`${ID}-walk`, path.join(SRC, 'walk'), EXPECTED.walk, {
    absoluteScale: walkScale,
    targetBodyH: contentHeight,
  });

  // Combo rip is ~2.3× denser. Match standing punches (f1–6), not kick bbox,
  // so Luffy doesn't shrink; kicks may overshoot (allowOversized).
  const comboKeyed = await loadAlphaFrames(path.join(SRC, 'combo'), EXPECTED.combo);
  const comboStandH = maxBBoxH(comboKeyed, 6);
  const comboScale = preferNativeScale(contentHeight / Math.max(1, comboStandH));
  console.log(`${ID}: combo scale=${comboScale.toFixed(4)} (standH=${comboStandH} → ${contentHeight})`);
  const combo = await packDir(`${ID}-combo`, path.join(SRC, 'combo'), EXPECTED.combo, {
    absoluteScale: comboScale,
    targetBodyH: contentHeight,
  });
  const splitSum = COMBO_SPLITS.reduce((a, b) => a + b, 0);
  if (splitSum !== combo.frameCount) {
    throw new Error(`combo splits ${splitSum} != ${combo.frameCount}`);
  }

  const dmgKeyed = await loadAlphaFrames(path.join(SRC, 'damage'), EXPECTED.damage);
  const hurtH = maxBBoxH(dmgKeyed, HURT_N);
  const damageScale = preferNativeScale(contentHeight / Math.max(1, hurtH));
  console.log(`${ID}: damage scale=${damageScale.toFixed(4)} (hurtH=${hurtH})`);
  const damage = await packDir(`${ID}-damage`, path.join(SRC, 'damage'), EXPECTED.damage, {
    absoluteScale: damageScale,
    targetBodyH: contentHeight,
  });

  // Jutsu: match gatling-frame height (f6–12), not the crouch, so the caster
  // stays idle-sized and the rubber fists can overshoot.
  const jutsuKeyed = await loadAlphaFrames(path.join(SRC, 'jutsu'), EXPECTED.jutsu);
  let jutsuRefH = 0;
  for (let i = 5; i < Math.min(12, jutsuKeyed.length); i += 1) {
    const b = bbox(scrub(jutsuKeyed[i].frame), jutsuKeyed[i].width, jutsuKeyed[i].height);
    jutsuRefH = Math.max(jutsuRefH, b.height);
  }
  const jutsuScale = preferNativeScale(contentHeight / Math.max(1, jutsuRefH));
  console.log(`${ID}: jutsu scale=${jutsuScale.toFixed(4)} (gatlingH=${jutsuRefH})`);
  const jutsu = await packDir(`${ID}-jutsu`, path.join(SRC, 'jutsu'), EXPECTED.jutsu, {
    absoluteScale: jutsuScale,
    targetBodyH: contentHeight,
  });

  await writeNamed('idle', idle, contentHeight, { lockFeet: true, frameRate: 8 });
  await writeNamed('walk', walk, contentHeight, { lockFeet: true, frameRate: 12 });

  await sharp(idle.frames[0], {
    raw: { width: idle.frameWidth, height: idle.frameHeight, channels: 4 },
  })
    .png()
    .toFile(PREVIEW);

  let cursor = 0;
  const comboParts = [];
  for (let s = 0; s < COMBO_SPLITS.length; s += 1) {
    const n = COMBO_SPLITS[s];
    const frames = combo.frames.slice(cursor, cursor + n);
    const sheet = stitch(frames, combo.frameWidth, combo.frameHeight);
    const name = `combo${s + 1}`;
    const part = {
      ...combo,
      frames,
      sheet,
      frameCount: n,
    };
    const meta = await writeNamed(name, part, contentHeight, { lockFeet: true });
    comboParts.push(meta);
    cursor += n;
  }
  await writeNamed('attack', combo, contentHeight, { lockFeet: true });

  const hurtFrames = damage.frames.slice(0, HURT_N);
  const deathFrames = damage.frames.slice(HURT_N);
  if (deathFrames.length < 1) throw new Error('need death frame');
  const hurtSheet = stitch(hurtFrames, damage.frameWidth, damage.frameHeight);
  const deathSheet = stitch(deathFrames, damage.frameWidth, damage.frameHeight);
  const hurtPacked = { ...damage, frames: hurtFrames, sheet: hurtSheet, frameCount: hurtFrames.length };
  const deathPacked = { ...damage, frames: deathFrames, sheet: deathSheet, frameCount: deathFrames.length };
  await writeNamed('hurt', hurtPacked, contentHeight, { lockFeet: true, frameRate: 10 });
  await writeNamed('death', deathPacked, contentHeight, { lockFeet: false, frameRate: 8 });

  const jutsuFr = 12;
  const hitIdx = 6; // 1-based frame 7 — first full gatling
  const jutsuMeta = await writeNamed('gomu-gatling', jutsu, contentHeight, {
    lockFeet: true,
    frameRate: jutsuFr,
  });
  const durationMs = Math.round((jutsu.frameCount / jutsuFr) * 1000);
  const hitDelayMs = Math.round((hitIdx / jutsuFr) * 1000);
  updateMeta(META, `${ID}-gomu-gatling`, {
    ...jutsuMeta,
    durationMs,
    hitDelayMs,
  });
  updateMeta(META, 'skill-gomu-gatling', {
    ...jutsuMeta,
    durationMs,
    hitDelayMs,
  });

  const wire = {
    contentHeight,
    idle: {
      frameWidth: idle.frameWidth,
      frameHeight: idle.frameHeight,
      frameCount: idle.frameCount,
      originX: idle.originX,
    },
    walk: {
      frameWidth: walk.frameWidth,
      frameHeight: walk.frameHeight,
      frameCount: walk.frameCount,
      originX: walk.originX,
    },
    combo: comboParts.map((p) => ({
      frameWidth: p.frameWidth,
      frameHeight: p.frameHeight,
      frameCount: p.frameCount,
      originX: p.originX,
    })),
    hurt: {
      frameWidth: damage.frameWidth,
      frameHeight: damage.frameHeight,
      frameCount: HURT_N,
      originX: damage.originX,
    },
    death: {
      frameWidth: damage.frameWidth,
      frameHeight: damage.frameHeight,
      frameCount: deathFrames.length,
      originX: damage.originX,
    },
    jutsu: {
      frameWidth: jutsu.frameWidth,
      frameHeight: jutsu.frameHeight,
      frameCount: jutsu.frameCount,
      originX: jutsu.originX,
      durationMs,
      hitDelayMs,
      frameRate: jutsuFr,
    },
  };
  console.log('PACK_WIRE', JSON.stringify(wire, null, 2));
  console.log(`preview: ${PREVIEW}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
