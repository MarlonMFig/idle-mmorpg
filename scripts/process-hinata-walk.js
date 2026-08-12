/**
 * Hinata walk — 6-frame horizontal side walk RIGHT, green chroma exterior only.
 * Removes dark-grey UI name plate "Hinata" on f0 (exact #1f plate + cyan glyphs).
 * NEVER black-key: pure #000 / near-black navy ARE hair — global stripLabels off.
 * Name-panel mask must not treat hair greys as plate (regressed into hair holes).
 *
 * npm run hinata:walk
 * Fonte: assets/naruto-source/nu/hinata-walk-sheet.png
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const {
  keyGreenBackground,
  isContent,
  isGreenBg,
  fillInteriorHoles,
} = require('./lib/chroma-green-bg');
const { resolveHqScale, resolvePackContentHeight, NATIVE_PIXELS } = require('./lib/strip-hq-scale');

const ROOT = path.resolve(__dirname, '..');
const INPUT = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'hinata-walk-sheet.png');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'hinata');
const META_JSON = path.join(OUT_DIR, 'meta.json');
const QA_DIR = path.join(ROOT, 'assets-src', '_qa', 'hinata');
const FRAME_RATE = 10;
const HINT_EXPECTED = 6;

function greenness(r, g, b) {
  return g - Math.max(r, b);
}

/**
 * Solid greyscale UI plate interior only — sample (31,31,31).
 * MUST NOT match pure #000 / near-black hair (that was eating the bob).
 */
function isNamePanel(r, g, b) {
  // Tight band around plate grey — exclude pure black hair (lum≈0) and mid greys
  if (Math.abs(r - 31) > 10 || Math.abs(g - 31) > 10 || Math.abs(b - 31) > 10) return false;
  if (Math.max(r, g, b) - Math.min(r, g, b) > 6) return false;
  // reject green-dark residual
  if (g > Math.max(r, b) + 8) return false;
  return true;
}

/**
 * Flat light-grey name-plate rim (#CACACA ≈ 202). Distinct from warm jacket greys
 * and cool skin highlights (e.g. 204,207,210).
 */
function isPlateRimWhite(r, g, b) {
  const avg = (r + g + b) / 3;
  // Source samples solid (202,202,202)
  if (avg < 190 || avg > 220) return false;
  if (Math.abs(r - g) > 2 || Math.abs(g - b) > 2 || Math.abs(r - b) > 2) return false;
  return true;
}

/**
 * Label rim + cyan "Hinata" text. Never dark tones (hair / pants).
 */
function isNameGlyph(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const avg = (r + g + b) / 3;
  // Guard: never treat hair/silhouette as glyph
  if (max <= 55) return false;
  // flat plate rim #CACACA (must catch before jacket warm greys)
  if (isPlateRimWhite(r, g, b)) return true;
  // light grey / white rim or bold letters
  if (avg >= 165 && max - min <= 28) return true;
  // cyan/blue UI lettering
  if (b >= 140 && b > r + 25 && g > r + 15 && g < b + 30) return true;
  // tan accent on glyph edge
  if (r >= 150 && g >= 110 && g <= 200 && b <= 120 && r >= b + 30) return true;
  return false;
}

function isLabelPixel(r, g, b) {
  return isNamePanel(r, g, b) || isNameGlyph(r, g, b);
}

/** Opaque pure / near-black — hair shadows. Never strip. */
function isHairBlack(r, g, b) {
  return r <= 22 && g <= 22 && b <= 28 && Math.max(r, g, b) - Math.min(r, g, b) <= 14;
}

/**
 * Clear the black name plate + cyan "Hinata" text on f0, then inpaint.
 * Uses pure-greyscale panel + cyan glyph masks (does not touch jacket).
 */
