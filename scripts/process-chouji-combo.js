/**
 * Chouji combo attack — horizontal punch(3) + kick(4) + multi-size fist finisher.
 * Green chroma exterior only; keep white scarf / arm bandages (stripLabels: false).
 *
 * Cells: density-island detection (do NOT force equal cols — fist frames are wider).
 * Export combo1/2/3 + full attack strip; same TARGET_BODY_H=48 bar as idle.
 *
 * npm run chouji:combo
 * Fonte: assets/naruto-source/nu/chouji-combo-sheet.png
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

const ROOT = path.resolve(__dirname, '..');
const INPUT = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'chouji-combo-sheet.png');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'chouji');
const META_JSON = path.join(OUT_DIR, 'meta.json');
const QA_DIR = path.join(ROOT, 'assets-src', '_qa', 'chouji');
const TARGET_BODY_H = 48;
const FRAME_RATE = 12;
/** Soft segments — punch / kick / finisher; finisher absorbs remainder. */
const SEG_HINT = [3, 4];
const HINT_EXPECTED = 16;

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
 * Never force equal-width grid — multi-size fist spans uneven cells.
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

  // Multi-size fist legitimately > 1.55× median — only split if a deep valley
  // exists near the midpoint AND island is > 2.0× median (true double).
  const out = [];
  for (const c of runs) {
    const cw = c.r - c.l;
    if (cw < medW * 2.0) {
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
    const peakLeft = Math.max(...dens.slice(c.l, best), 1);
    const peakRight = Math.max(...dens.slice(best, c.r), 1);
    const isValley = bestD <= Math.min(peakLeft, peakRight) * 0.35;
    if (!isValley) {
      out.push({ l: c.l, r: c.r, t: band.t, b: band.b });
      continue;
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
  // Standing body height from early punch frames (avoid giant-fist bounding box)
  const standN = Math.min(3, cut.length);
  const contentH0 = Math.round(
    cut.slice(0, standN).reduce((s, c) => s + c.bh, 0) / standN,
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
  const scale = TARGET_BODY_H / Math.max(1, contentHeight);
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

function qaMetrics(sheetData, sheetW, fh, fw, n, label = '') {
  let residualGreen = 0;
  let opaque = 0;
  const footY = [];
  for (let f = 0; f < n; f += 1) {
    let maxFoot = -1;
    let pix = 0;
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
    if (pix < 80) throw new Error(`${label}Frame ${f} too empty (${pix}px)`);
    if (maxVrun >= 6) throw new Error(`${label}Frame ${f} vertical gash run=${maxVrun}`);
  }
  const feet = footY.filter((y) => y >= 0);
  const footMin = Math.min(...feet);
  const footMax = Math.max(...feet);
  return { residualGreen, opaque, footSpread: footMax - footMin, footY };
}

async function writePng(file, data, width, height) {
  await sharp(data, { raw: { width, height, channels: 4 } }).png().toFile(file);
}

async function writeQaCrops(sheet, scaled, qaDir, prefix) {
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
  await writePng(path.join(qaDir, `${prefix}-magenta-bg.png`), mag, sheet.width, sheet.height);
  await writePng(path.join(qaDir, `${prefix}-full.png`), sheet.data, sheet.width, sheet.height);

  // Punch mid, kick arc, giant-fist peak, last recovery
  const n = scaled.frames.length;
  const indices = [
    0,
    Math.min(1, n - 1),
    Math.min(2, n - 1),
    Math.min(5, n - 1),
    Math.min(10, n - 1),
    Math.min(11, n - 1),
    Math.min(12, n - 1),
    n - 1,
  ];
  const unique = [...new Set(indices)];
  for (const fi of unique) {
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
      .toFile(path.join(qaDir, `${prefix}-frame-${fi}-x4.png`));

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
      .toFile(path.join(qaDir, `${prefix}-frame-${fi}-mag-x6.png`));
  }
}

function segmentSlices(total) {
  const a = SEG_HINT[0];
  const b = SEG_HINT[1];
  if (total < a + b + 1) {
    // Fall back: single full strip as combo1
    return [
      { name: 'combo1', from: 0, to: total },
      { name: 'combo2', from: 0, to: 0 },
      { name: 'combo3', from: 0, to: 0 },
    ];
  }
  return [
    { name: 'combo1', from: 0, to: a },
    { name: 'combo2', from: a, to: a + b },
    { name: 'combo3', from: a + b, to: total },
  ];
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
    `chouji combo ${info.width}x${info.height} band ${band.t}-${band.b} cells=${cells.length} (hint ${HINT_EXPECTED})`,
    cells.map((c) => c.r - c.l).join(','),
  );
  if (cells.length < 8) throw new Error(`Poucos frames: ${cells.length}`);
  if (cells.length !== HINT_EXPECTED) {
    console.warn(
      `NOTE: source has ${cells.length} discrete figures (not ${HINT_EXPECTED}); exporting uncut content islands.`,
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

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(QA_DIR, { recursive: true });

  let meta = {};
  if (fs.existsSync(META_JSON)) {
    try {
      meta = JSON.parse(fs.readFileSync(META_JSON, 'utf8'));
    } catch {
      meta = {};
    }
  }

  const fullSheet = stitch(scaled.frames, scaled.frameWidth, scaled.frameHeight);
  const fullQa = qaMetrics(
    fullSheet.data,
    fullSheet.width,
    scaled.frameHeight,
    scaled.frameWidth,
    scaled.frames.length,
    'attack/',
  );
  console.log(
    `QA full residualGreen=${fullQa.residualGreen} opaque=${fullQa.opaque} footSpread=${fullQa.footSpread}`,
  );
  if (fullQa.residualGreen > 0) {
    throw new Error(`QA fail: residual green pixels = ${fullQa.residualGreen}`);
  }
  if (fullQa.footSpread > 6) {
    console.warn(`WARN footSpread=${fullQa.footSpread} (kick/jump may lift feet)`);
  }

  await writePng(path.join(OUT_DIR, 'attack.png'), fullSheet.data, fullSheet.width, fullSheet.height);
  await writeQaCrops(fullSheet, scaled, QA_DIR, 'combo');

  const slices = segmentSlices(scaled.frames.length);
  const wire = {};
  for (const slice of slices) {
    const frames = scaled.frames.slice(slice.from, slice.to);
    if (!frames.length) continue;
    const sheet = stitch(frames, scaled.frameWidth, scaled.frameHeight);
    const qa = qaMetrics(
      sheet.data,
      sheet.width,
      scaled.frameHeight,
      scaled.frameWidth,
      frames.length,
      `${slice.name}/`,
    );
    if (qa.residualGreen > 0) {
      throw new Error(`${slice.name} residual green = ${qa.residualGreen}`);
    }
    await writePng(path.join(OUT_DIR, `${slice.name}.png`), sheet.data, sheet.width, sheet.height);
    const entry = {
      image: `/sprites/player/chouji/${slice.name}.png`,
      frameWidth: scaled.frameWidth,
      frameHeight: scaled.frameHeight,
      frameCount: frames.length,
      contentHeight: scaled.contentHeight,
      scale: scaled.scale,
      source: 'chouji-combo-sheet.png',
      frameRate: FRAME_RATE,
      note:
        slice.name === 'combo1'
          ? 'punch (3f)'
          : slice.name === 'combo2'
            ? 'kick (4f)'
            : `multi-size fist finisher (${frames.length}f)`,
    };
    meta[`chouji-${slice.name}`] = entry;
    wire[slice.name] = {
      frameWidth: entry.frameWidth,
      frameHeight: entry.frameHeight,
      frameCount: entry.frameCount,
      contentHeight: entry.contentHeight,
    };
    console.log(
      `-> ${slice.name}.png ${sheet.width}x${sheet.height} n=${entry.frameCount} fw=${entry.frameWidth} fh=${entry.frameHeight} residualGreen=${qa.residualGreen}`,
    );
  }

  meta['chouji-attack'] = {
    image: '/sprites/player/chouji/attack.png',
    frameWidth: scaled.frameWidth,
    frameHeight: scaled.frameHeight,
    frameCount: scaled.frames.length,
    contentHeight: scaled.contentHeight,
    scale: scaled.scale,
    source: 'chouji-combo-sheet.png',
    frameRate: FRAME_RATE,
    note: `full combo1+2+3 strip (${scaled.frames.length}f); green exterior key; content-island cells`,
  };
  fs.writeFileSync(META_JSON, `${JSON.stringify(meta, null, 2)}\n`);

  console.log(
    `-> attack.png ${fullSheet.width}x${fullSheet.height} fw=${scaled.frameWidth} fh=${scaled.frameHeight} n=${scaled.frames.length} contentH=${scaled.contentHeight} scale=${scaled.scale.toFixed(3)}`,
  );
  console.log('Pack wire:', JSON.stringify(wire, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
