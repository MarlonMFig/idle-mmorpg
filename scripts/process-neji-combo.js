/**
 * Neji combo attack — cyan multi-row sheet → combo1/2/3 + attack.
 * Row1 5f palm, row2 6f spin/kick, row3 11f rapid palms + finisher.
 *
 * npm run neji:combo
 * Fonte: assets/naruto-source/nu/neji-combo-sheet.png
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { keyExteriorChroma, isContent, fillInteriorHoles } = require('./lib/neji-chroma');

const ROOT = path.resolve(__dirname, '..');
const INPUT = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'neji-combo-sheet.png');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'neji');
const META_JSON = path.join(OUT_DIR, 'meta.json');
const TARGET_BODY_H = 48;
const FRAME_RATE = 12;
const ROW_EXPECT = [5, 6, 11];

function findBands(data, w, h) {
  const dy = new Array(h).fill(0);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (isContent(data, (y * w + x) * 4)) dy[y] += 1;
    }
  }
  const bands = [];
  let on = false;
  let start = 0;
  for (let y = 0; y <= h; y += 1) {
    const filled = y < h && dy[y] > 12;
    if (filled && !on) {
      on = true;
      start = y;
    }
    if (!filled && on) {
      if (y - start >= 20) bands.push({ t: start, b: y });
      on = false;
    }
  }
  return bands;
}

function cellsInBand(data, w, band, expected) {
  const dens = new Array(w).fill(0);
  for (let x = 0; x < w; x += 1) {
    for (let y = band.t; y < band.b; y += 1) {
      if (isContent(data, (y * w + x) * 4)) dens[x] += 1;
    }
  }
  const thr = Math.max(2, Math.floor((band.b - band.t) * 0.05));
  const raw = [];
  let xs = -1;
  for (let x = 0; x <= w; x += 1) {
    const filled = x < w && dens[x] > thr;
    if (filled && xs < 0) xs = x;
    if (!filled && xs >= 0) {
      if (x - xs >= 10) raw.push({ l: xs, r: x, t: band.t, b: band.b });
      xs = -1;
    }
  }
  const merged = [];
  for (const c of raw) {
    const prev = merged[merged.length - 1];
    if (prev && c.l - prev.r <= 4) prev.r = c.r;
    else merged.push({ ...c });
  }
  let out = merged.filter((c) => c.r - c.l >= 12);

  if (expected > 0 && out.length !== expected && out.length > 0) {
    const L = out[0].l;
    const R = out[out.length - 1].r;
    const span = R - L;
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
  return out;
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
  const standing = cut.slice(0, Math.min(2, cut.length));
  const contentH0 = Math.round(
    standing.reduce((s, c) => s + c.bh, 0) / Math.max(1, standing.length),
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
    fillInteriorHoles(d, outW, outH, 32);
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

async function writePng(file, data, width, height) {
  await sharp(data, { raw: { width, height, channels: 4 } }).png().toFile(file);
}

async function main() {
  if (!fs.existsSync(INPUT)) throw new Error(`Sheet não encontrada: ${INPUT}`);
  const { data: raw, info } = await sharp(INPUT).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const data = keyExteriorChroma(raw, info.width, info.height, { magenta: false });
  const bands = findBands(data, info.width, info.height);
  console.log(
    `neji combo ${info.width}x${info.height} bands=${bands.length}`,
    bands.map((b) => `${b.t}-${b.b}`).join(', '),
  );
  if (bands.length < 3) throw new Error(`Esperava 3 linhas, achou ${bands.length}`);

  const rows = bands.slice(0, 3).map((band, i) => {
    const cells = cellsInBand(data, info.width, band, ROW_EXPECT[i]);
    console.log(`  row${i + 1}: n=${cells.length}`, cells.map((c) => c.r - c.l).join(','));
    if (cells.length !== ROW_EXPECT[i]) {
      console.warn(`  aviso: row${i + 1} expected ${ROW_EXPECT[i]}, got ${cells.length}`);
    }
    return cells;
  });

  fs.mkdirSync(OUT_DIR, { recursive: true });
  let meta = {};
  if (fs.existsSync(META_JSON)) {
    try {
      meta = JSON.parse(fs.readFileSync(META_JSON, 'utf8'));
    } catch {
      meta = {};
    }
  }

  const names = ['combo1', 'combo2', 'combo3'];
  const wire = {};
  const allFrames = [];
  let uniformFw = 0;
  let uniformFh = 0;
  let contentH = TARGET_BODY_H;
  let scaleUsed = 1;

  // Normalize all combos to one max cell size across the full sheet for consistent feet.
  const allCuts = rows.flatMap((cells) => cells.map((c) => extractCell(data, info.width, c)));
  const opaqueOk = allCuts.every((c) => {
    let n = 0;
    for (let i = 3; i < c.frame.length; i += 4) if (c.frame[i] >= 16) n += 1;
    return n >= 40;
  });
  if (!opaqueOk) throw new Error('Frame vazio ou chroma agressivo demais');

  // Per-row normalize so wide finisher rows don't bloat short palm frames
  let cursor = 0;
  for (let ri = 0; ri < 3; ri += 1) {
    const n = rows[ri].length;
    const cut = allCuts.slice(cursor, cursor + n);
    cursor += n;
    const norm = normalize(cut);
    const scaled = await scaleFrames(norm.frames, norm.cellW, norm.cellH, norm.contentHeight);
    const sheet = stitch(scaled.frames, scaled.frameWidth, scaled.frameHeight);
    await writePng(path.join(OUT_DIR, `${names[ri]}.png`), sheet.data, sheet.width, sheet.height);

    const entry = {
      image: `/sprites/player/neji/${names[ri]}.png`,
      frameWidth: scaled.frameWidth,
      frameHeight: scaled.frameHeight,
      frameCount: scaled.frames.length,
      contentHeight: scaled.contentHeight,
      scale: scaled.scale,
      source: 'neji-combo-sheet.png',
      frameRate: FRAME_RATE,
      note: `combo row ${ri + 1}; ${ROW_EXPECT[ri]} frames expected`,
    };
    meta[`neji-${names[ri]}`] = entry;
    wire[names[ri]] = {
      frameWidth: entry.frameWidth,
      frameHeight: entry.frameHeight,
      frameCount: entry.frameCount,
      contentHeight: entry.contentHeight,
    };
    console.log(
      `-> ${names[ri]}.png fw=${entry.frameWidth} fh=${entry.frameHeight} n=${entry.frameCount} contentH=${entry.contentHeight}`,
    );
    allFrames.push(...scaled.frames);
    uniformFw = Math.max(uniformFw, scaled.frameWidth);
    uniformFh = Math.max(uniformFh, scaled.frameHeight);
    contentH = scaled.contentHeight;
    scaleUsed = scaled.scale;
  }

  // attack.png = full chain padded to max cell (optional auto-attack strip)
  const attackFrames = [];
  for (const f of allFrames) {
    // re-read from written strips is hard; pad each row's frames if needed
  }
  // Rebuild attack from per-row re-process with shared max dims is cleaner:
  const cutAll = allCuts;
  const normAll = normalize(cutAll);
  const scaledAll = await scaleFrames(
    normAll.frames,
    normAll.cellW,
    normAll.cellH,
    normAll.contentHeight,
  );
  const attackSheet = stitch(scaledAll.frames, scaledAll.frameWidth, scaledAll.frameHeight);
  await writePng(path.join(OUT_DIR, 'attack.png'), attackSheet.data, attackSheet.width, attackSheet.height);
  meta['neji-attack'] = {
    image: '/sprites/player/neji/attack.png',
    frameWidth: scaledAll.frameWidth,
    frameHeight: scaledAll.frameHeight,
    frameCount: scaledAll.frames.length,
    contentHeight: scaledAll.contentHeight,
    scale: scaledAll.scale,
    source: 'neji-combo-sheet.png',
    frameRate: FRAME_RATE,
    note: 'full combo1+2+3 strip',
  };
  console.log(
    `-> attack.png fw=${scaledAll.frameWidth} fh=${scaledAll.frameHeight} n=${scaledAll.frames.length}`,
  );

  fs.writeFileSync(META_JSON, `${JSON.stringify(meta, null, 2)}\n`);
  console.log('Pack wire:', JSON.stringify(wire, null, 2));
  void contentH;
  void scaleUsed;
  void uniformFw;
  void uniformFh;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