function removeHinataNameLabel(data, w, h) {
  // Plate + rim spans f0 body and its right rim can sit near f1's leading edge
  // (~x=56 on a 250px sheet). Scan ~first 1/3 so right rim at x≈56 is included.
  const xMax = Math.min(w, Math.floor(w / 3) + 12);
  const yMin = Math.floor(h * 0.12);
  const yMax = Math.floor(h * 0.72);

  // Score solid greyscale density per row in first column band to locate plate Y.
  const rowPanel = new Array(h).fill(0);
  const rowGlyph = new Array(h).fill(0);
  for (let y = yMin; y < yMax; y += 1) {
    for (let x = 0; x < xMax; x += 1) {
      const i = (y * w + x) * 4;
      if (data[i + 3] < 16) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (isNamePanel(r, g, b)) rowPanel[y] += 1;
      if (isNameGlyph(r, g, b)) rowGlyph[y] += 1;
    }
  }
  // Find continuous y-run with high panel density (plate body)
  let bestRun = null;
  let runS = -1;
  for (let y = yMin; y <= yMax; y += 1) {
    const hit = y < yMax && rowPanel[y] >= 8;
    if (hit && runS < 0) runS = y;
    if (!hit && runS >= 0) {
      const runE = y;
      const thr = 8;
      let mass = 0;
      let glyphMass = 0;
      for (let yy = runS; yy < runE; yy += 1) {
        mass += rowPanel[yy];
        glyphMass += rowGlyph[yy];
      }
      if (runE - runS >= 8 && mass >= 80) {
        if (!bestRun || mass > bestRun.mass) {
          bestRun = { t: runS, b: runE, mass, glyphMass };
        }
      }
      runS = -1;
    }
  }
  if (!bestRun) {
    console.warn('hinata walk: no dense greyscale plate row-run; scanning full mid band');
    // fallback: y range with max panel mass over 16px window
    let peak = 0;
    let peakY = Math.floor(h * 0.3);
    for (let y = yMin; y < yMax - 16; y += 1) {
      let m = 0;
      for (let yy = y; yy < y + 16; yy += 1) m += rowPanel[yy];
      if (m > peak) {
        peak = m;
        peakY = y;
      }
    }
    if (peak < 60) {
      console.warn('hinata walk: plate detection failed');
      return null;
    }
    bestRun = { t: peakY, b: peakY + 20, mass: peak, glyphMass: 0 };
  }

  // Expand a few px for the light-grey top rim
  const T = Math.max(0, bestRun.t - 4);
  const B = Math.min(h - 1, bestRun.b + 2);

  // X span within rows where panel/glyph is dense
  let minX = xMax;
  let maxX = 0;
  for (let y = T; y <= B; y += 1) {
    for (let x = 0; x < xMax; x += 1) {
      const i = (y * w + x) * 4;
      if (data[i + 3] < 16) continue;
      if (isLabelPixel(data[i], data[i + 1], data[i + 2])) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
    }
  }
  if (maxX < minX) {
    console.warn('hinata walk: plate x-span empty');
    return null;
  }
  const L = Math.max(0, minX - 1);
  const R = Math.min(w - 1, maxX + 1);

  let cleared = 0;
  for (let y = T; y <= B; y += 1) {
    for (let x = L; x <= R; x += 1) {
      const i = (y * w + x) * 4;
      if (data[i + 3] < 16) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // Keep hair + jacket: only exact plate greys + bright/cyan UI glyphs
      if (isHairBlack(r, g, b)) continue;
      if (!isLabelPixel(r, g, b)) continue;
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = 0;
      cleared += 1;
    }
  }

  // Second pass: leftover plate greys only (not black hair)
  for (let y = T; y <= B; y += 1) {
    for (let x = L; x <= R; x += 1) {
      const i = (y * w + x) * 4;
      if (data[i + 3] < 16) continue;
      if (isHairBlack(data[i], data[i + 1], data[i + 2])) continue;
      if (isNamePanel(data[i], data[i + 1], data[i + 2])) {
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 0;
        cleared += 1;
      }
    }
  }

  fillInteriorHoles(data, w, h, Math.max(120, Math.floor(w * h * 0.03)));
  // Light-grey rim flecks often sit 1–3px above the dense plate run — sweep left figure mid band
  let debris = 0;
  for (let y = Math.max(0, T - 8); y <= Math.min(h - 1, B + 4); y += 1) {
    for (let x = 0; x < xMax; x += 1) {
      const i = (y * w + x) * 4;
      if (data[i + 3] < 16) continue;
      if (isHairBlack(data[i], data[i + 1], data[i + 2])) continue;
      if (isLabelPixel(data[i], data[i + 1], data[i + 2])) {
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 0;
        debris += 1;
      }
    }
  }
  cleared += debris;
  console.log(
    `hinata walk: removed name plate bbox ${L},${T}-${R},${B} mass=${bestRun.mass} glyphMass=${bestRun.glyphMass} cleared=${cleared} rimDebris=${debris}`,
  );
  return { L, T, R, B, cleared };
}

/** Drop tiny disconnected flecks (label rim crumbs) — keep largest CC per frame. */
function despeckleFrame(frame, fw, fh, maxSpeck = 18) {
  const N = fw * fh;
  const visit = new Uint8Array(N);
  const comps = [];
  for (let start = 0; start < N; start += 1) {
    if (visit[start] || frame[start * 4 + 3] < 16) continue;
    const stack = [start];
    visit[start] = 1;
    const comp = [];
    while (stack.length) {
      const idx = stack.pop();
      comp.push(idx);
      const x = idx % fw;
      const y = (idx / fw) | 0;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= fw || ny >= fh) continue;
        const ni = ny * fw + nx;
        if (visit[ni] || frame[ni * 4 + 3] < 16) continue;
        visit[ni] = 1;
        stack.push(ni);
      }
    }
    comps.push(comp);
  }
  if (comps.length <= 1) return 0;
  comps.sort((a, b) => b.length - a.length);
  let removed = 0;
  for (let i = 1; i < comps.length; i += 1) {
    if (comps[i].length > maxSpeck) continue;
    for (const idx of comps[i]) {
      const p = idx * 4;
      frame[p] = 0;
      frame[p + 1] = 0;
      frame[p + 2] = 0;
      frame[p + 3] = 0;
      removed += 1;
    }
  }
  return removed;
}

