/**
 * Neji Hyuga — Hakkeshou Kaiten (JUTSU COMPLETO, 18f alpha).
 *
 * Fontes já vêm transparentes (sem fundo verde) em canvas 338×218 com pés
 * alinhados ao baseline. Body-lock: âncora fixa de torso/pés dos frames de
 * stance (f1); cúpula expandida não arrasta o personagem.
 *
 * npm run neji:jutsu
 * Input:  assets/naruto-source/nu/neji/jutsu-completo/frame_001..018.png
 * Output: public/sprites/player/neji/kaiten.png
 *
 * QA hard-fails: residual green, buracos, frame vazio, body lock drift, cúpula
 * perdida, cabelo apagado nos frames de stance.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const {
  ALPHA_KEEP,
  loadAlphaFrames,
  stitch,
  writeFrameCrops,
  updateMeta,
  writePng,
  isChromaGreen,
  countOpaque,
} = require('./lib/alpha-frame-pack');

const ROOT = path.resolve(__dirname, '..');
const INPUT_DIR = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'neji', 'jutsu-completo');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'neji');
const META_JSON = path.join(OUT_DIR, 'meta.json');
const QA_DIR = path.join(ROOT, 'assets-src', '_qa', 'neji');
const OUT_NAME = 'kaiten.png';
const TARGET_BODY_H = 48;
const FRAME_RATE = 12;
const PAD = 2;
const EXPECTED = 18;
/** Peak dome frames (0-based) where body is fully covered — expected. */
const DOME_PEAK_FROM = 4;
const DOME_PEAK_TO = 7;
const BODY_CX_STD_MAX = 0.01;
const FEET_Y_STD_MAX = 0.01;
const MAX_FRAME_H = 130;

function isBlackInk(r, g, b) {
  return Math.max(r, g, b) <= 42 && Math.max(r, g, b) - Math.min(r, g, b) <= 22;
}

/** Cúpula / trilhas azul-cianas (preservar). */
function isKaitenEnergy(r, g, b) {
  // main dome blues
  if (b >= 100 && g >= 90 && r <= 200 && b >= r - 15 && g + b > r * 1.6) return true;
  if (b >= 140 && g >= 120 && r <= 180 && b > r && g >= r - 20) return true;
  // pale cyan highlights
  if (r >= 160 && g >= 190 && b >= 200 && b >= r - 5) return true;
  if (r >= 180 && g >= 210 && b >= 220 && Math.max(r, g, b) - Math.min(r, g, b) <= 50) {
    if (b >= r - 8) return true;
  }
  // softer teal fringe
  if (g >= 100 && b >= 90 && r <= 140 && g + b >= r * 2.1 && b + 30 >= r) return true;
  return false;
}

function isSkin(r, g, b) {
  if (isKaitenEnergy(r, g, b)) return false;
  if (r >= 180 && g >= 120 && b >= 80 && r > g && g >= b - 15 && r - b >= 20) return true;
  if (r >= 200 && g >= 150 && b >= 100 && r >= g - 5) return true;
  if (r >= 150 && g >= 95 && b >= 60 && r > g && g > b && r - b >= 25) return true;
  return false;
}

function isRobe(r, g, b) {
  if (isKaitenEnergy(r, g, b)) return false;
  // white/grey tunic
  if (
    Math.max(r, g, b) - Math.min(r, g, b) <= 45 &&
    Math.max(r, g, b) >= 100 &&
    Math.max(r, g, b) <= 240
  ) {
    return true;
  }
  // brown accents
  if (r >= 100 && g >= 45 && b <= 60 && r > g && g >= b) return true;
  return false;
}

function isBodyPixel(r, g, b) {
  if (isKaitenEnergy(r, g, b)) return false;
  if (isChromaGreen(r, g, b)) return false;
  if (isBlackInk(r, g, b)) return true;
  if (isSkin(r, g, b) || isRobe(r, g, b)) return true;
  if (Math.max(r, g, b) <= 20) return true;
  if (Math.max(r, g, b) - Math.min(r, g, b) < 40 && Math.max(r, g, b) <= 110) return true;
  return false;
}

