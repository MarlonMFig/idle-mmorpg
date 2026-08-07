/**
 * Hyuga Neji — folha multi-linha (fundo verde):
 *   row ~run 10 | basic attack 5 | jutsu1 ~13 | jutsu2 ~11
 *
 * npm run neji:all
 * Fonte: assets/naruto-source/nu/neji-sheet.png
 * → public/sprites/player/neji/{idle,walk,combo1-3,hakke-kusho,rokujuyon-sho}.png
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const INPUT = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'neji-sheet.png');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'neji');
const PREVIEW = path.join(ROOT, 'public', 'sprites', 'player', 'previews', 'neji.png');
const TARGET_BODY_H = 48;
const FRAME_RATE = 12;
const MAX_SHEET_W = 4096;

function isBg(r, g, b) {
  return g >= 95 && r <= 50 && b <= 45 && g >= r + 45 && g >= b + 45;
}

function findBands(data, w, h) {
  const dy = new Array(h).fill(0);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      if (!isBg(data[i], data[i + 1], data[i + 2])) dy[y] += 1;
    }
  }
  let on = false;
  let start = 0;
  const bands = [];
  for (let y = 0; y < h; y += 1) {
    if (!on && dy[y] > 15) {
      on = true;
      start = y;
    }
    if (on && dy[y] < 8) {
      bands.push({ t: start, b: y });
      on = false;
    }
  }
  if (on) bands.push({ t: start, b: h });
  return bands.filter((b) => b.b - b.t >= 40);
}

function cellsInBand(data, densAll, w, band) {
  const thr = Math.max(2, Math.floor((band.b - band.t) * 0.05));
  const dens = new Array(w).fill(0);
  for (let x = 0; x < w; x += 1) {
    for (let y = band.t; y < band.b; y += 1) {
      const i = (y * w + x) * 4;
      if (!isBg(data[i], data[i + 1], data[i + 2])) dens[x] += 1;
    }
  }
  densAll.push(dens);

  const raw = [];
  let xs = -1;
  for (let x = 0; x <= w; x += 1) {
    const filled = x < w && dens[x] > thr;
    if (filled && xs < 0) xs = x;
    if (!filled && xs >= 0) {
      raw.push({ l: xs, r: x, t: band.t, b: band.b });
      xs = -1;
    }
  }
  const merged = [];
  for (const c of raw) {
    const prev = merged[merged.length - 1];
    if (prev && c.l - prev.r <= 3) prev.r = c.r;
    else merged.push({ ...c });
  }

  const out = [];
  for (const c of merged) {
    const cw = c.r - c.l;
    if (cw < 16) continue;
    if (cw <= 90) {
      out.push(c);
      continue;
    }
    const densC = dens.slice(c.l, c.r);
    const max = Math.max(...densC, 1);
    const cutThr = max * 0.18;
    const sm = densC.map((_, i) => {
      let s = 0;
      let n = 0;
      for (let k = -2; k <= 2; k += 1) {
        if (densC[i + k] != null) {
          s += densC[i + k];
          n += 1;
        }
      }
      return s / n;
    });
    let x0 = -1;
    const subs = [];
    for (let i = 0; i <= sm.length; i += 1) {
      const filled = i < sm.length && sm[i] > cutThr;
      if (filled && x0 < 0) x0 = i;
      if (!filled && x0 >= 0) {
        subs.push({ l: c.l + x0, r: c.l + i, t: c.t, b: c.b });
        x0 = -1;
      }
    }
    const good = subs.filter((s) => s.r - s.l >= 12);
    if (good.length >= 2) {
      out.push(...good);
      continue;
    }
    const n = Math.max(2, Math.round(cw / 48));
    const fw = Math.round(cw / n);
    for (let i = 0; i < n; i += 1) {
      const l = c.l + i * fw;
      const r = i === n - 1 ? c.r : c.l + (i + 1) * fw;
      if (r - l >= 12) out.push({ l, r, t: c.t, b: c.b });
    }
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
      const r = data[si];
      const g = data[si + 1];
      const b = data[si + 2];
      if (isBg(r, g, b)) {
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

function normalizeFrames(cut, standingN = 4) {
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

async function scaleFrames(frames, cellW, cellH, contentHeight, targetBody) {
  const scale = Math.min(1, targetBody / Math.max(1, contentHeight));
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
  const file = `${name}.png`;
  await sharp(sheet.data, {
    raw: { width: sheet.width, height: sheet.height, channels: 4 },
  })
    .png()
    .toFile(path.join(OUT_DIR, file));
  const entry = {
    image: `/sprites/player/neji/${file}`,
    frameWidth: fw,
    frameHeight: fh,
    frameCount: frames.length,
    sheetCols: sheet.cols,
    sheetRows: sheet.rows,
    source: 'neji-sheet.png',
    frameRate: FRAME_RATE,
    ...extra,
  };
  console.log(
    `-> ${file} ${sheet.width}x${sheet.height} fw=${fw} fh=${fh} n=${frames.length}`,
    extra.contentHeight != null ? `contentH=${extra.contentHeight}` : '',
  );
  return entry;
}

async function main() {
  if (!fs.existsSync(INPUT)) throw new Error(`Sheet não encontrada: ${INPUT}`);
  const { data, info } = await sharp(INPUT).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const bands = findBands(data, info.width, info.height);
  console.log(
    'bands',
    bands.map((b) => `${b.t}-${b.b}`),
  );

  const densHolder = [];
  const cells = [];
  for (const band of bands) {
    const rowCells = cellsInBand(data, densHolder, info.width, band);
    console.log(`  row y=${band.t} n=${rowCells.length}`, rowCells.map((c) => c.r - c.l).join(','));
    cells.push(...rowCells);
  }
  console.log(`total cells ${cells.length}`);
  if (cells.length < 20) throw new Error('poucos frames de Neji detectados');

  // Layout canônico da folha (após detecção): walk/run · combo · jutsu1 · jutsu2
  const WALK_N = 10;
  const COMBO_N = 5;
  const J1_N = 13;
  const J2_N = 11;
  const need = WALK_N + COMBO_N + J1_N + J2_N;
  if (cells.length < need) {
    console.warn(`aviso: ${cells.length} frames < ${need} esperados — usando o que houver`);
  }

  let cursor = 0;
  const take = (n) => {
    const slice = cells.slice(cursor, cursor + n);
    cursor += n;
    return slice;
  };

  const walkCells = take(Math.min(WALK_N, cells.length));
  const comboCells = take(Math.min(COMBO_N, cells.length - cursor));
  const j1Cells = take(Math.min(J1_N, cells.length - cursor));
  const j2Cells = take(Math.min(J2_N, cells.length - cursor));
  // Idle: postura pronta do primeiro frame de combo (ou walk).
  const idleCells = (comboCells[0] ? [comboCells[0]] : walkCells.slice(0, 1)).concat(
    comboCells[0] ? [comboCells[0]] : [],
  );

  async function processNamed(name, rawCells, standingN, skillTiming) {
    if (!rawCells.length) return null;
    const cut = rawCells.map((c) => extractCell(data, info.width, c));
    const norm = normalizeFrames(cut, standingN);
    const scaled = await scaleFrames(
      norm.frames,
      norm.cellW,
      norm.cellH,
      norm.contentHeight,
      TARGET_BODY_H,
    );
    const durationMs = Math.round((scaled.frames.length / FRAME_RATE) * 1000);
    const hitDelayMs = skillTiming
      ? Math.round(durationMs * skillTiming)
      : undefined;
    return writeSheet(name, scaled.frames, scaled.frameWidth, scaled.frameHeight, {
      contentHeight: scaled.contentHeight,
      scale: scaled.scale,
      durationMs,
      hitDelayMs,
    });
  }

  const meta = {};
  meta['neji-idle'] = await processNamed('idle', idleCells, idleCells.length, null);
  meta['neji-walk'] = await processNamed('walk', walkCells, 3, null);

  // Combo chain 2/2/1 (total 5)
  const c1 = comboCells.slice(0, 2);
  const c2 = comboCells.slice(2, 4);
  const c3 = comboCells.slice(4, 5);
  meta['neji-combo1'] = await processNamed('combo1', c1.length ? c1 : comboCells.slice(0, 1), 1, null);
  meta['neji-combo2'] = await processNamed('combo2', c2.length ? c2 : comboCells.slice(1, 2), 1, null);
  meta['neji-combo3'] = await processNamed('combo3', c3.length ? c3 : comboCells.slice(-1), 1, null);

  // Jutsus: hit no final da sequência
  meta['neji-hakke-kusho'] = await processNamed('hakke-kusho', j1Cells, 4, 0.72);
  meta['neji-rokujuyon-sho'] = await processNamed('rokujuyon-sho', j2Cells, 2, 0.65);

  meta['skill-hakke-kusho'] = { ...meta['neji-hakke-kusho'], note: 'Jutsu 1 Neji — Hakke Kūshō' };
  meta['skill-rokujuyon-sho'] = {
    ...meta['neji-rokujuyon-sho'],
    note: 'Jutsu 2 Neji — Hakke Rokujūyon Shō',
  };

  // Preview from idle frame 0
  if (meta['neji-idle']) {
    const idlePath = path.join(OUT_DIR, 'idle.png');
    const { data: idata, info: iinfo } = await sharp(idlePath)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const fw = meta['neji-idle'].frameWidth;
    const fh = meta['neji-idle'].frameHeight;
    const frame = Buffer.alloc(fw * fh * 4);
    for (let y = 0; y < fh; y += 1) {
      idata.copy(frame, y * fw * 4, y * iinfo.width * 4, y * iinfo.width * 4 + fw * 4);
    }
    fs.mkdirSync(path.dirname(PREVIEW), { recursive: true });
    await sharp(frame, { raw: { width: fw, height: fh, channels: 4 } }).png().toFile(PREVIEW);
    console.log(`-> preview ${PREVIEW}`);
  }

  fs.writeFileSync(path.join(OUT_DIR, 'meta.json'), `${JSON.stringify(meta, null, 2)}\n`);
  console.log(
    'Pack wire:',
    JSON.stringify(
      {
        idle: meta['neji-idle'],
        walk: meta['neji-walk'],
        combo1: meta['neji-combo1'],
        combo2: meta['neji-combo2'],
        combo3: meta['neji-combo3'],
        j1: meta['neji-hakke-kusho'],
        j2: meta['neji-rokujuyon-sho'],
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