/** Exact #1f1f1f UI plate grey from source (not navy hair/pants). */
function isSolidLabelGrey(r, g, b) {
  return (
    Math.abs(r - 31) <= 5 &&
    Math.abs(g - 31) <= 5 &&
    Math.abs(b - 31) <= 5 &&
    Math.max(r, g, b) - Math.min(r, g, b) <= 4
  );
}

function isLeadingPlateArtifact(r, g, b) {
  return isSolidLabelGrey(r, g, b) || isPlateRimWhite(r, g, b);
}

/**
 * Residual plate leaves a 1–3px pure-#1f and/or #CACACA strip along the back
 * (left edge of profile-RIGHT figures). Replace with nearest non-plate body
 * pixel to the right. Safe: only flat greys, never warm jacket / hair black.
 */
function scrubBackPlateStrip(frame, fw, fh) {
  let fixed = 0;
  for (let y = 0; y < fh; y += 1) {
    let x0 = -1;
    for (let x = 0; x < fw; x += 1) {
      if (frame[(y * fw + x) * 4 + 3] >= 16) {
        x0 = x;
        break;
      }
    }
    if (x0 < 0) continue;
    let run = 0;
    for (let x = x0; x < Math.min(fw, x0 + 5); x += 1) {
      const i = (y * fw + x) * 4;
      if (frame[i + 3] < 16) break;
      if (isLeadingPlateArtifact(frame[i], frame[i + 1], frame[i + 2])) run += 1;
      else break;
    }
    // Single-column white rim is the common ghost line — allow run >= 1 for pure rim
    if (run < 1) continue;
    // Avoid scrubbing lone noise at head/feet: only mid-body OR multi-px / white rim
    const midBody = y >= Math.floor(fh * 0.12) && y <= Math.floor(fh * 0.78);
    const pureRim =
      isPlateRimWhite(frame[(y * fw + x0) * 4], frame[(y * fw + x0) * 4 + 1], frame[(y * fw + x0) * 4 + 2]);
    if (!midBody && !(pureRim && run >= 1)) continue;
    if (!pureRim && run < 2) continue;
    let donor = -1;
    for (let x = x0 + run; x < Math.min(fw, x0 + run + 14); x += 1) {
      const i = (y * fw + x) * 4;
      if (frame[i + 3] < 16) continue;
      if (isLeadingPlateArtifact(frame[i], frame[i + 1], frame[i + 2])) continue;
      if (isHairBlack(frame[i], frame[i + 1], frame[i + 2])) {
        // Prefer body (jacket) over hair for torso edge repair
        if (donor < 0) donor = i;
        continue;
      }
      donor = i;
      break;
    }
    for (let x = x0; x < x0 + run; x += 1) {
      const i = (y * fw + x) * 4;
      if (donor < 0) {
        // Pure plate rim with no donor: drop to transparent (silhouette shrinks 1px)
        frame[i] = 0;
        frame[i + 1] = 0;
        frame[i + 2] = 0;
        frame[i + 3] = 0;
      } else {
        frame[i] = frame[donor];
        frame[i + 1] = frame[donor + 1];
        frame[i + 2] = frame[donor + 2];
        frame[i + 3] = 255;
      }
      fixed += 1;
    }
  }
  return fixed;
}

/**
 * Strip isolated vertical #CACACA columns (UI plate rim bleed) anywhere they
 * form a tall greyscale column that is not warm jacket fabric.
 * Only pure flat greys; never touches hair blacks or warm mid-greys.
 */
