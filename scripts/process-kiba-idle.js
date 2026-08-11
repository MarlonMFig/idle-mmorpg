/**
 * Kiba Inuzuka — idle test pack (soft downscale, preserve clean alpha).
 *
 * Sources are already transparent PNG sequences (no chroma, no black-key).
 * Process:
 *   1) tight content bbox (a > KEEP)
 *   2) floor-align into shared cell + pad
 *   3) global scale so body H ≈ TARGET (lanczos3 — not nearest)
 *   4) preserve premultiplied-clean RGB/A (mid-alpha kept for soft edges if present)
 *
 * npm run kiba:idle
 * Input:  assets/naruto-source/nu/kiba/idle-source/frame_*.png
 * Output: public/sprites/player/kiba/idle.png + meta + QA previews
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'kiba', 'idle-source');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'kiba');
const PREVIEW = path.join(ROOT, 'public', 'sprites', 'player', 'previews', 'kiba.png');
const META_JSON = path.join(OUT_DIR, 'meta.json');
const QA_DIR = path.join(ROOT, 'assets-src', '_qa', 'kiba');
const EXPECTED = 6;
const TARGET_BODY_H = 48;
const PAD = 4;
/** Treat as solid content / bbox. */
const A_CONTENT = 12;
/** Zero only pure empty; keep soft AA. */
const A_EMPTY = 1;

function listFrames(dir) {
  return fs
    .readdirSync(dir)
    .filter((f) => /^frame_\d+\.png$/i.test(f))
    .sort((a, b) => {
      const na = parseInt(a.match(/\d+/)[0], 10);
      const nb = parseInt(b.match(/\d+/)[0], 10);
      return na - nb;
    })
    .map((f) => path.join(dir, f));
}

function bbox(data, w, h, aMin = A_CONTENT) {
  let minX = w;
  let maxX = -1;
  let minY = h;
  let maxY = -1;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (data[(y * w + x) * 4 + 3] < aMin) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 1, height: 1 };
  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

function crop(data, w, box) {
  const out = Buffer.alloc(box.width * box.height * 4);
  for (let y = 0; y < box.height; y += 1) {
    for (let x = 0; x < box.width; x += 1) {
      const si = ((box.minY + y) * w + (box.minX + x)) * 4;
      const di = (y * box.width + x) * 4;
      data.copy(out, di, si, si + 4);
    }
  }
  return out;
}

/** Remove only pure chroma green; never strip black outlines/hair. */
function scrubGreenOnly(data) {
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < A_EMPTY) {
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = 0;
      continue;
    }
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (g >= 100 && g >= r + 45 && g >= b + 45 && r <= 80 && b <= 80) {
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = 0;
      n += 1;
    }
  }
  return n;
}

/**
 * Clear near-black *exterior* only: BFS from edges through near-black/transparent.
 * Keeps pure-black interior (hair/outline/eyes) that is not connected to edge.
 */
function clearExteriorNearBlack(data, w, h) {
  const N = w * h;
  const seen = new Uint8Array(N);
  const q = [];
  const isExteriorSeed = (i) => {
    const a = data[i * 4 + 3];
    if (a < A_CONTENT) return true;
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    // near-black fringe / noise only — not dense black outline (handled by flood connectivity)
    return a > 0 && r <= 18 && g <= 18 && b <= 22 && r + g + b <= 40;
  };

  for (let x = 0; x < w; x += 1) {
    q.push(x);
    q.push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y += 1) {
    q.push(y * w);
    q.push(y * w + (w - 1));
  }

  let cleared = 0;
  while (q.length) {
    const idx = q.pop();
    if (idx < 0 || idx >= N || seen[idx]) continue;
    seen[idx] = 1;
    if (!isExteriorSeed(idx) && data[idx * 4 + 3] >= A_CONTENT) continue;
    // Clear only transparent-ish or seed near-black exterior
    if (data[idx * 4 + 3] < A_CONTENT || isExteriorSeed(idx)) {
      if (data[idx * 4 + 3] > 0 || data[idx * 4] || data[idx * 4 + 1] || data[idx * 4 + 2]) {
        cleared += 1;
      }
      data[idx * 4] = 0;
      data[idx * 4 + 1] = 0;
      data[idx * 4 + 2] = 0;
      data[idx * 4 + 3] = 0;
    } else {
      continue;
    }
    const x = idx % w;
    const y = (idx / w) | 0;
    if (x > 0) q.push(idx - 1);
    if (x < w - 1) q.push(idx + 1);
    if (y > 0) q.push(idx - w);
    if (y < h - 1) q.push(idx + w);
  }
  return cleared;
}

async function loadRgba(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: Buffer.from(data), width: info.width, height: info.height };
}

