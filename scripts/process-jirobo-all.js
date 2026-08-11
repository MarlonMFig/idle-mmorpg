/**
 * Jirobo full pack — alpha-only transparent frames (no green/black key on body).
 *
 * walk → idle → combo (16f 6+5+5) → damage (3 hurt + 3 death) → jutsu (11f earth cast)
 * Body contentH target 48; residualGreen must be 0.
 *
 * npm run jirobo:all
 * Input:  assets/naruto-source/nu/jirobo/{idle,walk,combo,damage,jutsu}/frame_*.png
 * Output: public/sprites/player/jirobo/*
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
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
  bbox,
  isChromaGreen,
} = require('./lib/alpha-frame-pack');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'jirobo');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'jirobo');
const PREVIEW = path.join(ROOT, 'public', 'sprites', 'player', 'previews', 'jirobo.png');
const META_JSON = path.join(OUT_DIR, 'meta.json');
const QA_DIR = path.join(ROOT, 'assets-src', '_qa', 'jirobo');
const TARGET_BODY_H = 48;
const PAD = 2;

function greenness(r, g, b) {
  return g - Math.max(r, b);
}

function isResidualGreen(r, g, b) {
  if (isChromaGreen(r, g, b)) return true;
  if (greenness(r, g, b) < 18) return false;
  if (g >= 90 && r <= 85 && b <= 85 && greenness(r, g, b) >= 28) return true;
  return false;
}

function isDarkHairOrCloth(r, g, b) {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  return mx <= 55 && mx - mn <= 28;
}

function isSkin(r, g, b) {
  if (r >= 150 && g >= 100 && b >= 80 && r >= g && g >= b - 15 && r - b >= 25) return true;
  if (r >= 180 && g >= 140 && b >= 110 && r >= g - 5) return true;
  if (r >= 110 && g >= 80 && b >= 60 && r > g && g >= b - 10 && r - b >= 20) return true;
  return false;
}

function isPaleCloth(r, g, b) {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  return mx >= 160 && mx - mn <= 40 && mx <= 240;
}

function isPurpleAccent(r, g, b) {
  if (b >= 80 && b >= g - 10 && r >= 70 && r <= 180 && Math.abs(r - b) <= 40 && b >= r - 15) {
    return true;
  }
  return false;
}

function isEarthVfx(r, g, b) {
  // sandy / stone browns and dust yellows of the earth jutsu field
  if (r >= 120 && g >= 90 && b <= 90 && r >= g && g >= b && r - b >= 40 && g - b >= 15) {
    if (!isSkin(r, g, b)) return true;
  }
  if (r >= 90 && g >= 70 && b <= 70 && r >= g - 5 && g > b + 10 && r <= 200) return true;
  if (r >= 160 && g >= 140 && b <= 100 && r >= g - 10 && g > b + 30) return true;
  // pale dust
  if (r >= 180 && g >= 160 && b >= 100 && b <= 170 && r >= g - 5 && g >= b) return true;
  return false;
}

function isBodyPixel(r, g, b, { excludeEarth = false } = {}) {
  if (isResidualGreen(r, g, b)) return false;
  if (excludeEarth && isEarthVfx(r, g, b)) return false;
  if (isDarkHairOrCloth(r, g, b)) return true;
  if (isSkin(r, g, b) || isPaleCloth(r, g, b) || isPurpleAccent(r, g, b)) return true;
  if (Math.max(r, g, b) <= 28) return true;
  if (Math.max(r, g, b) - Math.min(r, g, b) < 35 && Math.max(r, g, b) <= 110) return true;
  return false;
}

function scrubFrame(frame, fw, fh) {
  const d = Buffer.from(frame);
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < ALPHA_KEEP) {
      d[i] = 0;
      d[i + 1] = 0;
      d[i + 2] = 0;
      d[i + 3] = 0;
      continue;
    }
    if (isResidualGreen(d[i], d[i + 1], d[i + 2])) {
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

function bodyAnchor(frame, w, h, { excludeEarth = false } = {}) {
  let minY = h;
  let maxY = -1;
  let feetY = -1;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      if (frame[i + 3] < ALPHA_KEEP) continue;
      const r = frame[i];
      const g = frame[i + 1];
      const b = frame[i + 2];
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (
        !isResidualGreen(r, g, b) &&
        !(excludeEarth && isEarthVfx(r, g, b)) &&
        y > feetY
      ) {
        feetY = y;
      }
    }
  }
  if (maxY < 0) {
    return { bodyCx: w / 2, feetY: h - 1, bodyH: h, mode: 'empty', n: 0 };
  }
  if (feetY < 0) feetY = maxY;

  const contentH = feetY - minY + 1;
  const bandTop = minY + Math.floor(contentH * 0.28);
  const bandBot = minY + Math.floor(contentH * 0.72);

  function massIn(pred, yLo, yHi) {
    let sumX = 0;
    let n = 0;
    for (let y = yLo; y <= yHi; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const i = (y * w + x) * 4;
        if (frame[i + 3] < ALPHA_KEEP) continue;
        if (!pred(frame[i], frame[i + 1], frame[i + 2])) continue;
        n += 1;
        sumX += x;
      }
    }
    return { sumX, n };
  }

  let mode = 'torsoBand';
  let m = massIn((r, g, b) => isBodyPixel(r, g, b, { excludeEarth }), bandTop, bandBot);
  if (m.n < 60) {
    mode = 'body';
    m = massIn((r, g, b) => isBodyPixel(r, g, b, { excludeEarth }), minY, feetY);
  }
  if (m.n < 25) {
    mode = 'full';
    m = massIn(() => true, minY, maxY);
  }

  return {
    bodyCx: m.n ? m.sumX / m.n : w / 2,
    feetY,
    bodyH: contentH,
    mode,
    n: m.n,
  };
}

function median(vals) {
  if (!vals.length) return 0;
  const s = [...vals].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function normalizeBodyLock(frames, widths, heights, {
  pad = PAD,
  excludeEarth = false,
  lockMedianCx = false,
  contentFromN = null,
} = {}) {
  const anchors = frames.map((f, i) => bodyAnchor(f, widths[i], heights[i], { excludeEarth }));
  let filled = anchors.map((a) => ({ ...a }));

  if (lockMedianCx) {
    const n = Math.min(3, filled.length);
    const lockBodyCx = median(filled.slice(0, n).map((a) => a.bodyCx));
    filled = filled.map((a) => ({ ...a, bodyCx: lockBodyCx }));
  }

  let maxLeft = 0;
  let maxRight = 0;
  let maxUp = 0;
  let maxDown = 0;
  for (let i = 0; i < frames.length; i += 1) {
    const a = filled[i];
    const w = widths[i];
    const h = heights[i];
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        if (frames[i][(y * w + x) * 4 + 3] < ALPHA_KEEP) continue;
        maxLeft = Math.max(maxLeft, a.bodyCx - x);
        maxRight = Math.max(maxRight, x - a.bodyCx);
        maxUp = Math.max(maxUp, a.feetY - y);
        maxDown = Math.max(maxDown, y - a.feetY);
      }
    }
  }

  const fw = Math.ceil(maxLeft + maxRight + 1) + pad * 2;
  const fh = Math.ceil(maxUp + maxDown + 1) + pad * 2;
  const destBodyCx = pad + Math.ceil(maxLeft);
  const destFeetY = pad + Math.ceil(maxUp);
  const take = contentFromN ?? Math.min(4, anchors.length);
  const contentH = Math.round(
    anchors.slice(0, take).reduce((s, a) => s + a.bodyH, 0) / Math.max(1, take),
  );

  const out = frames.map((frame, index) => {
    const a = filled[index];
    const srcW = widths[index];
    const srcH = heights[index];
    const canvas = Buffer.alloc(fw * fh * 4);
    const dx = Math.round(destBodyCx - a.bodyCx);
    const dy = Math.round(destFeetY - a.feetY);
    for (let y = 0; y < srcH; y += 1) {
      for (let x = 0; x < srcW; x += 1) {
        const si = (y * srcW + x) * 4;
        if (frame[si + 3] < ALPHA_KEEP) continue;
        const tx = x + dx;
        const ty = y + dy;
        if (tx < 0 || ty < 0 || tx >= fw || ty >= fh) continue;
        const di = (ty * fw + tx) * 4;
        canvas[di] = frame[si];
        canvas[di + 1] = frame[si + 1];
        canvas[di + 2] = frame[si + 2];
        canvas[di + 3] = 255;
      }
    }
    return canvas;
  });

  return {
    frames: out,
    frameWidth: fw,
    frameHeight: fh,
    contentHeight: contentH,
    anchors: filled,
    destBodyCx,
    destFeetY,
  };
}

async function scaleLocked(frames, fw, fh, absoluteScale, kernel = 'nearest') {
  const skip = Math.abs(absoluteScale - 1) < 1e-6;
  const outW = skip ? fw : Math.max(1, Math.round(fw * absoluteScale));
  const outH = skip ? fh : Math.max(1, Math.round(fh * absoluteScale));
  const out = [];
  for (const frame of frames) {
    let data;
    if (skip) {
      data = Buffer.from(frame);
    } else {
      const res = await sharp(frame, { raw: { width: fw, height: fh, channels: 4 } })
        .resize(outW, outH, {
          kernel: kernel === 'lanczos3' ? sharp.kernel.lanczos3 : sharp.kernel.nearest,
        })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      data = res.data;
    }
    out.push(scrubFrame(data, outW, outH));
  }
  return {
    frames: out,
    frameWidth: outW,
    frameHeight: outH,
    contentHeight: TARGET_BODY_H,
    scale: absoluteScale,
  };
}

function countGreen(sheetData) {
  let n = 0;
  for (let i = 0; i < sheetData.length; i += 4) {
    if (sheetData[i + 3] < ALPHA_KEEP) continue;
    if (isResidualGreen(sheetData[i], sheetData[i + 1], sheetData[i + 2])) n += 1;
  }
  return n;
}

function assertNoGreen(name, data) {
  const n = countGreen(data);
  if (n > 0) throw new Error(`QA fail ${name}: residual green = ${n}`);
  return n;
}

function writeMeta(key, entry) {
  updateMeta(META_JSON, key, entry);
}

async function processWalk() {
  const keyed = await loadAlphaFrames(path.join(SRC, 'walk'), 6);
  const beforeH = keyed.map((k) => k.box.height);
  const maxH = Math.max(...beforeH);
  const absoluteScale = TARGET_BODY_H / Math.max(1, maxH);
  console.log(`[walk] maxContentH=${maxH} scale=${absoluteScale.toFixed(4)}`);

  const norm = normalizeBodyLock(
    keyed.map((k) => k.frame),
    keyed.map((k) => k.width),
    keyed.map((k) => k.height),
  );
  const scaled = await scaleLocked(norm.frames, norm.frameWidth, norm.frameHeight, absoluteScale, 'nearest');
  const afterH = scaled.frames.map((f) => bbox(f, scaled.frameWidth, scaled.frameHeight).height);
  const sheet = stitch(scaled.frames, scaled.frameWidth, scaled.frameHeight);
  const residualGreen = assertNoGreen('walk', sheet.data);
  // No pure-#000 quota — this art pack uses dark greys for outline (not #000).

  await writePng(path.join(OUT_DIR, 'walk.png'), sheet.data, sheet.width, sheet.height);
  await writeFrameCrops(sheet, scaled, QA_DIR, 'walk', 3);
  const entry = {
    image: '/sprites/player/jirobo/walk.png',
    frameWidth: scaled.frameWidth,
    frameHeight: scaled.frameHeight,
    frameCount: scaled.frames.length,
    contentHeight: TARGET_BODY_H,
    scale: absoluteScale,
    maxContentH: maxH,
    frameRate: 10,
    residualGreen,
    contentHeights: afterH,
    bodyLock: { destBodyCx: norm.destBodyCx, destFeetY: norm.destFeetY },
    source: 'assets/naruto-source/nu/jirobo/walk/frame_*.png',
    note: '6f walk; alpha-only; body-lock; nearest max→48',
  };
  writeMeta('jirobo-walk', entry);
  console.log(`-> walk.png fw=${entry.frameWidth} fh=${entry.frameHeight} residualGreen=${residualGreen}`);
  return entry;
}

async function processIdle(walkScale) {
  const keyed = await loadAlphaFrames(path.join(SRC, 'idle'), 6);
  const absoluteScale = walkScale;
  const norm = normalizeBodyLock(
    keyed.map((k) => k.frame),
    keyed.map((k) => k.width),
    keyed.map((k) => k.height),
  );
  const scaled = await scaleLocked(norm.frames, norm.frameWidth, norm.frameHeight, absoluteScale, 'nearest');
  const afterH = scaled.frames.map((f) => bbox(f, scaled.frameWidth, scaled.frameHeight).height);
  const sheet = stitch(scaled.frames, scaled.frameWidth, scaled.frameHeight);
  const residualGreen = assertNoGreen('idle', sheet.data);

  await writePng(path.join(OUT_DIR, 'idle.png'), sheet.data, sheet.width, sheet.height);
  fs.mkdirSync(path.dirname(PREVIEW), { recursive: true });
  await writePng(PREVIEW, scaled.frames[0], scaled.frameWidth, scaled.frameHeight);
  await writeFrameCrops(sheet, scaled, QA_DIR, 'idle', 3);

  const entry = {
    image: '/sprites/player/jirobo/idle.png',
    frameWidth: scaled.frameWidth,
    frameHeight: scaled.frameHeight,
    frameCount: scaled.frames.length,
    contentHeight: TARGET_BODY_H,
    scale: absoluteScale,
    frameRate: 7,
    residualGreen,
    contentHeights: afterH,
    bodyLock: { destBodyCx: norm.destBodyCx, destFeetY: norm.destFeetY },
    source: 'assets/naruto-source/nu/jirobo/idle/frame_*.png',
    note: '6f idle; alpha-only; walk-matched scale; body-lock',
  };
  writeMeta('jirobo-idle', entry);
  console.log(`-> idle.png fw=${entry.frameWidth} fh=${entry.frameHeight} residualGreen=${residualGreen}`);
  return entry;
}

async function processCombo(walkScale) {
  const keyed = await loadAlphaFrames(path.join(SRC, 'combo'), 16);
  const SLICES = [
    { name: 'combo1', from: 0, to: 6, note: 'prep + strikes' },
    { name: 'combo2', from: 6, to: 11, note: 'mid combo' },
    { name: 'combo3', from: 11, to: 16, note: 'finisher' },
  ];
  const norm = normalizeBodyLock(
    keyed.map((k) => k.frame),
    keyed.map((k) => k.width),
    keyed.map((k) => k.height),
    { lockMedianCx: true, contentFromN: 4 },
  );
  const projected = norm.contentHeight * walkScale;
  let absoluteScale = walkScale;
  let scaleSource = 'walk-matched';
  if (Math.abs(projected - TARGET_BODY_H) > 2) {
    absoluteScale = TARGET_BODY_H / Math.max(1, norm.contentHeight);
    scaleSource = 'body-match-lanczos3→48';
  }
  console.log(`[combo] standingH=${norm.contentHeight} scale=${absoluteScale.toFixed(4)} (${scaleSource})`);

  const scaled = await scaleLocked(
    norm.frames,
    norm.frameWidth,
    norm.frameHeight,
    absoluteScale,
    'lanczos3',
  );
  const afterH = scaled.frames.map((f) => bbox(f, scaled.frameWidth, scaled.frameHeight).height);
  const fullSheet = stitch(scaled.frames, scaled.frameWidth, scaled.frameHeight);
  const residualGreen = assertNoGreen('combo', fullSheet.data);
  await writePng(path.join(OUT_DIR, 'attack.png'), fullSheet.data, fullSheet.width, fullSheet.height);
  await writeFrameCrops(fullSheet, scaled, QA_DIR, 'combo', 3);

  const wire = {};
  for (const slice of SLICES) {
    const frames = scaled.frames.slice(slice.from, slice.to);
    const contentHeights = afterH.slice(slice.from, slice.to);
    const sheet = stitch(frames, scaled.frameWidth, scaled.frameHeight);
    assertNoGreen(slice.name, sheet.data);
    await writePng(path.join(OUT_DIR, `${slice.name}.png`), sheet.data, sheet.width, sheet.height);
    const entry = {
      image: `/sprites/player/jirobo/${slice.name}.png`,
      frameWidth: scaled.frameWidth,
      frameHeight: scaled.frameHeight,
      frameCount: frames.length,
      contentHeight: TARGET_BODY_H,
      scale: absoluteScale,
      frameRate: 12,
      residualGreen: 0,
      range: [slice.from, slice.to],
      contentHeights,
      source: 'assets/naruto-source/nu/jirobo/combo/frame_001..016.png',
      note: `${slice.note} (${frames.length}f); alpha-only; body-lock; lanczos3→48`,
    };
    writeMeta(`jirobo-${slice.name}`, entry);
    wire[slice.name] = {
      frameWidth: entry.frameWidth,
      frameHeight: entry.frameHeight,
      frameCount: entry.frameCount,
      contentHeight: entry.contentHeight,
    };
    console.log(`-> ${slice.name}.png n=${frames.length}`);
  }

  writeMeta('jirobo-attack', {
    image: '/sprites/player/jirobo/attack.png',
    frameWidth: scaled.frameWidth,
    frameHeight: scaled.frameHeight,
    frameCount: scaled.frames.length,
    contentHeight: TARGET_BODY_H,
    scale: absoluteScale,
    residualGreen,
    contentHeights: afterH,
    phaseSplit: SLICES.map((s) => s.to - s.from),
    absoluteScaleSource: scaleSource,
    note: '16f combo 6+5+5',
  });
  console.log(`-> attack.png residualGreen=${residualGreen}`);
  return wire;
}

async function processDamage() {
  const keyed = await loadAlphaFrames(path.join(SRC, 'damage'), 6);
  const HURT_N = 3;
  const DEATH_N = 3;
  const norm = normalize(
    keyed.map((k) => k.frame),
    keyed.map((k) => k.width),
    keyed.map((k) => k.height),
    { contentFromN: HURT_N },
  );
  const scaled = await scaleFrames(
    norm.frames,
    norm.frameWidth,
    norm.frameHeight,
    norm.contentHeight,
    TARGET_BODY_H,
  );
  // scrub residual green after nearest scale
  scaled.frames = scaled.frames.map((f) => scrubFrame(f, scaled.frameWidth, scaled.frameHeight));

  async function writeSlice(name, frames, frameRate, note) {
    const sheet = stitch(frames, scaled.frameWidth, scaled.frameHeight);
    const residualGreen = assertNoGreen(name, sheet.data);
    await writePng(path.join(OUT_DIR, `${name}.png`), sheet.data, sheet.width, sheet.height);
    await writeFrameCrops(sheet, { ...scaled, frames }, QA_DIR, name, 3);
    const entry = {
      image: `/sprites/player/jirobo/${name}.png`,
      frameWidth: scaled.frameWidth,
      frameHeight: scaled.frameHeight,
      frameCount: frames.length,
      contentHeight: scaled.contentHeight,
      scale: scaled.scale,
      frameRate,
      residualGreen,
      source: 'assets/naruto-source/nu/jirobo/damage/frame_001..006.png',
      note,
    };
    writeMeta(`jirobo-${name}`, entry);
    console.log(`-> ${name}.png n=${frames.length} residualGreen=${residualGreen}`);
    return entry;
  }

  const hurt = await writeSlice(
    'hurt',
    scaled.frames.slice(0, HURT_N),
    9,
    'frames 1–3 hit reaction',
  );
  const death = await writeSlice(
    'death',
    scaled.frames.slice(HURT_N, HURT_N + DEATH_N),
    8,
    'frames 4–6 death collapse',
  );
  return { hurt, death };
}

async function processJutsu(walkScale) {
  const keyed = await loadAlphaFrames(path.join(SRC, 'jutsu'), null);
  const FRAME_RATE = 12;
  // Standing body from late recovery frames (f10–11) when earth VFX recedes.
  const recoverStart = Math.max(0, keyed.length - 2);
  const standingRaw = keyed.slice(recoverStart);
  const standAnchors = standingRaw.map((k) =>
    bodyAnchor(k.frame, k.width, k.height, { excludeEarth: true }),
  );
  let standingH = Math.max(...standAnchors.map((a) => a.bodyH), 1);
  // Fallback: early frames if recovery too small
  if (standingH < 40) {
    standingH = median(
      keyed
        .slice(0, 3)
        .map((k) => bodyAnchor(k.frame, k.width, k.height, { excludeEarth: true }).bodyH),
    );
  }

  const norm = normalizeBodyLock(
    keyed.map((k) => k.frame),
    keyed.map((k) => k.width),
    keyed.map((k) => k.height),
    { excludeEarth: true, lockMedianCx: true, contentFromN: standingRaw.length },
  );
  // Override contentH with body standing (not full VFX height).
  const contentH = standingH;
  const projected = contentH * walkScale;
  let absoluteScale = walkScale;
  let scaleSource = 'walk-matched';
  if (Math.abs(projected - TARGET_BODY_H) > 8) {
    absoluteScale = TARGET_BODY_H / Math.max(1, contentH);
    scaleSource = 'body-match-lanczos3→48';
  }
  console.log(
    `[jutsu] n=${keyed.length} standingBodyH=${contentH} scale=${absoluteScale.toFixed(4)} (${scaleSource}) packCell=${norm.frameWidth}x${norm.frameHeight}`,
  );

  const scrubbed = norm.frames.map((f) => scrubFrame(f, norm.frameWidth, norm.frameHeight));
  const scaled = await scaleLocked(
    scrubbed,
    norm.frameWidth,
    norm.frameHeight,
    absoluteScale,
    'lanczos3',
  );
  const cleaned = scaled.frames.map((f) => scrubFrame(f, scaled.frameWidth, scaled.frameHeight));
  const sheet = stitch(cleaned, scaled.frameWidth, scaled.frameHeight);
  const residualGreen = assertNoGreen('jutsu', sheet.data);

  // Peak opaque ≈ earth held overhead — NOT the throw. Rock leaves body when
  // upper brown mass collapses (~frame 10 / 11).
  let peakIdx = cleaned.length - 1;
  let peakMass = -1;
  for (let i = 0; i < cleaned.length; i += 1) {
    let m = 0;
    for (let j = 3; j < cleaned[i].length; j += 4) {
      if (cleaned[i][j] >= ALPHA_KEEP) m += 1;
    }
    if (m >= peakMass) {
      peakMass = m;
      peakIdx = i;
    }
  }
  // Throw release: first frame after peak that shrank ≥35% (rock left hands).
  let releaseIdx = Math.min(cleaned.length - 1, peakIdx + 1);
  for (let i = peakIdx + 1; i < cleaned.length; i += 1) {
    let m = 0;
    for (let j = 3; j < cleaned[i].length; j += 4) {
      if (cleaned[i][j] >= ALPHA_KEEP) m += 1;
    }
    if (m <= peakMass * 0.65) {
      releaseIdx = i;
      break;
    }
  }
  const TRAVEL_MS = 170;
  const durationMs = Math.round((cleaned.length / FRAME_RATE) * 1000);
  const fxReleaseMs = Math.round((releaseIdx / FRAME_RATE) * 1000);
  const hitDelayMs = Math.min(
    durationMs + 80,
    fxReleaseMs + TRAVEL_MS,
  );

  await writePng(path.join(OUT_DIR, 'doryuheki.png'), sheet.data, sheet.width, sheet.height);
  await writeFrameCrops(sheet, { ...scaled, frames: cleaned }, QA_DIR, 'doryuheki', 3);

  const entry = {
    image: '/sprites/player/jirobo/doryuheki.png',
    frameWidth: scaled.frameWidth,
    frameHeight: scaled.frameHeight,
    frameCount: cleaned.length,
    contentHeight: TARGET_BODY_H,
    scale: absoluteScale,
    frameRate: FRAME_RATE,
    residualGreen,
    durationMs,
    hitDelayMs,
    fxReleaseMs,
    peakFrame: peakIdx + 1,
    releaseFrame: releaseIdx + 1,
    source: 'assets/naruto-source/nu/jirobo/jutsu/frame_*.png',
    bodyLock: { destBodyCx: norm.destBodyCx, destFeetY: norm.destFeetY },
    absoluteScaleSource: scaleSource,
    standingBodyH: contentH,
    note: `Doton Doryūheki ${cleaned.length}f; release f${releaseIdx + 1} @ ${fxReleaseMs}ms; hit ${hitDelayMs}ms`,
  };
  writeMeta('jirobo-doryuheki', entry);
  writeMeta('skill-doryuheki', {
    ...entry,
    note: 'skill-doryuheki — Doton: Doryūheki (earth wall cast)',
  });
  console.log(
    `-> doryuheki.png fw=${entry.frameWidth} fh=${entry.frameHeight} n=${entry.frameCount} residualGreen=${residualGreen} release=${fxReleaseMs}ms hitDelay=${hitDelayMs}ms`,
  );
  return entry;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(QA_DIR, { recursive: true });

  const walk = await processWalk();
  const idle = await processIdle(walk.scale);
  const combo = await processCombo(walk.scale);
  const dmg = await processDamage();
  const jutsu = await processJutsu(walk.scale);

  console.log(
    'PACK_WIRE',
    JSON.stringify(
      {
        walk: {
          frameWidth: walk.frameWidth,
          frameHeight: walk.frameHeight,
          frameCount: walk.frameCount,
          contentHeight: walk.contentHeight,
        },
        idle: {
          frameWidth: idle.frameWidth,
          frameHeight: idle.frameHeight,
          frameCount: idle.frameCount,
          contentHeight: idle.contentHeight,
        },
        combo,
        hurt: {
          frameWidth: dmg.hurt.frameWidth,
          frameHeight: dmg.hurt.frameHeight,
          frameCount: dmg.hurt.frameCount,
        },
        death: {
          frameWidth: dmg.death.frameWidth,
          frameHeight: dmg.death.frameHeight,
          frameCount: dmg.death.frameCount,
        },
        jutsu: {
          frameWidth: jutsu.frameWidth,
          frameHeight: jutsu.frameHeight,
          frameCount: jutsu.frameCount,
          contentHeight: jutsu.contentHeight,
          durationMs: jutsu.durationMs,
          hitDelayMs: jutsu.hitDelayMs,
          fxReleaseMs: jutsu.fxReleaseMs,
          releaseFrame: jutsu.releaseFrame,
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
