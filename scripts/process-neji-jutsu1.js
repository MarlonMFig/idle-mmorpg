/**
 * Neji Jutsu 1 — Hakkeshou Kaiten (yellow energy dome sheet).
 * Cyan/teal + dark magenta exterior key; preserve yellow dome.
 *
 * npm run neji:jutsu1
 * Fonte: assets/naruto-source/nu/neji-kaiten-sheet.png
 * Saída: public/sprites/player/neji/kaiten.png
 *
 * Layout (auto-detect):
 *  crouch startup · spin start · multiple dome loop rows · recovery · final stance
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const {
  keyExteriorChroma,
  isContent,
  isYellowEnergy,
  isCyanTealBg,
  isMagentaBg,
  fillInteriorHoles,
} = require('./lib/neji-chroma');

const ROOT = path.resolve(__dirname, '..');
const INPUT = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'neji-kaiten-sheet.png');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'neji');
const META_JSON = path.join(OUT_DIR, 'meta.json');
const TARGET_BODY_H = 48;
const FRAME_RATE = 12;
const MAX_SHEET_W = 4096;

function rowContentCount(data, w, y) {
  let n = 0;
  for (let x = 0; x < w; x += 1) {
    if (isContent(data, (y * w + x) * 4)) n += 1;
  }
  return n;
}

function findBands(data, w, h, minDy = 18, minH = 28) {
  const dy = new Array(h).fill(0);
  for (let y = 0; y < h; y += 1) dy[y] = rowContentCount(data, w, y);
  const bands = [];
  let on = false;
  let start = 0;
  for (let y = 0; y <= h; y += 1) {
    const filled = y < h && dy[y] > minDy;
    if (filled && !on) {
      on = true;
      start = y;
    }
    if (!filled && on) {
      if (y - start >= minH) bands.push({ t: start, b: y });
      on = false;
    }
  }
  return bands;
}

/** Split tall multi-dome band using yellow-energy row density valleys. */
function splitDomeSubrows(data, w, band) {
  const ye = new Array(band.b - band.t).fill(0);
  for (let y = band.t; y < band.b; y += 1) {
    let n = 0;
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      if (data[i + 3] < 16) continue;
      if (isYellowEnergy(data[i], data[i + 1], data[i + 2])) n += 1;
    }
    ye[y - band.t] = n;
  }
  const thr = 15;
  const subs = [];
  let on = false;
  let start = 0;
  for (let i = 0; i <= ye.length; i += 1) {
    const filled = i < ye.length && ye[i] > thr;
    if (filled && !on) {
      on = true;
      start = i;
    }
    if (!filled && on) {
      if (i - start >= 40) subs.push({ t: band.t + start, b: band.t + i });
      on = false;
    }
  }
  return subs.length >= 2 ? subs : [band];
}