function scrubPlateRimColumns(frame, fw, fh, minRun = 6) {
  let fixed = 0;
  for (let x = 0; x < fw; x += 1) {
    let y = 0;
    while (y < fh) {
      const i0 = (y * fw + x) * 4;
      if (frame[i0 + 3] < 16 || !isPlateRimWhite(frame[i0], frame[i0 + 1], frame[i0 + 2])) {
        y += 1;
        continue;
      }
      const y0 = y;
      while (
        y < fh &&
        frame[(y * fw + x) * 4 + 3] >= 16 &&
        isPlateRimWhite(frame[(y * fw + x) * 4], frame[(y * fw + x) * 4 + 1], frame[(y * fw + x) * 4 + 2])
      ) {
        y += 1;
      }
      const len = y - y0;
      if (len < minRun) continue;
      // Confirm column is isolated UI: neighbors left/right not also large jacket white
      for (let yy = y0; yy < y; yy += 1) {
        const i = (yy * fw + x) * 4;
        // Prefer copy from right body pixel
        let donor = -1;
        for (const dx of [1, 2, 3, -1, -2]) {
          const nx = x + dx;
          if (nx < 0 || nx >= fw) continue;
          const ni = (yy * fw + nx) * 4;
          if (frame[ni + 3] < 16) continue;
          if (isPlateRimWhite(frame[ni], frame[ni + 1], frame[ni + 2])) continue;
          if (isSolidLabelGrey(frame[ni], frame[ni + 1], frame[ni + 2])) continue;
          donor = ni;
          break;
        }
        if (donor < 0) {
          frame[i] = 0;
          frame[i + 1] = 0;
          frame[i + 2] = 0;
          frame[i + 3] = 0;
        } else {
          frame[i] = frame[donor];
          frame[i + 1] = frame[donor + 1];
          frame[i + 2] = frame[donor + 2];
          frame[i + 3] = 255;
        }
        fixed += 1;
      }
    }
  }
  return fixed;
}

/**
 * After cells extracted: reconstruct f0 mid-body from f1 if holes remain
 * or if residual pure-greyscale plate flecks survived.
 */
function healFrame0FromNeighbor(frame0, frame1, fw, fh) {
  let filled = 0;
  // Plate sits mid figure; also patch residual plate flecks. Do NOT overwrite hair blacks.
  const y0 = Math.floor(fh * 0.18);
  const y1 = Math.floor(fh * 0.82);
  for (let y = y0; y < y1; y += 1) {
    for (let x = 0; x < fw; x += 1) {
      const i = (y * fw + x) * 4;
      const a0 = frame0[i + 3];
      const hole = a0 < 16;
      const residualPlate =
        a0 >= 16 && isNamePanel(frame0[i], frame0[i + 1], frame0[i + 2]);
      if (!hole && !residualPlate) continue;
      if (frame1[i + 3] < 16) continue;
      // Never invent hair from empty; if f1 is hair black and f0 hole, OK to copy
      frame0[i] = frame1[i];
      frame0[i + 1] = frame1[i + 1];
      frame0[i + 2] = frame1[i + 2];
      frame0[i + 3] = 255;
      filled += 1;
    }
  }
  if (filled > 0) console.log(`hinata walk: healed ${filled}px mid-body from f1 into f0`);
  return filled;
}

function findBand(data, w, h) {
  const dy = new Array(h).fill(0);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (isContent(data, (y * w + x) * 4)) dy[y] += 1;
    }
  }
  let t = 0;
  let b = h;
  for (let y = 0; y < h; y += 1) {
    if (dy[y] > 10) {
      t = y;
      break;
    }
  }
  for (let y = h - 1; y >= 0; y -= 1) {
    if (dy[y] > 5) {
      b = y + 1;
      break;
    }
  }
  return { t, b };
}

function cellsFromContent(data, w, band) {
  const dens = new Array(w).fill(0);
  for (let x = 0; x < w; x += 1) {
    for (let y = band.t; y < band.b; y += 1) {
      if (isContent(data, (y * w + x) * 4)) dens[x] += 1;
    }
  }
  const thr = Math.max(2, Math.floor((band.b - band.t) * 0.03));
  const raw = [];
  let xs = -1;
  for (let x = 0; x <= w; x += 1) {
    const filled = x < w && dens[x] > thr;
    if (filled && xs < 0) xs = x;
    if (!filled && xs >= 0) {
      if (x - xs >= 8) raw.push({ l: xs, r: x });
      xs = -1;
    }
  }
  let runs = raw.filter((c) => c.r - c.l >= 12);
  const merged = [];
  for (const c of runs) {
    const prev = merged[merged.length - 1];
    if (prev && c.l - prev.r <= 2) prev.r = c.r;
    else merged.push({ ...c });
  }
  runs = merged;

  const widths = runs.map((c) => c.r - c.l);
  const medW =
    widths.slice().sort((a, b) => a - b)[Math.floor(widths.length / 2)] || 40;

  const out = [];
  for (const c of runs) {
    const cw = c.r - c.l;
    if (cw < medW * 1.55) {
      out.push({ l: c.l, r: c.r, t: band.t, b: band.b });
      continue;
    }
    const mid = Math.floor((c.l + c.r) / 2);
    let best = mid;
    let bestD = dens[mid] ?? 999;
    const lo = c.l + Math.floor(cw * 0.3);
    const hi = c.r - Math.floor(cw * 0.3);
    for (let x = lo; x <= hi; x += 1) {
      if (dens[x] < bestD) {
        bestD = dens[x];
        best = x;
      }
    }
    out.push({ l: c.l, r: best, t: band.t, b: band.b });
    out.push({ l: best, r: c.r, t: band.t, b: band.b });
  }

  return out.map((c) => ({
    l: Math.max(0, c.l - 1),
    r: Math.min(w, c.r + 1),
    t: band.t,
    b: band.b,
  }));
}

