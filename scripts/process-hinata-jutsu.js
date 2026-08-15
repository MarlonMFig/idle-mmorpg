/**
 * Hinata jutsu strip (single primary skill).
 *
 * Source: assets/naruto-source/nu/hinata/jutsu-new/frame_*.png
 *   Already pre-cut clean sprites (true alpha transparency). NO chroma.
 * Output: public/sprites/player/hinata/hakke-shou.png
 *   seals / stance → Gentle Fist dash-flurry → tall cream impact VFX
 *
 * Pipeline: preserve source alpha + RGB exactly → bbox content islands →
 *   floor-align normalize → scale body contentH → ~48 → pack strip.
 *
 * NEVER black-key / green-key / peel fringe: dark hair is pure #000 and
 * jacket greys look soft — flood black key was eating head + punching holes.
 *
 * npm run hinata:jutsu
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { resolveHqScale, resolvePackContentHeight, NATIVE_PIXELS } = require('./lib/strip-hq-scale');

const ROOT = path.resolve(__dirname, '..');
const JUTSU_INPUT = path.join(
  ROOT,
  'assets',
  'naruto-source',
  'nu',
  'hinata',
  'jutsu-new',
);
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'hinata');
const META_JSON = path.join(OUT_DIR, 'meta.json');
const QA_DIR = path.join(ROOT, 'assets-src', '_qa', 'hinata');
const FRAME_RATE = 12;
/** Retired assets removed after successful process. */
const RETIRED_SPRITES = ['twin-lion.png'];

/** Yellow / cream impact VFX (used only for body-height heuristic). */
function isYellowEnergy(r, g, b) {
  if (r >= 135 && g >= 115 && b <= 115 && r >= b + 25 && g >= b + 12) return true;
  if (r >= 155 && g >= 140 && b <= 130 && Math.min(r, g) > b + 12) return true;
  if (r >= 140 && g >= 110 && b >= 70 && b <= 150 && r >= b + 20 && g >= b + 5 && r >= 120) {
    return true;
  }
  if (r >= 110 && g >= 85 && b >= 45 && b <= 140 && r >= b + 15 && g >= b && r >= g - 8) {
    return true;
  }
  if (r >= 90 && g >= 120 && b <= 85 && r >= b + 25 && g >= b + 40 && r >= 55) {
    return true;
  }
  if (r >= 170 && g >= 145 && b >= 90 && b <= 175 && r >= b && g >= b - 5) return true;
  return false;
}

/** Purple / amethyst spark VFX — skip for body bbox height. */
function isPurpleEnergy(r, g, b) {
  if (isYellowEnergy(r, g, b)) return false;
  if (r >= 90 && b >= 110 && g <= 130 && b >= g + 8 && r >= g - 5) return true;
  if (r >= 70 && b >= 95 && g <= 95 && Math.max(r, b) > g + 18) return true;
  if (r >= 110 && b >= 130 && g <= 110 && r > g && b > g) return true;
  return false;
}

/** Residual pure chroma green (sources should have none). */
function isChromaGreen(r, g, b) {
  if (isYellowEnergy(r, g, b)) return false;
  const gn = g - Math.max(r, b);
  if (g >= 28 && gn >= 12 && r <= 100 && b <= 95) return true;
  if (g >= 38 && gn >= 14 && r <= 95 && b <= 90) return true;
  if (g >= 50 && gn >= 18 && r <= 115 && b <= 105) return true;
  if (g >= 70 && g >= r + 28 && g >= b + 28 && r <= 110 && b <= 105) return true;
  return false;
}

/**
 * Pass-through: frames already have correct alpha. Do not key black/green.
 * Opaque pure black pixels ARE hair and must stay.
 */
function keyFrame(data) {
  return Buffer.from(data);
}

function bbox(frame, w, h) {
  let minX = w;
  let maxX = -1;
  let minY = h;
  let maxY = -1;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (frame[(y * w + x) * 4 + 3] < 16) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 1, height: 1 };
  }
  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