function cellsInBand(data, w, band, minW = 18, expected = 0) {
  const dens = new Array(w).fill(0);
  const h = band.b - band.t;
  for (let x = 0; x < w; x += 1) {
    for (let y = band.t; y < band.b; y += 1) {
      if (isContent(data, (y * w + x) * 4)) dens[x] += 1;
    }
  }
  // Prefer yellow energy density for dome rows (cleaner gaps between orbs)
  const densY = new Array(w).fill(0);
  let yellowPx = 0;
  for (let x = 0; x < w; x += 1) {
    for (let y = band.t; y < band.b; y += 1) {
      const i = (y * w + x) * 4;
      if (data[i + 3] < 16) continue;
      if (isYellowEnergy(data[i], data[i + 1], data[i + 2])) {
        densY[x] += 1;
        yellowPx += 1;
      }
    }
  }
  // Dome rows: prefer yellow density (gaps between orbs). Mixed/recovery: full content.
  const contentPx = dens.reduce((s, v) => s + v, 0);
  const useDens = yellowPx > h * 40 && yellowPx > contentPx * 0.45 ? densY : dens;
  const thr = Math.max(3, Math.floor(h * (useDens === densY ? 0.08 : 0.05)));
  const raw = [];
  let xs = -1;
  for (let x = 0; x <= w; x += 1) {
    const filled = x < w && useDens[x] > thr;
    if (filled && xs < 0) xs = x;
    if (!filled && xs >= 0) {
      if (x - xs >= minW) raw.push({ l: xs, r: x, t: band.t, b: band.b });
      xs = -1;
    }
  }
  const merged = [];
  for (const c of raw) {
    const prev = merged[merged.length - 1];
    if (prev && c.l - prev.r <= 5) prev.r = c.r;
    else merged.push({ ...c });
  }

  let out = merged.filter((c) => c.r - c.l >= minW);

  // Split overwide cells (multiple domes glued) using dens valleys
  const splitWide = [];
  const medW =
    out.length > 0
      ? out.map((c) => c.r - c.l).sort((a, b) => a - b)[Math.floor(out.length / 2)]
      : 95;
  for (const c of out) {
    const cw = c.r - c.l;
    if (cw <= medW * 1.55 && cw <= 140) {
      splitWide.push(c);
      continue;
    }
    const local = useDens.slice(c.l, c.r);
    const maxD = Math.max(...local, 1);
    const cutThr = maxD * 0.22;
    const sm = local.map((_, i) => {
      let s = 0;
      let n = 0;
      for (let k = -2; k <= 2; k += 1) {
        if (local[i + k] != null) {
          s += local[i + k];
          n += 1;
        }
      }
      return s / n;
    });
    let x0 = 0;
    const subs = [];
    for (let i = 1; i < sm.length; i += 1) {
      if (sm[i] < cutThr && i - x0 >= 55) {
        subs.push({ l: c.l + x0, r: c.l + i, t: c.t, b: c.b });
        x0 = i;
      }
    }
    if (sm.length - x0 >= 40) subs.push({ l: c.l + x0, r: c.r, t: c.t, b: c.b });
    if (subs.length >= 2) {
      splitWide.push(...subs);
    } else {
      const n = Math.max(2, Math.round(cw / Math.max(70, medW)));
      for (let i = 0; i < n; i += 1) {
        splitWide.push({
          l: Math.round(c.l + (i * cw) / n),
          r: Math.round(c.l + ((i + 1) * cw) / n),
          t: c.t,
          b: c.b,
        });
      }
    }
  }
  out = splitWide.filter((c) => c.r - c.l >= minW);

  // Forced equal split if one mega-blob
  if (out.length === 1 && out[0].r - out[0].l > 160) {
    const span = out[0].r - out[0].l;
    const n = expected > 0 ? expected : Math.max(2, Math.round(span / 95));
    const L = out[0].l;
    const forced = [];
    for (let i = 0; i < n; i += 1) {
      forced.push({
        l: Math.round(L + (i * span) / n),
        r: Math.round(L + ((i + 1) * span) / n),
        t: band.t,
        b: band.b,
      });
    }
    out = forced;
  }

  if (expected > 0 && out.length > 0 && out.length !== expected) {
    const L = out[0].l;
    const R = out[out.length - 1].r;
    const span = R - L;
    const avg = span / expected;
    const bad =
      out.length !== expected ||
      out.some((c) => c.r - c.l > avg * 1.7 || c.r - c.l < avg * 0.35);
    if (bad && avg >= 28) {
      const forced = [];
      for (let i = 0; i < expected; i += 1) {
        forced.push({
          l: Math.round(L + (i * span) / expected),
          r: Math.round(L + ((i + 1) * span) / expected),
          t: band.t,
          b: band.b,
        });
      }
      out = forced;
    }
  }

  return out;
}