function extractCell(data, w, cell) {
  const fw = cell.r - cell.l;
  const fh = cell.b - cell.t;
  const frame = Buffer.alloc(fw * fh * 4);
  for (let y = 0; y < fh; y += 1) {
    for (let x = 0; x < fw; x += 1) {
      const si = ((cell.t + y) * w + cell.l + x) * 4;
      const di = (y * fw + x) * 4;
      if (!isContent(data, si)) {
        frame[di + 3] = 0;
        continue;
      }
      const r = data[si];
      const g = data[si + 1];
      const b = data[si + 2];
      if (isGreenBg(r, g, b) && greenness(r, g, b) >= 28 && r <= 50 && b <= 50) {
        frame[di + 3] = 0;
        continue;
      }
      frame[di] = r;
      frame[di + 1] = g;
      frame[di + 2] = b;
      frame[di + 3] = 255;
    }
  }
  let minX = fw;
  let maxX = -1;
  let minY = fh;
  let maxY = -1;
  for (let y = 0; y < fh; y += 1) {
    for (let x = 0; x < fw; x += 1) {
      if (frame[(y * fw + x) * 4 + 3] < 16) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) {
    return { frame, fw, fh, minX: 0, maxX: 0, minY: 0, maxY: 0, bw: 1, bh: 1 };
  }
  return {
    frame,
    fw,
    fh,
    minX,
    maxX,
    minY,
    maxY,
    bw: maxX - minX + 1,
    bh: maxY - minY + 1,
  };
}

function normalize(cut, pad = 2) {
  const cellW = Math.max(...cut.map((c) => c.bw)) + pad * 2;
  const cellH = Math.max(...cut.map((c) => c.bh)) + pad * 2;
  const contentH0 = Math.round(
    cut.slice(0, Math.min(2, cut.length)).reduce((s, c) => s + c.bh, 0) /
      Math.min(2, cut.length),
  );
  const frames = cut.map((box) => {
    const canvas = Buffer.alloc(cellW * cellH * 4);
    const dx = Math.floor((cellW - box.bw) / 2);
    const dy = cellH - box.bh - pad;
    for (let y = 0; y < box.bh; y += 1) {
      for (let x = 0; x < box.bw; x += 1) {
        const si = ((box.minY + y) * box.fw + box.minX + x) * 4;
        const di = ((dy + y) * cellW + dx + x) * 4;
        canvas[di] = box.frame[si];
        canvas[di + 1] = box.frame[si + 1];
        canvas[di + 2] = box.frame[si + 2];
        canvas[di + 3] = box.frame[si + 3];
      }
    }
    return canvas;
  });
  return { frames, cellW, cellH, contentHeight: contentH0 || cut[0].bh };
}

async function scaleFrames(frames, cellW, cellH, contentHeight, scaleOpts = { mode: 'match', metaPath: META_JSON, idleKey: 'hinata-idle' }) {
  const scale = resolveHqScale(contentHeight, scaleOpts);
  const outW = Math.max(1, Math.round(cellW * scale));
  const outH = Math.max(1, Math.round(cellH * scale));
  const outContent = resolvePackContentHeight(contentHeight, scale, scaleOpts);
  if (NATIVE_PIXELS) {
    console.log(`HQ scale=${scale.toFixed(4)} contentH=${outContent} cell ${cellW}x${cellH} → ${outW}x${outH}`);
  }
  const out = [];
  for (const frame of frames) {
    const { data: d } = await sharp(frame, {
      raw: { width: cellW, height: cellH, channels: 4 },
    })
      .resize(outW, outH, { kernel: sharp.kernel.nearest })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    for (let y = 0; y < outH; y += 1) {
      for (let x = 0; x < outW; x += 1) {
        const i = (y * outW + x) * 4;
        if (d[i + 3] < 16) continue;
        const r = d[i];
        const g = d[i + 1];
        const b = d[i + 2];
        const gn = greenness(r, g, b);
        if (gn < 8) continue;
        let edge = false;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= outW || ny >= outH) {
            edge = true;
            break;
          }
          if (d[(ny * outW + nx) * 4 + 3] < 16) {
            edge = true;
            break;
          }
        }
        if (edge && isGreenBg(r, g, b) && gn >= 22 && r <= 90 && b <= 90) {
          d[i] = 0;
          d[i + 1] = 0;
          d[i + 2] = 0;
          d[i + 3] = 0;
          continue;
        }
        if (edge && g > Math.max(r, b) + 6) {
          d[i + 1] = Math.max(r, b);
        }
      }
    }
    fillInteriorHoles(d, outW, outH, Math.max(16, Math.floor(outW * outH * 0.04)));
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 16) continue;
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      if (isGreenBg(r, g, b) && greenness(r, g, b) >= 18) {
        d[i + 1] = Math.max(r, b);
      }
    }
    out.push(d);
  }
  return { frames: out, frameWidth: outW, frameHeight: outH, contentHeight: outContent, scale };
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