/** Standing body height — ignores cream/yellow impact VFX. */
function bodyContentHeight(frame, w, h, box) {
  let minY = h;
  let maxY = -1;
  for (let y = box.minY; y <= box.maxY; y += 1) {
    for (let x = box.minX; x <= box.maxX; x += 1) {
      const i = (y * w + x) * 4;
      if (frame[i + 3] < 16) continue;
      const r = frame[i];
      const g = frame[i + 1];
      const b = frame[i + 2];
      if (isYellowEnergy(r, g, b) || isPurpleEnergy(r, g, b)) continue;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxY < 0) return box.height;
  return Math.max(1, maxY - minY + 1);
}

function skinJackCount(frame, w, h) {
  let skin = 0;
  let jack = 0;
  for (let i = 0; i < w * h; i += 1) {
    const si = i * 4;
    if (frame[si + 3] < 16) continue;
    const r = frame[si];
    const g = frame[si + 1];
    const b = frame[si + 2];
    if (isYellowEnergy(r, g, b) || isPurpleEnergy(r, g, b)) continue;
    if (r >= 150 && g >= 95 && b >= 65 && r > b + 25) skin += 1;
    // lavender / light grey jacket
    if (r >= 85 && r <= 200 && Math.abs(r - g) < 40 && b >= 95 && b <= 200) jack += 1;
  }
  return skin + jack;
}

/** Bottom-align feet on shared ground (source frames share bottom baseline). */
function normalize(frames, widths, heights) {
  const boxes = frames.map((frame, i) => bbox(frame, widths[i], heights[i]));
  const pad = 2;
  const fw = Math.max(...boxes.map((b) => b.width)) + pad * 2;
  const fh = Math.max(...boxes.map((b) => b.height)) + pad * 2;

  const out = frames.map((frame, index) => {
    const box = boxes[index];
    const srcW = widths[index];
    const canvas = Buffer.alloc(fw * fh * 4);
    const destX = Math.floor((fw - box.width) / 2);
    const destY = fh - box.height - pad;
    for (let y = 0; y < box.height; y += 1) {
      for (let x = 0; x < box.width; x += 1) {
        const si = ((box.minY + y) * srcW + (box.minX + x)) * 4;
        const di = ((destY + y) * fw + destX + x) * 4;
        canvas[di] = frame[si];
        canvas[di + 1] = frame[si + 1];
        canvas[di + 2] = frame[si + 2];
        canvas[di + 3] = frame[si + 3];
      }
    }
    return canvas;
  });

  const bodyHeights = [];
  for (let i = 0; i < frames.length; i += 1) {
    const sj = skinJackCount(frames[i], widths[i], heights[i]);
    if (sj < 80) continue;
    const bh = bodyContentHeight(frames[i], widths[i], heights[i], boxes[i]);
    if (bh > 0 && bh < 160) bodyHeights.push(bh);
  }
  bodyHeights.sort((a, b) => a - b);
  const mid = bodyHeights[Math.floor(bodyHeights.length / 2)] || boxes[0].height;

  return {
    frames: out,
    frameWidth: fw,
    frameHeight: fh,
    contentHeight: mid,
  };
}

async function scaleFrames(frames, fw, fh, contentHeight) {
  const scale = resolveHqScale(contentHeight, { mode: 'match', metaPath: META_JSON, idleKey: 'hinata-idle' });
  const outW = Math.max(1, Math.round(fw * scale));
  const outH = Math.max(1, Math.round(fh * scale));
  const outContent = resolvePackContentHeight(contentHeight, scale, { mode: 'match', metaPath: META_JSON, idleKey: 'hinata-idle' });
  const out = [];
  for (const frame of frames) {
    const { data } = await sharp(frame, {
      raw: { width: fw, height: fh, channels: 4 },
    })
      .resize(outW, outH, { kernel: sharp.kernel.nearest })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    out.push(data);
  }
  return {
    frames: out,
    frameWidth: outW,
    frameHeight: outH,
    contentHeight: outContent,
    scale,
  };
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

/**
 * QA: residual green only.
 * Do NOT treat pure black silhouette / hair as "exterior residual" —
 * hair is legitimately pure #000 and edge-adjacent to transparency.
 */
function residualMetrics(sheetData, sheetW, fh, fw, n) {
  let residualGreen = 0;
  let opaque = 0;
  let pureBlackHair = 0;
  for (let f = 0; f < n; f += 1) {
    let pix = 0;
    for (let y = 0; y < fh; y += 1) {
      for (let x = 0; x < fw; x += 1) {
        const i = (y * sheetW + f * fw + x) * 4;
        if (sheetData[i + 3] < 16) continue;
        opaque += 1;
        pix += 1;
        const r = sheetData[i];
        const g = sheetData[i + 1];
        const b = sheetData[i + 2];
        if (isChromaGreen(r, g, b)) residualGreen += 1;
        if (r <= 16 && g <= 16 && b <= 16) pureBlackHair += 1;
      }
    }
    if (pix < 8) throw new Error(`Frame ${f} too empty (${pix}px)`);
  }
  return { residualGreen, residualExteriorBlack: 0, opaque, pureBlackHair };
}

function listFramePngs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.png') && /^frame_/i.test(f))
    .sort((a, b) => {
      const na = +(a.match(/frame_(\d+)/) || [])[1] || 0;
      const nb = +(b.match(/frame_(\d+)/) || [])[1] || 0;
      return na - nb || a.localeCompare(b);
    });
}

/**
 * Soft QA: reject empty / pure-noise only. Body includes pure black hair.
 */
function shouldRejectRaw(data, w, h, file) {
  let opaque = 0;
  let body = 0;
  let green = 0;
  for (let i = 0; i < w * h; i += 1) {
    const si = i * 4;
    if (data[si + 3] < 12) continue;
    opaque += 1;
    const r = data[si];
    const g = data[si + 1];
    const b = data[si + 2];
    if (isChromaGreen(r, g, b)) {
      green += 1;
      continue;
    }
    body += 1;
  }
  if (body < 80) {
    return { reject: true, reason: 'empty', body, green, opaque };
  }
  return { reject: false, reason: '', body, green, opaque, file };
}

async function loadSequence(dir, label) {
  const files = listFramePngs(dir);
  if (!files.length) return { kept: [], rejected: [], total: 0, label };
  const kept = [];
  const rejected = [];
  for (const file of files) {
    const full = path.join(dir, file);
    const { data, info } = await sharp(full)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const score = shouldRejectRaw(data, info.width, info.height, file);
    if (score.reject) {
      rejected.push({ file, score });
      console.log(`  REJECT ${file} (${score.reason} body=${score.body})`);
      continue;
    }
    kept.push({
      file,
      path: full,
      data,
      width: info.width,
      height: info.height,
      score,
    });
    console.log(
      `  KEEP ${label} ${file} ${info.width}x${info.height} body≈${score.body} (alpha preserved)`,
    );
  }
  return { kept, rejected, total: files.length, label };
}

async function writeMagentaPreview(sheet, outName) {
  fs.mkdirSync(QA_DIR, { recursive: true });
  const mag = Buffer.alloc(sheet.width * sheet.height * 4);
  for (let i = 0; i < sheet.width * sheet.height; i += 1) {
    const j = i * 4;
    if (sheet.data[j + 3] < 16) {
      mag[j] = 255;
      mag[j + 1] = 0;
      mag[j + 2] = 255;
      mag[j + 3] = 255;
    } else {
      mag[j] = sheet.data[j];
      mag[j + 1] = sheet.data[j + 1];
      mag[j + 2] = sheet.data[j + 2];
      mag[j + 3] = 255;
    }
  }
  await sharp(mag, {
    raw: { width: sheet.width, height: sheet.height, channels: 4 },
  })
    .png()
    .toFile(path.join(QA_DIR, `${path.basename(outName, '.png')}-magenta.png`));
}

async function writeFrameSamples(sheet, scaled, outName) {
  const samples = [
    0,
    Math.floor(scaled.frames.length * 0.25),
    Math.floor(scaled.frames.length * 0.5),
    Math.floor(scaled.frames.length * 0.75),
    scaled.frames.length - 1,
  ];
  for (const fi of [...new Set(samples)]) {
    const crop = Buffer.alloc(scaled.frameWidth * scaled.frameHeight * 4);
    for (let y = 0; y < scaled.frameHeight; y += 1) {
      sheet.data.copy(
        crop,
        y * scaled.frameWidth * 4,
        (y * sheet.width + fi * scaled.frameWidth) * 4,
        (y * sheet.width + fi * scaled.frameWidth + scaled.frameWidth) * 4,
      );
    }
    await sharp(crop, {
      raw: {
        width: scaled.frameWidth,
        height: scaled.frameHeight,
        channels: 4,
      },
    })
      .resize(scaled.frameWidth * 3, scaled.frameHeight * 3, {
        kernel: sharp.kernel.nearest,
      })
      .png()
      .toFile(
        path.join(QA_DIR, `${path.basename(outName, '.png')}-f${fi}-x3.png`),
      );
  }
}

function updateMeta(metaKey, entry) {
  let meta = {};
  if (fs.existsSync(META_JSON)) {
    try {
      meta = JSON.parse(fs.readFileSync(META_JSON, 'utf8'));
    } catch {
      meta = {};
    }
  }
  meta[metaKey] = entry;
  fs.writeFileSync(META_JSON, `${JSON.stringify(meta, null, 2)}\n`);
}

async function processSequence(entries, label, outName, metaKey, note, sourceRoot) {
  if (!entries.length) {
    console.warn(`${label}: no frames — skip`);
    return null;
  }
  const keyed = [];
  for (const e of entries) {
    const frame = keyFrame(e.data);
    const box = bbox(frame, e.width, e.height);
    if (box.width < 3 || box.height < 4) {
      throw new Error(`${label}: ${e.file} empty after crop (${box.width}x${box.height})`);
    }
    const opaque = (() => {
      let n = 0;
      for (let i = 3; i < frame.length; i += 4) if (frame[i] >= 16) n += 1;
      return n;
    })();
    if (opaque < 10) {
      throw new Error(`${label}: ${e.file} nearly empty (${opaque}px)`);
    }
    keyed.push({
      data: frame,
      width: e.width,
      height: e.height,
      file: e.file,
      box,
      opaque,
    });
    console.log(
      `  ${label} ${e.file}: content ${box.width}x${box.height} opaque=${opaque}`,
    );
  }

  const norm = normalize(
    keyed.map((k) => k.data),
    keyed.map((k) => k.width),
    keyed.map((k) => k.height),
  );
  const scaled = await scaleFrames(
    norm.frames,
    norm.frameWidth,
    norm.frameHeight,
    norm.contentHeight,
  );
  const sheet = stitch(scaled.frames, scaled.frameWidth, scaled.frameHeight);
  const qa = residualMetrics(
    sheet.data,
    sheet.width,
    scaled.frameHeight,
    scaled.frameWidth,
    scaled.frames.length,
  );
  console.log(
    `  ${label} QA residualGreen=${qa.residualGreen} residualExteriorBlack=${qa.residualExteriorBlack} opaque=${qa.opaque} pureBlackHair=${qa.pureBlackHair} n=${scaled.frames.length}`,
  );

  if (qa.residualGreen > 0) {
    throw new Error(`${label}: residual green px = ${qa.residualGreen}`);
  }
  // Hair MUST remain: pure black opaque count on body frames > 0 for most poses
  if (qa.pureBlackHair < 50) {
    throw new Error(
      `${label}: pure black hair nearly gone (${qa.pureBlackHair}px) — chromakey regress?`,
    );
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, outName);
  await sharp(sheet.data, {
    raw: { width: sheet.width, height: sheet.height, channels: 4 },
  })
    .png()
    .toFile(outPath);

  await writeMagentaPreview(sheet, outName);
  await writeFrameSamples(sheet, scaled, outName);

  const durationMs = Math.round((scaled.frames.length / FRAME_RATE) * 1000);
  const hitDelayMs = Math.round(durationMs * 0.55);
  const entry = {
    image: `/sprites/player/hinata/${outName}`,
    frameWidth: scaled.frameWidth,
    frameHeight: scaled.frameHeight,
    frameCount: scaled.frames.length,
    contentHeight: scaled.contentHeight,
    scale: scaled.scale,
    frameRate: FRAME_RATE,
    durationMs,
    hitDelayMs,
    source: `${sourceRoot} (${keyed.map((k) => k.file).join(', ')})`,
    residualGreen: qa.residualGreen,
    residualExteriorBlack: 0,
    pureBlackHair: qa.pureBlackHair,
    note,
  };

  updateMeta(metaKey, entry);
  console.log(
    `-> ${outName} ${sheet.width}x${sheet.height} fw=${entry.frameWidth} fh=${entry.frameHeight} n=${entry.frameCount} contentH=${entry.contentHeight} scale=${entry.scale.toFixed(3)}`,
  );
  return entry;
}

async function main() {
  console.log(
    'hinata jutsu: alpha-only pack (no black/green key) — Hakke Shōhō (jutsu-new)…',
  );
  const seq = await loadSequence(JUTSU_INPUT, 'hakke');
  console.log(
    `hakke total=${seq.total} keep=${seq.kept.length} rejected=${seq.rejected.length}`,
  );

  if (seq.kept.length !== 31) {
    throw new Error(
      `Expected 31 frames in ${JUTSU_INPUT}, got keep=${seq.kept.length} total=${seq.total}`,
    );
  }

  const hakkeEntry = await processSequence(
    seq.kept,
    'hakke-shou',
    'hakke-shou.png',
    'hinata-hakke-shou',
    `${seq.kept.length}f Hakke Shōhō (stance→dash flurry→cream impact); alpha-only pack, no chromakey`,
    'assets/naruto-source/nu/hinata/jutsu-new',
  );

  for (const name of RETIRED_SPRITES) {
    const p = path.join(OUT_DIR, name);
    if (fs.existsSync(p)) {
      fs.unlinkSync(p);
      console.log(`removed retired sprite ${name}`);
    }
  }
  if (fs.existsSync(META_JSON)) {
    try {
      const meta = JSON.parse(fs.readFileSync(META_JSON, 'utf8'));
      if (meta['hinata-twin-lion']) {
        delete meta['hinata-twin-lion'];
        fs.writeFileSync(META_JSON, `${JSON.stringify(meta, null, 2)}\n`);
        console.log('removed meta hinata-twin-lion');
      }
    } catch {
      /* ignore */
    }
  }

  console.log('\nPack wire:');
  console.log(
    JSON.stringify(
      {
        skillId: 'skill-hakke-shouhou',
        hakkeShou: hakkeEntry,
        retired: ['skill-twin-lion-fists', 'twin-lion.png'],
        rejected: seq.rejected.map((r) => ({
          file: r.file,
          reason: r.score.reason,
        })),
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