function stripFringeLines(frame, fw, fh) {
  // Kill thin cyan/magenta scanlines left from sheet grid dividers.
  for (let y = 0; y < fh; y += 1) {
    let fringe = 0;
    let op = 0;
    for (let x = 0; x < fw; x += 1) {
      const i = (y * fw + x) * 4;
      if (frame[i + 3] < 16) continue;
      op += 1;
      const r = frame[i];
      const g = frame[i + 1];
      const b = frame[i + 2];
      if (isYellowEnergy(r, g, b)) continue;
      if (isCyanTealBg(r, g, b) || isMagentaBg(r, g, b)) fringe += 1;
      else if (r <= 80 && g >= 100 && b >= 100 && Math.min(g, b) > r + 20) fringe += 1;
    }
    if (op > 0 && fringe >= op * 0.55 && fringe >= 3) {
      for (let x = 0; x < fw; x += 1) frame[(y * fw + x) * 4 + 3] = 0;
    }
  }
  // Edge despill pass (outer ring).
  for (let y = 0; y < fh; y += 1) {
    for (let x = 0; x < fw; x += 1) {
      const i = (y * fw + x) * 4;
      if (frame[i + 3] < 16) continue;
      const r = frame[i];
      const g = frame[i + 1];
      const b = frame[i + 2];
      if (isYellowEnergy(r, g, b)) continue;
      if (!(isCyanTealBg(r, g, b) || isMagentaBg(r, g, b))) {
        // light mauve/red fringe only near empty
        const magish = r >= 80 && g <= 100 && b >= 50 && r > g + 20 && !isYellowEnergy(r, g, b);
        const tealish = g > r + 15 && b > r + 10 && g >= 90;
        if (!magish && !tealish) continue;
      }
      let nearEmpty = false;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= fw || ny >= fh) {
          nearEmpty = true;
          break;
        }
        if (frame[(ny * fw + nx) * 4 + 3] < 16) {
          nearEmpty = true;
          break;
        }
      }
      if (nearEmpty) frame[i + 3] = 0;
    }
  }
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
      frame[di] = data[si];
      frame[di + 1] = data[si + 1];
      frame[di + 2] = data[si + 2];
      frame[di + 3] = 255;
    }
  }
  stripFringeLines(frame, fw, fh);
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
  // Standing body from early crouch frames (not huge dome)
  const standing = cut.slice(0, Math.min(5, cut.length));
  const bodyHeights = standing.map((c) => c.bh).sort((a, b) => a - b);
  // Use median of small frames for contentHeight anchor
  const small = bodyHeights.filter((h) => h <= bodyHeights[0] + 30);
  const contentH0 = Math.round(
    (small.length ? small : bodyHeights).reduce((s, h) => s + h, 0) /
      Math.max(1, small.length || bodyHeights.length),
  );
  const frames = cut.map((box) => {
    const canvas = Buffer.alloc(cellW * cellH * 4);
    const dx = Math.floor((cellW - box.bw) / 2);
    const dy = cellH - box.bh - pad;
    for (let y = 0; y < box.bh; y += 1) {
      for (let x = 0; x < box.bw; x += 1) {
        const si = ((box.minY + y) * box.fw + (box.minX + x)) * 4;
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

async function scaleFrames(frames, cellW, cellH, contentHeight) {
  // Fit standing body to TARGET_BODY_H; dome keeps relative size in the cell.
  // Only cap height (not width) so Phaser sheets stay practical.
  let scale = TARGET_BODY_H / Math.max(1, contentHeight);
  const maxH = 120;
  if (cellH * scale > maxH) scale = maxH / cellH;
  const outW = Math.max(1, Math.round(cellW * scale));
  const outH = Math.max(1, Math.round(cellH * scale));
  const outContent = Math.max(1, Math.round(contentHeight * scale));
  const out = [];
  for (const frame of frames) {
    const { data: d } = await sharp(frame, {
      raw: { width: cellW, height: cellH, channels: 4 },
    })
      .resize(outW, outH, { kernel: sharp.kernel.nearest })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    fillInteriorHoles(d, outW, outH, Math.max(64, Math.floor(outW * outH * 0.04)));
    out.push(d);
  }
  return { frames: out, frameWidth: outW, frameHeight: outH, contentHeight: outContent, scale };
}

function stitch(frames, fw, fh) {
  const cols =
    fw * frames.length <= MAX_SHEET_W
      ? frames.length
      : Math.max(1, Math.floor(MAX_SHEET_W / fw));
  const rows = Math.ceil(frames.length / cols);
  const outW = cols * fw;
  const outH = rows * fh;
  const out = Buffer.alloc(outW * outH * 4);
  frames.forEach((frame, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    for (let y = 0; y < fh; y += 1) {
      frame.copy(out, ((row * fh + y) * outW + col * fw) * 4, y * fw * 4, (y + 1) * fw * 4);
    }
  });
  return { data: out, width: outW, height: outH, cols, rows };
}

async function main() {
  if (!fs.existsSync(INPUT)) throw new Error(`Sheet não encontrada: ${INPUT}`);
  const { data: raw, info } = await sharp(INPUT).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  console.log(`kaiten source ${info.width}x${info.height}`);

  const data = keyExteriorChroma(raw, info.width, info.height, { magenta: true, maxHole: 220 });

  let bands = findBands(data, info.width, info.height, 16, 30);
  // Expand tall bands into dome sub-rows
  const expanded = [];
  for (const band of bands) {
    if (band.b - band.t > 120) {
      const subs = splitDomeSubrows(data, info.width, band);
      expanded.push(...subs);
    } else {
      expanded.push(band);
    }
  }
  // Pad short crouch bands so hair is not clipped
  bands = expanded
    .filter((b) => b.b - b.t >= 40)
    .map((b) => ({
      t: Math.max(0, b.t - 6),
      b: Math.min(info.height, b.b + 2),
    }));
  console.log(
    'bands',
    bands.map((b) => `${b.t}-${b.b}(h${b.b - b.t})`).join(' | '),
  );

  const cells = [];
  for (const band of bands) {
    let rowCells = cellsInBand(data, info.width, band, 16, 0);
    // Recovery strip: ensure small end-stance cells aren't dropped / over-merged
    if (band.t >= 780 && band.b - band.t >= 70) {
      const dens = new Array(info.width).fill(0);
      for (let x = 0; x < info.width; x += 1) {
        for (let y = band.t; y < band.b; y += 1) {
          if (isContent(data, (y * info.width + x) * 4)) dens[x] += 1;
        }
      }
      const thr = 2;
      const raw = [];
      let xs = -1;
      for (let x = 0; x <= info.width; x += 1) {
        const filled = x < info.width && dens[x] > thr;
        if (filled && xs < 0) xs = x;
        if (!filled && xs >= 0) {
          if (x - xs >= 10) raw.push({ l: xs, r: x, t: band.t, b: band.b });
          xs = -1;
        }
      }
      // Merge only ultra-narrow crumbs into neighbors (< 10 already filtered)
      const merged = [];
      for (const c of raw) {
        const prev = merged[merged.length - 1];
        if (prev && c.l - prev.r <= 3 && c.r - c.l < 12) prev.r = c.r;
        else if (prev && c.l - prev.r <= 3 && prev.r - prev.l < 12) prev.r = c.r;
        else merged.push({ ...c });
      }
      if (merged.length >= 5) {
        rowCells = merged;
        console.log('  recovery dens cells', merged.length, merged.map((c) => c.r - c.l).join(','));
      }
    }
    // Filter junk: edge-clipped fragments, empty cells, incomplete heads
    const cuts = rowCells.map((c) => ({ cell: c, cut: extractCell(data, info.width, c) }));
    const heights = cuts.map((x) => x.cut.bh).filter((h) => h >= 20).sort((a, b) => a - b);
    const medH = heights.length ? heights[Math.floor(heights.length / 2)] : 40;
    const isCrouchish = band.b - band.t < 75 && band.t < 200;
    const isRecovery = band.t >= 780;
    const good = cuts
      .filter(({ cell, cut }) => {
        if (cut.bw < 10 || cut.bh < 16) return false;
        // First cell glued to sheet left edge: partial crouch without head
        if (isCrouchish && cell.l <= 4) return false;
        if (!isRecovery && cuts.length >= 3 && cut.bh < medH * 0.55) return false;
        let op = 0;
        for (let i = 3; i < cut.frame.length; i += 4) if (cut.frame[i] >= 16) op += 1;
        if (isRecovery) return op >= 30;
        if (op < 50) return false;
        return true;
      })
      .map((x) => x.cell);
    console.log(
      `  row ${band.t}-${band.b}: n=${good.length}`,
      good.map((c) => `${c.r - c.l}x${band.b - band.t}`).join(','),
    );
    cells.push(...good);
  }

  console.log(`total frames ${cells.length}`);
  if (cells.length < 12) throw new Error(`Poucos frames Kaiten: ${cells.length}`);

  const cut = cells.map((c) => extractCell(data, info.width, c));
  // Drop near-empty after final fringe strip
  const filtered = cut.filter((c) => {
    let n = 0;
    for (let i = 3; i < c.frame.length; i += 4) if (c.frame[i] >= 16) n += 1;
    return n >= 40;
  });
  if (filtered.length < 12) throw new Error(`Muitos frames vazios após chroma: ${cut.length - filtered.length}`);

  const norm = normalize(filtered);
  console.log(
    `normalized cell ${norm.cellW}x${norm.cellH} bodyH≈${norm.contentHeight} maxBh=${Math.max(...cut.map((c) => c.bh))}`,
  );
  const scaled = await scaleFrames(norm.frames, norm.cellW, norm.cellH, norm.contentHeight);
  const sheet = stitch(scaled.frames, scaled.frameWidth, scaled.frameHeight);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  await sharp(sheet.data, {
    raw: { width: sheet.width, height: sheet.height, channels: 4 },
  })
    .png()
    .toFile(path.join(OUT_DIR, 'kaiten.png'));

  const durationMs = Math.round((scaled.frames.length / FRAME_RATE) * 1000);
  const entry = {
    image: '/sprites/player/neji/kaiten.png',
    frameWidth: scaled.frameWidth,
    frameHeight: scaled.frameHeight,
    frameCount: scaled.frames.length,
    sheetCols: sheet.cols,
    sheetRows: sheet.rows,
    contentHeight: scaled.contentHeight,
    scale: scaled.scale,
    source: 'neji-kaiten-sheet.png',
    frameRate: FRAME_RATE,
    durationMs,
    hitDelayMs: Math.round(durationMs * 0.45),
    note: 'Hakkeshou Kaiten full sequence; yellow dome preserved; cyan+magenta exterior key',
  };

  let meta = {};
  if (fs.existsSync(META_JSON)) {
    try {
      meta = JSON.parse(fs.readFileSync(META_JSON, 'utf8'));
    } catch {
      meta = {};
    }
  }
  meta['neji-kaiten'] = entry;
  meta['skill-hakke-kaiten'] = entry;
  fs.writeFileSync(META_JSON, `${JSON.stringify(meta, null, 2)}\n`);

  console.log(
    `-> kaiten.png ${sheet.width}x${sheet.height} fw=${entry.frameWidth} fh=${entry.frameHeight} n=${entry.frameCount} contentH=${entry.contentHeight} durationMs=${durationMs}`,
  );
  console.log(
    'Pack wire:',
    JSON.stringify({
      key: 'neji-kaiten',
      frameWidth: entry.frameWidth,
      frameHeight: entry.frameHeight,
      frameCount: entry.frameCount,
      contentHeight: entry.contentHeight,
      durationMs,
      hitDelayMs: entry.hitDelayMs,
    }),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