function qaMetrics(sheetData, sheetW, fh, fw, n) {
  let residualGreen = 0;
  let opaque = 0;
  let pureBlackHair = 0;
  let headInteriorHoles = 0;
  let plateRimWhite = 0;
  let maxWhiteEdgeRun = 0;
  const footY = [];
  for (let f = 0; f < n; f += 1) {
    let maxFoot = -1;
    let pix = 0;
    let maxVrun = 0;
    let frameBlack = 0;
    let frameHeadHoles = 0;
    let frameRim = 0;
    // Leading-edge white column run (back of walk-RIGHT)
    let whiteLeadRun = 0;
    let whiteLeadMax = 0;
    for (let y = 0; y < fh; y += 1) {
      let x0 = -1;
      for (let x = 0; x < fw; x += 1) {
        if (sheetData[(y * sheetW + f * fw + x) * 4 + 3] >= 16) {
          x0 = x;
          break;
        }
      }
      if (x0 < 0) {
        whiteLeadMax = Math.max(whiteLeadMax, whiteLeadRun);
        whiteLeadRun = 0;
        continue;
      }
      const i = (y * sheetW + f * fw + x0) * 4;
      if (isPlateRimWhite(sheetData[i], sheetData[i + 1], sheetData[i + 2])) {
        whiteLeadRun += 1;
      } else {
        whiteLeadMax = Math.max(whiteLeadMax, whiteLeadRun);
        whiteLeadRun = 0;
      }
    }
    whiteLeadMax = Math.max(whiteLeadMax, whiteLeadRun);
    maxWhiteEdgeRun = Math.max(maxWhiteEdgeRun, whiteLeadMax);

    for (let x = 1; x < fw - 1; x += 1) {
      let run = 0;
      for (let y = 0; y < fh; y += 1) {
        const mid = sheetData[(y * sheetW + f * fw + x) * 4 + 3] < 16;
        const left = sheetData[(y * sheetW + f * fw + x - 1) * 4 + 3] >= 16;
        const right = sheetData[(y * sheetW + f * fw + x + 1) * 4 + 3] >= 16;
        if (mid && left && right) run += 1;
        else {
          maxVrun = Math.max(maxVrun, run);
          run = 0;
        }
      }
      maxVrun = Math.max(maxVrun, run);
    }
    // Head band: top ~38% — transparent with ≥6 opaque 8-neighbors = hole in hair volume
    const headY1 = Math.max(8, Math.floor(fh * 0.38));
    for (let y = 0; y < headY1; y += 1) {
      for (let x = 1; x < fw - 1; x += 1) {
        const i = (y * sheetW + f * fw + x) * 4;
        if (sheetData[i + 3] >= 16) continue;
        let near = 0;
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= fw || ny >= headY1) continue;
            if (sheetData[(ny * sheetW + f * fw + nx) * 4 + 3] >= 16) near += 1;
          }
        }
        if (near >= 6) frameHeadHoles += 1;
      }
    }
    for (let y = 0; y < fh; y += 1) {
      for (let x = 0; x < fw; x += 1) {
        const i = (y * sheetW + f * fw + x) * 4;
        if (sheetData[i + 3] < 16) continue;
        opaque += 1;
        pix += 1;
        const r = sheetData[i];
        const g = sheetData[i + 1];
        const b = sheetData[i + 2];
        if (isGreenBg(r, g, b) && greenness(r, g, b) >= 18) residualGreen += 1;
        if (r <= 16 && g <= 16 && b <= 16) {
          pureBlackHair += 1;
          frameBlack += 1;
        }
        if (isPlateRimWhite(r, g, b)) {
          plateRimWhite += 1;
          frameRim += 1;
        }
        if (y > maxFoot) maxFoot = y;
      }
    }
    footY.push(maxFoot);
    headInteriorHoles += frameHeadHoles;
    if (pix < 80) throw new Error(`Frame ${f} too empty (${pix}px)`);
    if (maxVrun >= 6) throw new Error(`Frame ${f} vertical gash run=${maxVrun}`);
    if (frameBlack < 20) {
      throw new Error(`Frame ${f} pure black hair too low (${frameBlack}px) — chromakey/name-panel regress?`);
    }
    if (frameHeadHoles > 4) {
      throw new Error(`Frame ${f} head interior holes=${frameHeadHoles} (hair gaps)`);
    }
    if (frameRim > 3) {
      throw new Error(`Frame ${f} plate-rim white pixels=${frameRim}`);
    }
    if (whiteLeadMax >= 4) {
      throw new Error(`Frame ${f} white leading-edge run=${whiteLeadMax}`);
    }
  }
  const feet = footY.filter((y) => y >= 0);
  const footMin = Math.min(...feet);
  const footMax = Math.max(...feet);
  return {
    residualGreen,
    opaque,
    pureBlackHair,
    headInteriorHoles,
    plateRimWhite,
    maxWhiteEdgeRun,
    footSpread: footMax - footMin,
    footY,
  };
}