async function scaleLanczos(src, sw, sh, scale) {
  const dw = Math.max(1, Math.round(sw * scale));
  const dh = Math.max(1, Math.round(sh * scale));
  const { data, info } = await sharp(src, {
    raw: { width: sw, height: sh, channels: 4 },
  })
    .resize(dw, dh, {
      kernel: sharp.kernel.lanczos3,
      fit: 'fill',
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data: Buffer.from(data), width: info.width, height: info.height };
}

function placeFloor(src, sw, sh, fw, fh) {
  const out = Buffer.alloc(fw * fh * 4);
  const ox = Math.floor((fw - sw) / 2);
  const oy = fh - sh - PAD;
  for (let y = 0; y < sh; y += 1) {
    for (let x = 0; x < sw; x += 1) {
      const si = (y * sw + x) * 4;
      if (src[si + 3] < A_EMPTY) continue;
      const dx = x + ox;
      const dy = y + oy;
      if (dx < 0 || dy < 0 || dx >= fw || dy >= fh) continue;
      src.copy(out, (dy * fw + dx) * 4, si, si + 4);
    }
  }
  // Pad ring must stay pure transparent (lanczos soft fringes spill into corners).
  clearPadRing(out, fw, fh, PAD);
  return out;
}

/** Zero the pad ring so cell corners never hold residual alpha. */
function clearPadRing(data, fw, fh, pad) {
  for (let y = 0; y < fh; y += 1) {
    for (let x = 0; x < fw; x += 1) {
      if (x >= pad && x < fw - pad && y >= pad && y < fh - pad) continue;
      const i = (y * fw + x) * 4;
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = 0;
    }
  }
}

/**
 * Soften only sub-threshold dust outside the solid silhouette without
 * hard-pixelizing. Does not force a→255 on mid-alpha AA on body edges.
 */
function tidyDust(data) {
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 0 && data[i + 3] < A_CONTENT) {
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = 0;
    }
  }
}

function stitch(frames, fw, fh) {
  const sheetW = fw * frames.length;
  const sheet = Buffer.alloc(sheetW * fh * 4);
  frames.forEach((frame, index) => {
    for (let y = 0; y < fh; y += 1) {
      frame.copy(sheet, (y * sheetW + index * fw) * 4, y * fw * 4, (y + 1) * fw * 4);
    }
  });
  return { data: sheet, width: sheetW, height: fh };
}

function countOpaque(data) {
  let n = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] >= A_CONTENT) n += 1;
  return n;
}

function countGreen(data) {
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < A_CONTENT) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (g >= 100 && g >= r + 45 && g >= b + 45 && r <= 80 && b <= 80) n += 1;
  }
  return n;
}

function cornerMeanAlpha(data, w, h, size = 4) {
  const sample = (x0, y0) => {
    let s = 0;
    let c = 0;
    for (let y = y0; y < y0 + size; y += 1) {
      for (let x = x0; x < x0 + size; x += 1) {
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        s += data[(y * w + x) * 4 + 3];
        c += 1;
      }
    }
    return c ? s / c : 0;
  };
  return {
    tl: sample(0, 0),
    tr: sample(w - size, 0),
    bl: sample(0, h - size),
    br: sample(w - size, h - size),
  };
}

async function writePng(file, data, w, h) {
  await sharp(data, { raw: { width: w, height: h, channels: 4 } }).png().toFile(file);
}

function updateMeta(pathJson, key, entry) {
  let meta = {};
  if (fs.existsSync(pathJson)) {
    meta = JSON.parse(fs.readFileSync(pathJson, 'utf8'));
  }
  meta[key] = entry;
  fs.mkdirSync(path.dirname(pathJson), { recursive: true });
  fs.writeFileSync(pathJson, `${JSON.stringify(meta, null, 2)}\n`);
}

async function qaAssert(frames, fw, fh) {
  const issues = [];
  for (let i = 0; i < frames.length; i += 1) {
    const f = frames[i];
    const op = countOpaque(f);
    if (op < 80) issues.push(`f${i + 1}: too empty (${op}px)`);
    const green = countGreen(f);
    if (green > 0) issues.push(`f${i + 1}: residual green=${green}`);
    const corners = cornerMeanAlpha(f, fw, fh, 3);
    for (const [k, v] of Object.entries(corners)) {
      if (v > 0.5) issues.push(`f${i + 1}: corner ${k} alpha mean=${v.toFixed(1)}`);
    }
    const box = bbox(f, fw, fh, A_CONTENT);
    // Feet should sit just above bottom pad
    if (box.maxY > fh - PAD - 1 || box.maxY < fh - PAD - 4) {
      // allow soft resample sitting 0–3px into pad region removed — so feet on last content row
      if (box.maxY < fh - PAD - 6) {
        issues.push(`f${i + 1}: feet float (maxY=${box.maxY} fh=${fh} pad=${PAD})`);
      }
    }
    if (box.height < TARGET_BODY_H * 0.7) {
      issues.push(`f${i + 1}: content too short (${box.height}px)`);
    }
    // No full-canvas solid fill
    if (box.width >= fw - 1 && box.height >= fh - 1) {
      issues.push(`f${i + 1}: bbox fills entire cell (possible bg leak)`);
    }
  }
  return issues;
}

