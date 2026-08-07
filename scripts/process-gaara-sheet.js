/**
 * Gaara — detecção por bandas (fundo escuro + cor do personagem).
 * idle 4 | walk 5 (+run 5) | skip jump/fall/land | basic 4 | sand-bullet 5 | sand-coffin
 *
 * npm run gaara:all
 * Fonte: assets/naruto-source/nu/gaara-sheet.png
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const INPUT = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'gaara-sheet.png');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'gaara');
const PREVIEW = path.join(ROOT, 'public', 'sprites', 'player', 'previews', 'gaara.png');
const TARGET_BODY_H = 48;
const FRAME_RATE = 10;
const MAX_SHEET_W = 4096;

function isBg(r, g, b) {
  return Math.max(r, g, b) <= 38;
}

function isChar(r, g, b) {
  if (isBg(r, g, b)) return false;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max - min >= 20) return true;
  if (r > 75 && r >= g && r >= b) return true;
  if (r > 95 && g > 70 && b < 110) return true;
  if (r > 110 && g > 90 && b > 75) return true;
  return false;
}

function findBands(data, w, h) {
  const dy = new Array(h).fill(0);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      if (isChar(data[i], data[i + 1], data[i + 2])) dy[y] += 1;
    }
  }
  let on = false;
  let start = 0;
  const bands = [];
  for (let y = 0; y <= h; y += 1) {
    const filled = y < h && dy[y] > 30;
    if (filled && !on) {
      on = true;
      start = y;
    }
    if (!filled && on) {
      bands.push({ t: start, b: y });
      on = false;
    }
  }
  return bands.filter((b) => b.b - b.t >= 50);
}

function cellsInBand(data, w, band) {
  const dens = new Array(w).fill(0);
  for (let x = 0; x < w; x += 1) {
    for (let y = band.t; y < band.b; y += 1) {
      const i = (y * w + x) * 4;
      if (isChar(data[i], data[i + 1], data[i + 2])) dens[x] += 1;
    }
  }
  const thr = Math.max(3, Math.floor((band.b - band.t) * 0.08));
  const raw = [];
  let xs = -1;
  for (let x = 0; x <= w; x += 1) {
    const filled = x < w && dens[x] > thr;
    if (filled && xs < 0) xs = x;
    if (!filled && xs >= 0) {
      if (x - xs >= 18) raw.push({ l: xs, r: x, t: band.t, b: band.b });
      xs = -1;
    }
  }
  const merged = [];
  for (const c of raw) {
    const prev = merged[merged.length - 1];
    if (prev && c.l - prev.r <= 3) prev.r = c.r;
    else merged.push({ ...c });
  }
  return merged;
}

function extractCell(data, w, cell) {
  const fw = cell.r - cell.l;
  const fh = cell.b - cell.t;
  const frame = Buffer.alloc(fw * fh * 4);
  for (let y = 0; y < fh; y += 1) {
    for (let x = 0; x < fw; x += 1) {
      const si = ((cell.t + y) * w + cell.l + x) * 4;
      const di = (y * fw + x) * 4;
      const r = data[si];
      const g = data[si + 1];
      const b = data[si + 2];
      if (!isChar(r, g, b)) {
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

function normalize(cut, standingN = 4) {
  const pad = 1;
  const cellW = Math.max(...cut.map((c) => c.bw)) + pad * 2;
  const cellH = Math.max(...cut.map((c) => c.bh)) + pad * 2;
  const standing = cut.slice(0, Math.min(standingN, cut.length));
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
  const scale = Math.min(1, TARGET_BODY_H / Math.max(1, contentHeight));
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
    for (let i = 0; i < d.length; i += 4) {
      if (isBg(d[i], d[i + 1], d[i + 2])) d[i + 3] = 0;
    }
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
      frame.copy(
        out,
        ((row * fh + y) * outW + col * fw) * 4,
        y * fw * 4,
        (y + 1) * fw * 4,
      );
    }
  });
  return { data: out, width: outW, height: outH, cols, rows };
}

async function writeSheet(name, frames, fw, fh, extra = {}) {
  const sheet = stitch(frames, fw, fh);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  await sharp(sheet.data, {
    raw: { width: sheet.width, height: sheet.height, channels: 4 },
  })
    .png()
    .toFile(path.join(OUT_DIR, `${name}.png`));
  const entry = {
    image: `/sprites/player/gaara/${name}.png`,
    frameWidth: fw,
    frameHeight: fh,
    frameCount: frames.length,
    sheetCols: sheet.cols,
    sheetRows: sheet.rows,
    source: 'gaara-sheet.png',
    frameRate: FRAME_RATE,
    ...extra,
  };
  console.log(
    `-> ${name}.png ${sheet.width}x${sheet.height} fw=${fw} fh=${fh} n=${frames.length}`,
    `contentH=${extra.contentHeight ?? '-'}`,
  );
  return entry;
}

async function processGroup(name, cells, data, w, standingN, hitRatio) {
  if (!cells.length) return null;
  const cut = cells.map((c) => extractCell(data, w, c));
  const norm = normalize(cut, standingN);
  const scaled = await scaleFrames(
    norm.frames,
    norm.cellW,
    norm.cellH,
    norm.contentHeight,
  );
  const durationMs = Math.round((scaled.frames.length / FRAME_RATE) * 1000);
  const hitDelayMs =
    hitRatio != null ? Math.round(durationMs * hitRatio) : undefined;
  return writeSheet(name, scaled.frames, scaled.frameWidth, scaled.frameHeight, {
    contentHeight: scaled.contentHeight,
    scale: scaled.scale,
    durationMs,
    hitDelayMs,
  });
}

async function main() {
  if (!fs.existsSync(INPUT)) throw new Error(`Sheet não encontrada: ${INPUT}`);
  const { data, info } = await sharp(INPUT).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const bands = findBands(data, info.width, info.height);
  console.log(
    'bands',
    bands.map((b) => `${b.t}-${b.b} (${b.b - b.t})`),
  );

  const rows = bands.map((band) => {
    const cells = cellsInBand(data, info.width, band);
    console.log(`  y=${band.t} n=${cells.length}`, cells.map((c) => c.r - c.l).join(','));
    return cells;
  });

  // 0: idle+walk+run · 1: jump/fall/land · 2: basic+j1 · 3: j2
  const r0 = rows[0] ?? [];
  const r2 = rows[2] ?? rows[1] ?? [];
  const r3 = rows[3] ?? rows[rows.length - 1] ?? [];

  const idleCells = r0.slice(0, 4);
  const walkCells = r0.slice(4, 14); // walk+run
  const basicCells = r2.slice(0, 4);
  const j1Cells = r2.slice(4, 9);
  const j2Cells = r3;

  console.log({
    idle: idleCells.length,
    walk: walkCells.length,
    basic: basicCells.length,
    j1: j1Cells.length,
    j2: j2Cells.length,
  });

  const meta = {};
  meta['gaara-idle'] = await processGroup('idle', idleCells, data, info.width, 4, null);
  meta['gaara-walk'] = await processGroup('walk', walkCells, data, info.width, 3, null);

  meta['gaara-combo1'] = await processGroup(
    'combo1',
    basicCells.slice(0, 2),
    data,
    info.width,
    1,
    null,
  );
  meta['gaara-combo2'] = await processGroup(
    'combo2',
    basicCells.slice(2, 3),
    data,
    info.width,
    1,
    null,
  );
  meta['gaara-combo3'] = await processGroup(
    'combo3',
    basicCells.slice(3, 4),
    data,
    info.width,
    1,
    null,
  );

  meta['gaara-sand-bullet'] = await processGroup(
    'sand-bullet',
    j1Cells,
    data,
    info.width,
    2,
    0.55,
  );
  meta['gaara-sand-coffin'] = await processGroup(
    'sand-coffin',
    j2Cells,
    data,
    info.width,
    2,
    0.62,
  );

  meta['skill-sand-bullet'] = {
    ...meta['gaara-sand-bullet'],
    note: 'Jutsu 1 Gaara — Sand Bullet',
  };
  meta['skill-sand-coffin'] = {
    ...meta['gaara-sand-coffin'],
    note: 'Jutsu 2 Gaara — Sand Coffin',
  };

  if (meta['gaara-idle']) {
    const idlePath = path.join(OUT_DIR, 'idle.png');
    const { data: idata, info: iinfo } = await sharp(idlePath)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const fw = meta['gaara-idle'].frameWidth;
    const fh = meta['gaara-idle'].frameHeight;
    const frame = Buffer.alloc(fw * fh * 4);
    for (let y = 0; y < fh; y += 1) {
      idata.copy(frame, y * fw * 4, y * iinfo.width * 4, y * iinfo.width * 4 + fw * 4);
    }
    fs.mkdirSync(path.dirname(PREVIEW), { recursive: true });
    await sharp(frame, { raw: { width: fw, height: fh, channels: 4 } })
      .png()
      .toFile(PREVIEW);
    console.log(`-> preview ${PREVIEW}`);
  }

  fs.writeFileSync(path.join(OUT_DIR, 'meta.json'), `${JSON.stringify(meta, null, 2)}\n`);
  console.log(
    'Pack wire:',
    JSON.stringify(
      {
        idle: meta['gaara-idle'],
        walk: meta['gaara-walk'],
        combo1: meta['gaara-combo1'],
        combo2: meta['gaara-combo2'],
        combo3: meta['gaara-combo3'],
        j1: meta['gaara-sand-bullet'],
        j2: meta['gaara-sand-coffin'],
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