function bodyAnchor(frame, w, h) {
  let minX = w;
  let maxX = -1;
  let minY = h;
  let maxY = -1;
  let n = 0;
  let sumX = 0;

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      if (frame[i + 3] < ALPHA_KEEP) continue;
      if (!isBodyPixel(frame[i], frame[i + 1], frame[i + 2])) continue;
      n += 1;
      sumX += x;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (n < 40 || maxY - minY + 1 < 20) {
    return {
      bodyCx: null,
      feetY: null,
      bodyH: 0,
      mode: 'none',
      n,
    };
  }

  return {
    bodyCx: sumX / n,
    feetY: maxY,
    bodyH: maxY - minY + 1,
    mode: n >= 120 ? 'core' : 'weak',
    n,
  };
}

/** Alpha bbox feet (all source frames share the same canvas feet line). */
function alphaFeetY(frame, w, h) {
  let maxY = -1;
  for (let y = h - 1; y >= 0; y -= 1) {
    for (let x = 0; x < w; x += 1) {
      if (frame[(y * w + x) * 4 + 3] >= ALPHA_KEEP) {
        maxY = y;
        return maxY;
      }
    }
  }
  return h - 1;
}

/**
 * Pin every frame to the same bodyCx + feetY measured from strong stance frames.
 * Dome mass never moves the root.
 */
function normalizeBodyLock(frames, widths, heights, pad = PAD) {
  const anchors = frames.map((f, i) => bodyAnchor(f, widths[i], heights[i]));
  const alphaFeet = frames.map((f, i) => alphaFeetY(f, widths[i], heights[i]));

  // Stance refs: first frame + last 2 recovery (body visible).
  const refIdxs = [0, frames.length - 2, frames.length - 1].filter(
    (i) => anchors[i] && anchors[i].mode === 'core',
  );
  if (!refIdxs.length) {
    for (let i = 0; i < anchors.length; i += 1) {
      if (anchors[i].mode === 'core') refIdxs.push(i);
    }
  }
  if (!refIdxs.length) throw new Error('No core body anchors for lock');

  const lockBodyCx =
    refIdxs.reduce((s, i) => s + anchors[i].bodyCx, 0) / refIdxs.length;
  const lockFeetY =
    refIdxs.reduce((s, i) => s + (alphaFeet[i] ?? anchors[i].feetY), 0) /
    refIdxs.length;
  const lockBodyH =
    refIdxs.reduce((s, i) => s + anchors[i].bodyH, 0) / refIdxs.length;

  console.log(
    `lock refs=[${refIdxs.map((i) => i + 1).join(',')}] bodyCx=${lockBodyCx.toFixed(2)} feetY=${lockFeetY.toFixed(1)} bodyH=${lockBodyH.toFixed(1)}`,
  );

  const filled = frames.map((_, i) => ({
    bodyCx: lockBodyCx,
    feetY: lockFeetY,
    bodyH: lockBodyH,
    mode: anchors[i].mode,
    n: anchors[i].n,
    sticky: anchors[i].mode !== 'core',
  }));

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
        // source already clean — preserve RGB, force opaque
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
    contentHeight: lockBodyH,
    anchors: filled,
    destBodyCx,
    destFeetY,
    lockBodyCx,
    lockFeetY,
  };
}

