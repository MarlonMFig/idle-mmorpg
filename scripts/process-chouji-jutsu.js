/**
 * Chouji Nikudan Sensha (Human Bullet Tank) — seal→expand + spin sheets
 * concatenated into one skill strip.
 *
 * Exterior green chroma only; stripLabels false (white scarf/bandages).
 * Content-island frame detect — never force wrong N.
 * Scale from standing body height → contentHeight 48; giant ball may use taller frames.
 *
 * npm run chouji:jutsu
 * Fontes:
 *   assets/naruto-source/nu/chouji-nikudan-seal-sheet.png
 *   assets/naruto-source/nu/chouji-nikudan-spin-sheet.png
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
const SEAL_INPUT = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'chouji-nikudan-seal-sheet.png');
const SPIN_INPUT = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'chouji-nikudan-spin-sheet.png');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'chouji');
const META_JSON = path.join(OUT_DIR, 'meta.json');
const QA_DIR = path.join(ROOT, 'assets-src', '_qa', 'chouji');
const OUT_NAME = 'nikudan-sensha.png';
/** Standing body target height (pack-coherent). Big ball exceeds frame accordingly. */
const TARGET_BODY_H = 48;
const FRAME_RATE = 12;

function greenness(r, g, b) {
  return g - Math.max(r, b);
}

/** Dark purple/blue stray flecks often left under ball feet on spin sheet. */
function isPurpleStray(r, g, b) {
  // dark cool-biased flecks under ball (not headband blue, not warm skin)
  const avg = (r + g + b) / 3;
  if (avg > 100) return false;
  if (b < 28) return false;
  if (b <= Math.max(r, g) + 10) return false;
  // purple family: blue dominant, red secondary over green OR pure dark blue-violet
  const cool = b > r && b > g;
  const violet = cool && r >= g - 5;
  const darkBlue = cool && g <= r + 15 && b >= 40;
  if (!violet && !darkBlue) return false;
  if (r > 95 || g > 85) return false;
  return true;
}