async function main() {
  const files = listFrames(SRC_DIR);
  if (files.length !== EXPECTED) {
    throw new Error(`Expected ${EXPECTED} frames in ${SRC_DIR}, got ${files.length}`);
  }
  console.log(`loaded ${files.length} frames from ${SRC_DIR}`);

  const loaded = [];
  for (const file of files) {
    const img = await loadRgba(file);
    const green = scrubGreenOnly(img.data);
    const cleared = clearExteriorNearBlack(img.data, img.width, img.height);
    const box = bbox(img.data, img.width, img.height, A_CONTENT);
    const cropped = crop(img.data, img.width, box);
    loaded.push({
      file: path.basename(file),
      data: cropped,
      width: box.width,
      height: box.height,
      green,
      cleared,
      box,
    });
    console.log(
      `  ${path.basename(file)} bbox=${box.width}x${box.height} green=${green} extBlack=${cleared}`,
    );
  }

  const maxH = Math.max(...loaded.map((f) => f.height));
  const scale = TARGET_BODY_H / maxH;
  console.log(`scale=${scale.toFixed(6)} (lanczos3) maxSrcH=${maxH} → ${TARGET_BODY_H}`);

  const scaled = [];
  for (const f of loaded) {
    const s = await scaleLanczos(f.data, f.width, f.height, scale);
    scaled.push(s);
  }

  const fw = Math.max(...scaled.map((s) => s.width)) + PAD * 2;
  const fh = Math.max(...scaled.map((s) => s.height)) + PAD * 2;
  const frames = scaled.map((s) => {
    // Soft dust only (never force solid pixel edges on AA)
    tidyDust(s.data);
    return placeFloor(s.data, s.width, s.height, fw, fh);
  });

  // Re-assert feet: after pad clear, content maxY should be fh-PAD-1
  for (let i = 0; i < frames.length; i += 1) {
    tidyDust(frames[i]);
  }

  const issues = await qaAssert(frames, fw, fh);
  if (issues.length) {
    console.error('QA FAIL:\n' + issues.map((x) => `  - ${x}`).join('\n'));
    // Still write QA dumps for debug
    fs.mkdirSync(QA_DIR, { recursive: true });
    for (let i = 0; i < frames.length; i += 1) {
      await writePng(path.join(QA_DIR, `fail-frame-${i}.png`), frames[i], fw, fh);
    }
    process.exit(1);
  }

  const sheet = stitch(frames, fw, fh);
  const residualGreen = countGreen(sheet.data);
  if (residualGreen > 0) throw new Error(`sheet residualGreen=${residualGreen}`);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(QA_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(PREVIEW), { recursive: true });

  await writePng(path.join(OUT_DIR, 'idle.png'), sheet.data, sheet.width, sheet.height);
  // Also as walk for lateral pack smoke (idle-only test)
  await writePng(path.join(OUT_DIR, 'walk.png'), sheet.data, sheet.width, sheet.height);
  await writePng(PREVIEW, frames[0], fw, fh);

  // Mag per-frame QA (3× lanczos for inspection — soft, not forced blocky)
  for (let i = 0; i < frames.length; i += 1) {
    await sharp(frames[i], { raw: { width: fw, height: fh, channels: 4 } })
      .resize(fw * 3, fh * 3, { kernel: sharp.kernel.lanczos3 })
      .png()
      .toFile(path.join(QA_DIR, `idle-frame-${i}-x3.png`));
  }
  await sharp(sheet.data, { raw: { width: sheet.width, height: sheet.height, channels: 4 } })
    .png()
    .toFile(path.join(QA_DIR, 'idle-full.png'));
  // Magenta check for residual BG
  const mag = Buffer.alloc(sheet.data.length);
  for (let i = 0; i < sheet.data.length; i += 4) {
    if (sheet.data[i + 3] < A_CONTENT) {
      mag[i] = 255;
      mag[i + 1] = 0;
      mag[i + 2] = 255;
      mag[i + 3] = 255;
    } else {
      mag[i] = sheet.data[i];
      mag[i + 1] = sheet.data[i + 1];
      mag[i + 2] = sheet.data[i + 2];
      mag[i + 3] = 255;
    }
  }
  await writePng(path.join(QA_DIR, 'idle-magenta-bg.png'), mag, sheet.width, sheet.height);

  const entry = {
    image: '/sprites/player/kiba/idle.png',
    frameWidth: fw,
    frameHeight: fh,
    frameCount: frames.length,
    contentHeight: TARGET_BODY_H,
    scale,
    scaleKernel: 'lanczos3',
    residualGreen: 0,
    source: 'assets/naruto-source/nu/kiba/idle-source (png-sequence.zip)',
    note: 'soft downscale; no nearest-force pixelate; alpha preserved',
  };
  updateMeta(META_JSON, 'kiba-idle', entry);
  updateMeta(META_JSON, 'kiba-walk', { ...entry, image: '/sprites/player/kiba/walk.png' });

  console.log('QA OK — no issues');
  console.log('PACK_WIRE', JSON.stringify(entry, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