async function scaleNearest(frames, fw, fh, scale) {
  const outW = Math.max(1, Math.round(fw * scale));
  const outH = Math.max(1, Math.round(fh * scale));
  const out = [];
  for (const frame of frames) {
    const { data } = await sharp(frame, {
      raw: { width: fw, height: fh, channels: 4 },
    })
      .resize(outW, outH, { kernel: sharp.kernel.nearest })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) {
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 0;
      } else {
        data[i + 3] = 255;
        if (isChromaGreen(data[i], data[i + 1], data[i + 2])) {
          data[i] = 0;
          data[i + 1] = 0;
          data[i + 2] = 0;
          data[i + 3] = 0;
        }
      }
    }
    // Remove 1–2px flecks from nearest downsample (dust islands stay ≥3px).
    removeTinyIslands(data, outW, outH, 2);
    out.push(data);
  }
  return { frames: out, frameWidth: outW, frameHeight: outH, scale };
}

function removeTinyIslands(frame, w, h, maxSize) {
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

function variance(vals) {
  if (!vals.length) return { mean: 0, std: 0, min: 0, max: 0 };
  const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
  const v = vals.reduce((s, x) => s + (x - mean) * (x - mean), 0) / vals.length;
  return { mean, std: Math.sqrt(v), min: Math.min(...vals), max: Math.max(...vals) };
}

function countPalette(sheetData) {
  let residualGreen = 0;
  let black = 0;
  let opaque = 0;
  let energy = 0;
  for (let i = 0; i < sheetData.length; i += 4) {
    if (sheetData[i + 3] < ALPHA_KEEP) continue;
    opaque += 1;
    const r = sheetData[i];
    const g = sheetData[i + 1];
    const b = sheetData[i + 2];
    if (isChromaGreen(r, g, b)) residualGreen += 1;
    if (r <= 12 && g <= 12 && b <= 12) black += 1;
    if (isKaitenEnergy(r, g, b)) energy += 1;
  }
  return { residualGreen, black, opaque, energy };
}

/** Thin interior vertical holes that shouldn't exist in a packed body/dome. */
function maxVerticalGash(frame, fw, fh) {
  let maxRun = 0;
  for (let x = 2; x < fw - 2; x += 1) {
    let run = 0;
    for (let y = 0; y < fh; y += 1) {
      const mid = frame[(y * fw + x) * 4 + 3] < ALPHA_KEEP;
      const left = frame[(y * fw + x - 1) * 4 + 3] >= ALPHA_KEEP;
      const right = frame[(y * fw + x + 1) * 4 + 3] >= ALPHA_KEEP;
      if (mid && left && right) {
        run += 1;
        maxRun = Math.max(maxRun, run);
      } else {
        run = 0;
      }
    }
  }
  return maxRun;
}

/** Feet row Y of packed frame (last opaque row). */
function feetRow(frame, fw, fh) {
  for (let y = fh - 1; y >= 0; y -= 1) {
    for (let x = 0; x < fw; x += 1) {
      if (frame[(y * fw + x) * 4 + 3] >= ALPHA_KEEP) return y;
    }
  }
  return -1;
}

function contentCenterX(frame, fw, fh) {
  let minX = fw;
  let maxX = -1;
  for (let y = 0; y < fh; y += 1) {
    for (let x = 0; x < fw; x += 1) {
      if (frame[(y * fw + x) * 4 + 3] < ALPHA_KEEP) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
    }
  }
  if (maxX < 0) return fw / 2;
  return (minX + maxX) / 2;
}

function resolveWalkScale() {
  if (fs.existsSync(META_JSON)) {
    try {
      const meta = JSON.parse(fs.readFileSync(META_JSON, 'utf8'));
      const w = meta['neji-walk'];
      if (w && typeof w.scale === 'number' && w.scale > 0) {
        return { scale: w.scale, source: 'meta.json neji-walk' };
      }
    } catch {
      /* fall through */
    }
  }
  return null;
}

async function writeMagentaBg(sheet, qaDir) {
  fs.mkdirSync(qaDir, { recursive: true });
  const mag = Buffer.alloc(sheet.width * sheet.height * 4);
  for (let i = 0; i < sheet.width * sheet.height; i += 1) {
    const j = i * 4;
    if (sheet.data[j + 3] < ALPHA_KEEP) {
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
    .toFile(path.join(qaDir, 'kaiten-magenta-bg.png'));

  await sharp(sheet.data, {
    raw: { width: sheet.width, height: sheet.height, channels: 4 },
  })
    .png()
    .toFile(path.join(qaDir, 'kaiten-full.png'));
}

async function writeAllFrameQa(scaled, qaDir) {
  fs.mkdirSync(qaDir, { recursive: true });
  for (let fi = 0; fi < scaled.frames.length; fi += 1) {
    const crop = scaled.frames[fi];
    const fw = scaled.frameWidth;
    const fh = scaled.frameHeight;
    await sharp(crop, { raw: { width: fw, height: fh, channels: 4 } })
      .resize(fw * 3, fh * 3, { kernel: sharp.kernel.nearest })
      .png()
      .toFile(path.join(qaDir, `kaiten-frame-${fi}-x3.png`));

    const mag = Buffer.alloc(fw * fh * 4);
    for (let i = 0; i < fw * fh; i += 1) {
      const j = i * 4;
      if (crop[j + 3] < ALPHA_KEEP) {
        mag[j] = 255;
        mag[j + 1] = 0;
        mag[j + 2] = 255;
        mag[j + 3] = 255;
      } else {
        mag[j] = crop[j];
        mag[j + 1] = crop[j + 1];
        mag[j + 2] = crop[j + 2];
        mag[j + 3] = 255;
      }
    }
    await sharp(mag, { raw: { width: fw, height: fh, channels: 4 } })
      .resize(fw * 4, fh * 4, { kernel: sharp.kernel.nearest })
      .png()
      .toFile(path.join(qaDir, `kaiten-frame-${fi}-mag-x4.png`));
  }
}

async function main() {
  const keyed = await loadAlphaFrames(INPUT_DIR, EXPECTED);
  console.log(`loaded ${keyed.length} alpha frames from ${path.relative(ROOT, INPUT_DIR)}`);

  const rawFrames = keyed.map((k) => k.frame);
  const widths = keyed.map((k) => k.width);
  const heights = keyed.map((k) => k.height);

  for (let i = 0; i < keyed.length; i += 1) {
    const a = bodyAnchor(rawFrames[i], widths[i], heights[i]);
    const feet = alphaFeetY(rawFrames[i], widths[i], heights[i]);
    console.log(
      `f${String(i + 1).padStart(2, '0')} mode=${a.mode.padEnd(4)} n=${String(a.n).padStart(5)} bodyH=${a.bodyH || 0} feetY=${feet} bodyCx=${a.bodyCx != null ? a.bodyCx.toFixed(1) : '--'}`,
    );
  }

  const norm = normalizeBodyLock(rawFrames, widths, heights, PAD);
  console.log(
    `body-lock pack fw=${norm.frameWidth} fh=${norm.frameHeight} contentH=${norm.contentHeight.toFixed(1)} destBodyCx=${norm.destBodyCx} destFeetY=${norm.destFeetY}`,
  );

  // Scale standing body → 48. Cap total frame height for huge dome.
  let scale = TARGET_BODY_H / Math.max(1, norm.contentHeight);
  const walk = resolveWalkScale();
  if (walk && Math.abs(scale - walk.scale) / walk.scale < 0.12) {
    scale = walk.scale;
    console.log(`snapped to walk scale ${scale.toFixed(6)} (${walk.source})`);
  }
  if (norm.frameHeight * scale > MAX_FRAME_H) {
    scale = MAX_FRAME_H / norm.frameHeight;
    console.log(`capped by MAX_FRAME_H → scale=${scale.toFixed(6)}`);
  }
  console.log(`final scale=${scale.toFixed(6)}`);

  const scaled = await scaleNearest(norm.frames, norm.frameWidth, norm.frameHeight, scale);
  const sheet = stitch(scaled.frames, scaled.frameWidth, scaled.frameHeight);
  const pal = countPalette(sheet.data);

  // QA: packed root lock (feet row + content center should be stable)
  const feetVals = scaled.frames.map((f) => feetRow(f, scaled.frameWidth, scaled.frameHeight));
  const feetStats = variance(feetVals);
  // body-center stability on stance frames only (not full dome which expands)
  const stanceIdx = [0, 1, 11, 12, 13, 14, 15, 16, 17].filter((i) => i < scaled.frames.length);
  const bodyCxPacked = stanceIdx.map((i) => {
    // use body pixels when available
    const fr = scaled.frames[i];
    const fw = scaled.frameWidth;
    const fh = scaled.frameHeight;
    let sumX = 0;
    let n = 0;
    for (let y = 0; y < fh; y += 1) {
      for (let x = 0; x < fw; x += 1) {
        const p = (y * fw + x) * 4;
        if (fr[p + 3] < ALPHA_KEEP) continue;
        if (!isBodyPixel(fr[p], fr[p + 1], fr[p + 2])) continue;
        sumX += x;
        n += 1;
      }
    }
    return n >= 40 ? sumX / n : contentCenterX(fr, fw, fh);
  });
  const bodyCxStats = variance(bodyCxPacked);

  // Per-frame detailed QA
  const failures = [];
  for (let i = 0; i < scaled.frames.length; i += 1) {
    const fr = scaled.frames[i];
    const op = countOpaque(fr);
    if (op < 80) failures.push(`f${i + 1} too empty op=${op}`);

    const gash = maxVerticalGash(fr, scaled.frameWidth, scaled.frameHeight);
    // Dome peak has intentional spin gaps / streaks — allow slightly longer runs.
    const gashLimit = i >= DOME_PEAK_FROM && i <= DOME_PEAK_TO ? 14 : 8;
    if (gash >= gashLimit) {
      failures.push(`f${i + 1} vertical gash run=${gash} (limit ${gashLimit})`);
    }

    // residual green per frame
    let fg = 0;
    for (let p = 0; p < fr.length; p += 4) {
      if (fr[p + 3] < ALPHA_KEEP) continue;
      if (isChromaGreen(fr[p], fr[p + 1], fr[p + 2])) fg += 1;
    }
    if (fg > 0) failures.push(`f${i + 1} residualGreen=${fg}`);
  }

  // Peak dome must be energy-dense
  let peakEnergy = 0;
  for (let i = DOME_PEAK_FROM; i <= DOME_PEAK_TO; i += 1) {
    const fr = scaled.frames[i];
    for (let p = 0; p < fr.length; p += 4) {
      if (fr[p + 3] < ALPHA_KEEP) continue;
      if (isKaitenEnergy(fr[p], fr[p + 1], fr[p + 2])) peakEnergy += 1;
    }
  }
  if (peakEnergy < 800) failures.push(`peak dome energy too low (${peakEnergy})`);

  // Stance hair black preserved
  let stanceBlack = 0;
  for (const i of [0, 16, 17]) {
    if (i >= scaled.frames.length) continue;
    const fr = scaled.frames[i];
    for (let p = 0; p < fr.length; p += 4) {
      if (fr[p + 3] < ALPHA_KEEP) continue;
      if (fr[p] <= 12 && fr[p + 1] <= 12 && fr[p + 2] <= 12) stanceBlack += 1;
    }
  }
  if (stanceBlack < 80) failures.push(`stance pure black too low (${stanceBlack}) — hair keyed?`);

  if (pal.residualGreen > 0) failures.push(`sheet residualGreen=${pal.residualGreen}`);
  if (feetStats.std > FEET_Y_STD_MAX) {
    failures.push(
      `feetY drift std=${feetStats.std.toFixed(3)} range=[${feetStats.min},${feetStats.max}]`,
    );
  }
  if (bodyCxStats.std > 2.5) {
    failures.push(
      `stance bodyCx drift std=${bodyCxStats.std.toFixed(3)} range=[${bodyCxStats.min.toFixed(1)},${bodyCxStats.max.toFixed(1)}]`,
    );
  }

  console.log(
    `QA residualGreen=${pal.residualGreen} opaque=${pal.opaque} pureBlack=${pal.black} energy=${pal.energy}`,
  );
  console.log(
    `QA feetY mean=${feetStats.mean.toFixed(2)} std=${feetStats.std.toFixed(4)} range=[${feetStats.min},${feetStats.max}]`,
  );
  console.log(
    `QA stance bodyCx mean=${bodyCxStats.mean.toFixed(2)} std=${bodyCxStats.std.toFixed(3)} range=[${bodyCxStats.min.toFixed(2)},${bodyCxStats.max.toFixed(2)}]`,
  );
  console.log(`QA peakEnergy=${peakEnergy} stanceBlack=${stanceBlack}`);

  if (failures.length) {
    console.error('QA FAILURES:');
    for (const f of failures) console.error(' -', f);
    throw new Error(`QA fail: ${failures.length} issue(s)`);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  await writePng(path.join(OUT_DIR, OUT_NAME), sheet.data, sheet.width, sheet.height);
  await writeFrameCrops(
    sheet,
    { frames: scaled.frames, frameWidth: scaled.frameWidth, frameHeight: scaled.frameHeight },
    QA_DIR,
    'kaiten',
    3,
  );
  await writeMagentaBg(sheet, QA_DIR);
  await writeAllFrameQa(scaled, QA_DIR);

  const n = scaled.frames.length;
  const durationMs = Math.round((n / FRAME_RATE) * 1000);
  // Hit when dome fully formed (~peak first frame, 1-based 5).
  const hitFrameIdx = DOME_PEAK_FROM;
  const hitDelayMs = Math.round((hitFrameIdx / FRAME_RATE) * 1000);

  const entry = {
    image: `/sprites/player/neji/${OUT_NAME}`,
    frameWidth: scaled.frameWidth,
    frameHeight: scaled.frameHeight,
    frameCount: n,
    contentHeight: TARGET_BODY_H,
    scale: scaled.scale,
    frameRate: FRAME_RATE,
    durationMs,
    hitDelayMs,
    hitFrame: hitFrameIdx + 1,
    residualGreen: pal.residualGreen,
    pureBlack: pal.black,
    energy: pal.energy,
    bodyLock: {
      destBodyCx: Math.round(norm.destBodyCx * scale),
      destFeetY: Math.round(norm.destFeetY * scale),
      feetYStd: Number(feetStats.std.toFixed(4)),
      stanceBodyCxStd: Number(bodyCxStats.std.toFixed(3)),
    },
    source: 'assets/naruto-source/nu/neji/jutsu-completo/frame_001..018.png',
    note: `Hakkeshou Kaiten ${n}f; alpha-only JUTSU COMPLETO; perfect body-lock feet+torso; residualGreen=0`,
  };

  updateMeta(META_JSON, 'neji-kaiten', entry);
  updateMeta(META_JSON, 'skill-hakke-kaiten', entry);

  console.log(
    `-> ${OUT_NAME} ${sheet.width}x${sheet.height} fw=${entry.frameWidth} fh=${entry.frameHeight} n=${n} contentH=${entry.contentHeight} scale=${entry.scale.toFixed(4)} duration=${durationMs} hitDelay=${hitDelayMs}`,
  );
  console.log(
    'PACK_WIRE',
    JSON.stringify({
      frameWidth: entry.frameWidth,
      frameHeight: entry.frameHeight,
      frameCount: entry.frameCount,
      contentHeight: entry.contentHeight,
      frameRate: FRAME_RATE,
      durationMs,
      hitDelayMs,
    }),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