/** Remove purple foot flecks (edge or near bottom). */
function cleanPurpleFeet(d, outW, outH) {
  for (let y = 0; y < outH; y += 1) {
    for (let x = 0; x < outW; x += 1) {
      const i = (y * outW + x) * 4;
      if (d[i + 3] < 16) continue;
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      if (!isPurpleStray(r, g, b)) continue;
      const nearBottom = y >= Math.floor(outH * 0.7);
      let edge = nearBottom;
      if (!edge) {
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
          [1, 1],
          [-1, 1],
          [1, -1],
          [-1, -1],
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
      }
      if (!edge) continue;
      d[i] = 0;
      d[i + 1] = 0;
      d[i + 2] = 0;
      d[i + 3] = 0;
    }
  }
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
    // spin blur discs can nearly touch — only merge if very close gap
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
    // Ball frames are wider than standing — only split true doubles
    if (cw < medW * 1.65) {
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
    // only split if valley is real (not flat ball)
    if (bestD <= Math.max(4, medW * 0.08)) {
      out.push({ l: c.l, r: best, t: band.t, b: band.b });
      out.push({ l: best, r: c.r, t: band.t, b: band.b });
    } else {
      out.push({ l: c.l, r: c.r, t: band.t, b: band.b });
    }
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
      // strip purple foot fringe only near bottom 18% of cell when isolated-ish
      const nearFoot = y >= Math.floor(fh * 0.82);
      if (nearFoot && isPurpleStray(r, g, b)) {
        // keep if surrounded by warm body (tan ball) — only cut isolated strays
        let neighBody = 0;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= fw || ny >= fh) continue;
          const ni = ((cell.t + ny) * w + (cell.l + nx)) * 4;
          if (!isContent(data, ni)) continue;
          const nr = data[ni];
          const ng = data[ni + 1];
          const nb = data[ni + 2];
          // tan/red ball or white bandage
          if (nr >= 120 && ng >= 80 && nb <= 120) neighBody += 1;
          if (nr >= 180 && ng >= 180 && nb >= 180) neighBody += 1;
        }
        if (neighBody === 0) {
          frame[di + 3] = 0;
          continue;
        }
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

function normalize(cut, pad = 2, standingH) {
  const cellW = Math.max(...cut.map((c) => c.bw)) + pad * 2;
  const cellH = Math.max(...cut.map((c) => c.bh)) + pad * 2;
  const contentH0 =
    standingH ||
    Math.round(
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
        if (gn < 8 && !isPurpleStray(r, g, b)) continue;
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
        if (edge && isPurpleStray(r, g, b) && y >= Math.floor(outH * 0.75)) {
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
    cleanPurpleFeet(d, outW, outH);
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
  let residualPurpleStray = 0;
  let opaque = 0;
  for (let f = 0; f < n; f += 1) {
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
        // isolated foot purple after scale (bottom 4 rows, no warm neighbor)
        if (y >= fh - 4 && isPurpleStray(r, g, b)) residualPurpleStray += 1;
      }
    }
    if (pix < 40) throw new Error(`Frame ${f} too empty (${pix}px)`);
    // wider ball frames may have thin spin gaps — only fail deep body gashes
    if (maxVrun >= 10) throw new Error(`Frame ${f} vertical gash run=${maxVrun}`);
  }
  return { residualGreen, residualPurpleStray, opaque };
}

async function processSheet(inputPath, label) {
  if (!fs.existsSync(inputPath)) throw new Error(`Sheet não encontrada: ${inputPath}`);
  const { data: raw, info } = await sharp(inputPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const data = keyGreenBackground(raw, info.width, info.height, {
    stripLabels: false,
    floodLabels: false,
  });
  const band = findBand(data, info.width, info.height);
  const cells = cellsFromContent(data, info.width, band);
  console.log(
    `chouji ${label} ${info.width}x${info.height} band ${band.t}-${band.b} cells=${cells.length}`,
    cells.map((c) => c.r - c.l).join(','),
  );
  if (cells.length < 4) throw new Error(`${label}: poucos frames: ${cells.length}`);
  const cut = cells.map((c) => extractCell(data, info.width, c));
  for (let i = 0; i < cut.length; i += 1) {
    let n = 0;
    for (let p = 3; p < cut[i].frame.length; p += 4) if (cut[i].frame[p] >= 16) n += 1;
    if (n < 40) throw new Error(`${label} frame ${i} empty after chroma (${n}px)`);
  }
  return { cut, band, cellCount: cells.length };
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
    .toFile(path.join(qaDir, 'nikudan-magenta-bg.png'));

  await sharp(sheet.data, {
    raw: { width: sheet.width, height: sheet.height, channels: 4 },
  })
    .png()
    .toFile(path.join(qaDir, 'nikudan-full.png'));

  // Sample: first standing, mid expand, first spin, last spin
  const n = scaled.frames.length;
  const indices = [0, Math.min(8, n - 1), Math.min(13, n - 1), Math.floor(n / 2), n - 1];
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
      .resize(scaled.frameWidth * 3, scaled.frameHeight * 3, { kernel: sharp.kernel.nearest })
      .png()
      .toFile(path.join(qaDir, `nikudan-frame-${fi}-x3.png`));

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
      .resize(scaled.frameWidth * 4, scaled.frameHeight * 4, { kernel: sharp.kernel.nearest })
      .png()
      .toFile(path.join(qaDir, `nikudan-frame-${fi}-mag-x4.png`));
  }
}

async function main() {
  const seal = await processSheet(SEAL_INPUT, 'nikudan-seal');
  const spin = await processSheet(SPIN_INPUT, 'nikudan-spin');

  // Standing content height from first 2 seal frames (not huge ball).
  const standingH = Math.round(
    (seal.cut[0].bh + seal.cut[Math.min(1, seal.cut.length - 1)].bh) / 2,
  );
  console.log(`standingH=${standingH} seal=${seal.cellCount} spin=${spin.cellCount}`);

  const allCut = [...seal.cut, ...spin.cut];
  const norm = normalize(allCut, 2, standingH);
  const scaled = await scaleFrames(norm.frames, norm.cellW, norm.cellH, standingH);
  const sheet = stitch(scaled.frames, scaled.frameWidth, scaled.frameHeight);
  const qa = qaMetrics(
    sheet.data,
    sheet.width,
    scaled.frameHeight,
    scaled.frameWidth,
    scaled.frames.length,
  );
  console.log(
    `QA residualGreen=${qa.residualGreen} purpleFootStray=${qa.residualPurpleStray} opaque=${qa.opaque} n=${scaled.frames.length}`,
  );
  if (qa.residualGreen > 0) {
    throw new Error(`QA fail: residual green pixels = ${qa.residualGreen}`);
  }
  if (qa.residualPurpleStray > 0) {
    console.warn(`WARN purpleFootStray=${qa.residualPurpleStray} (attempted clean)`);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  await sharp(sheet.data, {
    raw: { width: sheet.width, height: sheet.height, channels: 4 },
  })
    .png()
    .toFile(path.join(OUT_DIR, OUT_NAME));

  const durationMs = Math.round((scaled.frames.length / FRAME_RATE) * 1000);
  // Hit roughly when ball is fully formed + spin starts (~ after seal frames)
  const hitDelayMs = Math.round((seal.cellCount / FRAME_RATE) * 1000);

  const entry = {
    image: `/sprites/player/chouji/${OUT_NAME}`,
    frameWidth: scaled.frameWidth,
    frameHeight: scaled.frameHeight,
    frameCount: scaled.frames.length,
    contentHeight: scaled.contentHeight,
    scale: scaled.scale,
    source: 'chouji-nikudan-seal-sheet.png + chouji-nikudan-spin-sheet.png',
    frameRate: FRAME_RATE,
    durationMs,
    hitDelayMs,
    note: `${seal.cellCount}+${spin.cellCount}=${scaled.frames.length}f Nikudan Sensha (seal→expand→spin); green exterior; content-island`,
  };

  let meta = {};
  if (fs.existsSync(META_JSON)) {
    try {
      meta = JSON.parse(fs.readFileSync(META_JSON, 'utf8'));
    } catch {
      meta = {};
    }
  }
  meta['chouji-nikudan-sensha'] = entry;
  fs.writeFileSync(META_JSON, `${JSON.stringify(meta, null, 2)}\n`);

  await writeQaCrops(sheet, scaled, QA_DIR);

  console.log(
    `-> ${OUT_NAME} ${sheet.width}x${sheet.height} fw=${entry.frameWidth} fh=${entry.frameHeight} n=${entry.frameCount} contentH=${entry.contentHeight} scale=${entry.scale.toFixed(3)}`,
  );
  console.log(
    'Pack wire:',
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
