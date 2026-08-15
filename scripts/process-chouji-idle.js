/**
 * Chouji idle — horizontal strip (breath + chips bag), green chroma exterior only.
 * Do not strip white scarf / bandage via isLabelPixel (stripLabels: false).
 *
 * HQ: absoluteScale = 1 (native pixels — max quality). contentHeight = idle body.
 * World size via contentHeight + displayScale (no art downsample).
 *
 * Cells: content-island detection (source has 17 discrete figures; forced equal-20
 * sliced through bodies — do NOT force equal cols on uneven spacing).
 *
 * npm run chouji:idle
 * Fonte: assets/naruto-source/nu/chouji-idle-sheet.png
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
const { resolveHqScale, resolvePackContentHeight, NATIVE_PIXELS } = require('./lib/chouji-hq-scale');

const ROOT = path.resolve(__dirname, '..');
const INPUT = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'chouji-idle-sheet.png');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'chouji');
const PREVIEW = path.join(ROOT, 'public', 'sprites', 'player', 'previews', 'chouji.png');
const META_JSON = path.join(OUT_DIR, 'meta.json');
const FRAME_RATE = 10;
/** Soft expectation for logging — real count comes from content islands. */
const HINT_EXPECTED = 20;

function greenness(r, g, b) {
  return g - Math.max(r, b);
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

/**
 * Content-island cells: density runs in band. Merge tiny noise.
 * Split only oversized double-width islands via density valley.
 */
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
  // drop noise flecks
  let runs = raw.filter((c) => c.r - c.l >= 12);
  // merge nearly-touching (breath contact)
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

  // split double-wide only
  const out = [];
  for (const c of runs) {
    const cw = c.r - c.l;
    if (cw < medW * 1.55) {
      out.push({ l: c.l, r: c.r, t: band.t, b: band.b });
      continue;
    }
    // valley split near midpoint
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

  // pad each cell with 1px of transparent margin so feet/arms aren't hard-clipped
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
      // Never keep pure exterior residual green inside cell crop
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

async function scaleFrames(frames, cellW, cellH, contentHeight, scaleOpts = {}) {
  const scale = resolveHqScale(contentHeight, scaleOpts);
  const outW = Math.max(1, Math.round(cellW * scale));
  const outH = Math.max(1, Math.round(cellH * scale));
  const outContent = resolvePackContentHeight(contentHeight, scale, scaleOpts);
  if (NATIVE_PIXELS) {
    console.log(
      `HQ idle scale=${scale.toFixed(4)} (native pixels) contentH=${outContent} cell ${cellW}x${cellH} → ${outW}x${outH}`,
    );
  }
  const out = [];
  for (const frame of frames) {
    // Identity resize when scale≈1 — nearest keeps crisp source pixels.
    const { data: d } = await sharp(frame, {
      raw: { width: cellW, height: cellH, channels: 4 },
    })
      .resize(outW, outH, { kernel: sharp.kernel.nearest })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Edge despill only — never zero body/scarf for “greenish” interior.
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
        // Strict residual green fringe → transparent
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
    // Final pass: any remaining isGreenBg with strong gn → despill (never hole interior)
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
  const footY = [];
  for (let f = 0; f < n; f += 1) {
    let maxFoot = -1;
    let pix = 0;
    // detect vertical chop: empty column between opaque (interior gash)
    let maxVrun = 0;
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
        if (y > maxFoot) maxFoot = y;
      }
    }
    footY.push(maxFoot);
    if (pix < 80) throw new Error(`Frame ${f} too empty (${pix}px)`);
    if (maxVrun >= 6) throw new Error(`Frame ${f} vertical gash run=${maxVrun}`);
  }
  const feet = footY.filter((y) => y >= 0);
  const footMin = Math.min(...feet);
  const footMax = Math.max(...feet);
  return { residualGreen, opaque, footSpread: footMax - footMin, footY };
}

async function writeQaCrops(sheet, scaled, qaDir) {
  fs.mkdirSync(qaDir, { recursive: true });
  // magenta composite for visual
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
    .toFile(path.join(qaDir, 'idle-magenta-bg.png'));

  await sharp(sheet.data, {
    raw: { width: sheet.width, height: sheet.height, channels: 4 },
  })
    .png()
    .toFile(path.join(qaDir, 'idle-full.png'));

  const mid = Math.floor(scaled.frames.length / 2);
  const indices = [0, mid, scaled.frames.length - 1];
  for (const fi of indices) {
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
      .toFile(path.join(qaDir, `frame-${fi}-x4.png`));

    // magenta zoom
    const magF = Buffer.alloc(scaled.frameWidth * scaled.frameHeight * 4);
    for (let i = 0; i < scaled.frameWidth * scaled.frameHeight; i += 1) {
      const j = i * 4;
      if (crop[j + 3] < 16) {
        magF[j] = 255;
        magF[j + 1] = 0;
        magF[j + 2] = 255;
        magF[j + 3] = 255;
      } else {
        magF[j] = crop[j];
        magF[j + 1] = crop[j + 1];
        magF[j + 2] = crop[j + 2];
        magF[j + 3] = 255;
      }
    }
    await sharp(magF, {
      raw: { width: scaled.frameWidth, height: scaled.frameHeight, channels: 4 },
    })
      .resize(scaled.frameWidth * 6, scaled.frameHeight * 6, { kernel: sharp.kernel.nearest })
      .png()
      .toFile(path.join(qaDir, `frame-${fi}-mag-x6.png`));
  }
}

async function main() {
  if (!fs.existsSync(INPUT)) throw new Error(`Sheet não encontrada: ${INPUT}`);
  const { data: raw, info } = await sharp(INPUT).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const data = keyGreenBackground(raw, info.width, info.height, {
    stripLabels: false,
    floodLabels: false,
  });
  const band = findBand(data, info.width, info.height);
  const cells = cellsFromContent(data, info.width, band);
  console.log(
    `chouji idle ${info.width}x${info.height} band ${band.t}-${band.b} cells=${cells.length} (hint ${HINT_EXPECTED})`,
    cells.map((c) => c.r - c.l).join(','),
  );
  if (cells.length < 8) throw new Error(`Poucos frames: ${cells.length}`);
  if (cells.length !== HINT_EXPECTED) {
    console.warn(
      `NOTE: source has ${cells.length} discrete figures (not ${HINT_EXPECTED}); exporting ${cells.length} uncut frames.`,
    );
  }

  const cut = cells.map((c) => extractCell(data, info.width, c));
  for (let i = 0; i < cut.length; i += 1) {
    let n = 0;
    for (let p = 3; p < cut[i].frame.length; p += 4) if (cut[i].frame[p] >= 16) n += 1;
    if (n < 80) throw new Error(`Frame ${i} empty after chroma (${n}px)`);
  }

  const norm = normalize(cut);
  const scaled = await scaleFrames(norm.frames, norm.cellW, norm.cellH, norm.contentHeight);
  const sheet = stitch(scaled.frames, scaled.frameWidth, scaled.frameHeight);
  const qa = qaMetrics(
    sheet.data,
    sheet.width,
    scaled.frameHeight,
    scaled.frameWidth,
    scaled.frames.length,
  );
  console.log(
    `QA residualGreen=${qa.residualGreen} opaque=${qa.opaque} footSpread=${qa.footSpread}`,
  );
  if (qa.residualGreen > 0) {
    throw new Error(`QA fail: residual green pixels = ${qa.residualGreen}`);
  }
  if (qa.footSpread > 3) {
    console.warn(`WARN footSpread=${qa.footSpread} (feet plant may bounce)`);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  await sharp(sheet.data, {
    raw: { width: sheet.width, height: sheet.height, channels: 4 },
  })
    .png()
    .toFile(path.join(OUT_DIR, 'idle.png'));

  const walk0 = scaled.frames[0];
  fs.mkdirSync(path.dirname(PREVIEW), { recursive: true });
  await sharp(walk0, {
    raw: { width: scaled.frameWidth, height: scaled.frameHeight, channels: 4 },
  })
    .png()
    .toFile(PREVIEW);

  const entry = {
    image: '/sprites/player/chouji/idle.png',
    frameWidth: scaled.frameWidth,
    frameHeight: scaled.frameHeight,
    frameCount: scaled.frames.length,
    contentHeight: scaled.contentHeight,
    scale: scaled.scale,
    source: 'chouji-idle-sheet.png',
    frameRate: FRAME_RATE,
    note: `${scaled.frames.length}-frame Part I idle (breath+chips); HQ nativePixels; green exterior key; RIGHT; content-island cells`,
  };

  let meta = {};
  if (fs.existsSync(META_JSON)) {
    try {
      meta = JSON.parse(fs.readFileSync(META_JSON, 'utf8'));
    } catch {
      meta = {};
    }
  }
  meta['chouji-idle'] = entry;
  // walk comes from process-chouji-walk.js — do not overwrite with idle f0
  fs.writeFileSync(META_JSON, `${JSON.stringify(meta, null, 2)}\n`);

  await writeQaCrops(sheet, scaled, path.join(ROOT, 'assets-src', '_qa', 'chouji'));

  console.log(
    `-> idle.png ${sheet.width}x${sheet.height} fw=${entry.frameWidth} fh=${entry.frameHeight} n=${entry.frameCount} contentH=${entry.contentHeight} scale=${entry.scale.toFixed(3)}`,
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