async function writeQaCrops(sheet, scaled, qaDir) {
  fs.mkdirSync(qaDir, { recursive: true });
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
    .toFile(path.join(qaDir, 'walk-magenta-bg.png'));
  await sharp(sheet.data, {
    raw: { width: sheet.width, height: sheet.height, channels: 4 },
  })
    .png()
    .toFile(path.join(qaDir, 'walk-full.png'));

  for (let fi = 0; fi < scaled.frames.length; fi += 1) {
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
      raw: { width: scaled.frameWidth, height: scaled.frameHeight, channels: 4 },
    })
      .resize(scaled.frameWidth * 4, scaled.frameHeight * 4, { kernel: sharp.kernel.nearest })
      .png()
      .toFile(path.join(qaDir, `walk-frame-${fi}-x4.png`));
  }
}

async function main() {
  if (!fs.existsSync(INPUT)) throw new Error(`Sheet não encontrada: ${INPUT}`);
  const { data: raw, info } = await sharp(INPUT).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  // Work on a copy: remove name label BEFORE green key (label is body-covering).
  const pre = Buffer.from(raw);
  removeHinataNameLabel(pre, info.width, info.height);

  const data = keyGreenBackground(pre, info.width, info.height, {
    stripLabels: false,
    floodLabels: false,
  });

  const band = findBand(data, info.width, info.height);
  const cells = cellsFromContent(data, info.width, band);
  console.log(
    `hinata walk ${info.width}x${info.height} band ${band.t}-${band.b} cells=${cells.length} (hint ${HINT_EXPECTED})`,
    cells.map((c) => c.r - c.l).join(','),
  );
  if (cells.length < 4) throw new Error(`Poucos frames: ${cells.length}`);
  if (cells.length !== HINT_EXPECTED) {
    console.warn(
      `NOTE: source has ${cells.length} discrete figures (not ${HINT_EXPECTED}); exporting uncut islands.`,
    );
  }

  const cut = cells.map((c) => extractCell(data, info.width, c));
  for (let i = 0; i < cut.length; i += 1) {
    let n = 0;
    for (let p = 3; p < cut[i].frame.length; p += 4) if (cut[i].frame[p] >= 16) n += 1;
    if (n < 80) throw new Error(`Frame ${i} empty after chroma (${n}px)`);
    const speck = despeckleFrame(cut[i].frame, cut[i].fw, cut[i].fh, 28);
    if (speck > 0) console.log(`  despeckle frame ${i}: -${speck}px flecks`);
    // recompute bbox after despeckle
    let minX = cut[i].fw;
    let maxX = -1;
    let minY = cut[i].fh;
    let maxY = -1;
    for (let y = 0; y < cut[i].fh; y += 1) {
      for (let x = 0; x < cut[i].fw; x += 1) {
        if (cut[i].frame[(y * cut[i].fw + x) * 4 + 3] < 16) continue;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    if (maxX >= 0) {
      cut[i].minX = minX;
      cut[i].maxX = maxX;
      cut[i].minY = minY;
      cut[i].maxY = maxY;
      cut[i].bw = maxX - minX + 1;
      cut[i].bh = maxY - minY + 1;
    }
  }

  // Heal f0 mid-body from f1 if label left a gash (same cell geometry after normalize later —
  // do heal post-extract on raw cells at different sizes won't align; skip until normalize).

  const norm = normalize(cut);
  if (norm.frames.length >= 2) {
    healFrame0FromNeighbor(norm.frames[0], norm.frames[1], norm.cellW, norm.cellH);
    fillInteriorHoles(
      norm.frames[0],
      norm.cellW,
      norm.cellH,
      Math.max(24, Math.floor(norm.cellW * norm.cellH * 0.05)),
    );
    despeckleFrame(norm.frames[0], norm.cellW, norm.cellH, 22);
  }
  for (let i = 0; i < norm.frames.length; i += 1) {
    const rimCols = scrubPlateRimColumns(norm.frames[i], norm.cellW, norm.cellH, 5);
    if (rimCols > 0) console.log(`  scrub plate-rim columns f${i}: ${rimCols}px`);
    const n = scrubBackPlateStrip(norm.frames[i], norm.cellW, norm.cellH);
    if (n > 0) console.log(`  scrub back-plate strip f${i}: ${n}px`);
  }

  const scaled = await scaleFrames(norm.frames, norm.cellW, norm.cellH, norm.contentHeight);
  // Final pass post-scale: nearest can reintroduce 1–2px rim clones
  for (let i = 0; i < scaled.frames.length; i += 1) {
    const rimCols = scrubPlateRimColumns(
      scaled.frames[i],
      scaled.frameWidth,
      scaled.frameHeight,
      4,
    );
    const n = scrubBackPlateStrip(scaled.frames[i], scaled.frameWidth, scaled.frameHeight);
    if (rimCols + n > 0) {
      console.log(`  post-scale rim scrub f${i}: cols=${rimCols} edge=${n}`);
    }
  }
  const sheet = stitch(scaled.frames, scaled.frameWidth, scaled.frameHeight);
  const qa = qaMetrics(
    sheet.data,
    sheet.width,
    scaled.frameHeight,
    scaled.frameWidth,
    scaled.frames.length,
  );
  console.log(
    `QA residualGreen=${qa.residualGreen} opaque=${qa.opaque} pureBlackHair=${qa.pureBlackHair} headInteriorHoles=${qa.headInteriorHoles} footSpread=${qa.footSpread} plateRimWhite=${qa.plateRimWhite} maxWhiteEdgeRun=${qa.maxWhiteEdgeRun}`,
  );
  if (qa.residualGreen > 0) {
    throw new Error(`QA fail: residual green pixels = ${qa.residualGreen}`);
  }
  if (qa.pureBlackHair < 200) {
    throw new Error(`QA fail: pure black hair nearly gone (${qa.pureBlackHair}px)`);
  }
  if (qa.headInteriorHoles > 8) {
    throw new Error(`QA fail: head interior holes=${qa.headInteriorHoles}`);
  }
  if (qa.plateRimWhite > 4) {
    throw new Error(`QA fail: plate-rim white pixels = ${qa.plateRimWhite}`);
  }
  if (qa.maxWhiteEdgeRun >= 4) {
    throw new Error(`QA fail: white vertical edge run=${qa.maxWhiteEdgeRun}`);
  }
  if (qa.footSpread > 3) {
    console.warn(`WARN footSpread=${qa.footSpread}`);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  await sharp(sheet.data, {
    raw: { width: sheet.width, height: sheet.height, channels: 4 },
  })
    .png()
    .toFile(path.join(OUT_DIR, 'walk.png'));

  const entry = {
    image: '/sprites/player/hinata/walk.png',
    frameWidth: scaled.frameWidth,
    frameHeight: scaled.frameHeight,
    frameCount: scaled.frames.length,
    contentHeight: scaled.contentHeight,
    scale: scaled.scale,
    source: 'hinata-walk-sheet.png',
    frameRate: FRAME_RATE,
    residualGreen: qa.residualGreen,
    pureBlackHair: qa.pureBlackHair,
    headInteriorHoles: qa.headInteriorHoles,
    plateRimWhite: qa.plateRimWhite,
    maxWhiteEdgeRun: qa.maxWhiteEdgeRun,
    note: `${scaled.frames.length}-frame side walk RIGHT; plate+rim strip (not black hair); green exterior key`,
  };

  let meta = {};
  if (fs.existsSync(META_JSON)) {
    try {
      meta = JSON.parse(fs.readFileSync(META_JSON, 'utf8'));
    } catch {
      meta = {};
    }
  }
  meta['hinata-walk'] = entry;
  fs.writeFileSync(META_JSON, `${JSON.stringify(meta, null, 2)}\n`);

  await writeQaCrops(sheet, scaled, QA_DIR);

  console.log(
    `-> walk.png ${sheet.width}x${sheet.height} fw=${entry.frameWidth} fh=${entry.frameHeight} n=${entry.frameCount} contentH=${entry.contentHeight} scale=${entry.scale.toFixed(3)}`,
  );
  console.log(
    'Pack wire:',
    JSON.stringify({
      frameWidth: entry.frameWidth,
      frameHeight: entry.frameHeight,
      frameCount: entry.frameCount,
      contentHeight: entry.contentHeight,
    }),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
