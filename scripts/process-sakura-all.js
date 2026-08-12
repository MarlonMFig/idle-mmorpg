/**
 * Sakura pack — idle | run | jutsu1 | jutsu2
 * npm run sakura:all
 * Fundo verde com flood-fill (scripts/lib/chroma-green-bg.js).
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const {
  keyGreenBackground,
  isContent,
  isGreenBg,
  isLabelPixel,
  fillInteriorHoles,
} = require('./lib/chroma-green-bg');
const {
  resolveHqScale,
  resolvePackContentHeight,
  NATIVE_PIXELS,
} = require('./lib/strip-hq-scale');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'assets', 'naruto-source', 'nu');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'sakura');
const PREVIEW = path.join(ROOT, 'public', 'sprites', 'player', 'previews', 'sakura.png');
const META_JSON = path.join(OUT_DIR, 'meta.json');

const FRAME_RATE = 12;

async function loadKeyed(fileName) {
  const input = path.join(SRC, fileName);
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const keyed = keyGreenBackground(data, info.width, info.height);
  return { data: keyed, width: info.width, height: info.height };
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

function cellsInBand(data, w, band, expected = 0) {
  const dens = new Array(w).fill(0);
  for (let x = 0; x < w; x += 1) {
    for (let y = band.t; y < band.b; y += 1) {
      if (isContent(data, (y * w + x) * 4)) dens[x] += 1;
    }
  }
  const thr = Math.max(2, Math.floor((band.b - band.t) * 0.04));
  const raw = [];
  let xs = -1;
  for (let x = 0; x <= w; x += 1) {
    const filled = x < w && dens[x] > thr;
    if (filled && xs < 0) xs = x;
    if (!filled && xs >= 0) {
      if (x - xs >= 12) raw.push({ l: xs, r: x, t: band.t, b: band.b });
      xs = -1;
    }
  }
  const merged = [];
  for (const c of raw) {
    const prev = merged[merged.length - 1];
    if (prev && c.l - prev.r <= 3) prev.r = c.r;
    else merged.push({ ...c });
  }

  // split oversized
  const out = [];
  for (const c of merged) {
    const cw = c.r - c.l;
    if (cw <= 95) {
      out.push(c);
      continue;
    }
    const local = dens.slice(c.l, c.r);
    const maxD = Math.max(...local, 1);
    const cutThr = maxD * 0.18;
    let x0 = 0;
    const subs = [];
    for (let i = 1; i < local.length; i += 1) {
      const sm =
        (local[i - 1] + local[i] + (local[i + 1] ?? local[i])) / (local[i + 1] != null ? 3 : 2);
      if (sm < cutThr && i - x0 >= 14) {
        subs.push({ l: c.l + x0, r: c.l + i, t: c.t, b: c.b });
        x0 = i;
      }
    }
    if (local.length - x0 >= 14) subs.push({ l: c.l + x0, r: c.r, t: c.t, b: c.b });
    if (subs.length >= 2) out.push(...subs);
    else out.push(c);
  }

  if (expected > 0 && out.length > 0) {
    const L = out[0].l;
    const R = out[out.length - 1].r;
    const span = R - L;
    const avg = span / expected;
    const bad =
      out.length !== expected ||
      out.some((c) => c.r - c.l > avg * 1.65 || c.r - c.l < avg * 0.4);
    if (bad && avg >= 12) {
      const forced = [];
      for (let i = 0; i < expected; i += 1) {
        forced.push({
          l: Math.round(L + (i * span) / expected),
          r: Math.round(L + ((i + 1) * span) / expected),
          t: band.t,
          b: band.b,
        });
      }
      return forced;
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

function normalize(cut, standingN = 2, pad = 2) {
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

async function scaleFrames(frames, cellW, cellH, contentHeight, scaleOpts = { mode: 'match', metaPath: META_JSON, idleKey: 'sakura-idle' }) {
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
    // pós-scale: só fora/franja — despill; não zerar pele/cabelo
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 16) continue;
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      if (isLabelPixel(r, g, b)) {
        d[i + 3] = 0;
        continue;
      }
      if (isGreenBg(r, g, b)) {
        d[i + 3] = 0;
        continue;
      }
      // franja: reduz g residual sem apagar pixel
      if (g > Math.max(r, b) + 10 && g - Math.max(r, b) < 28) {
        d[i + 1] = Math.max(r, b);
      }
    }
    fillInteriorHoles(d, outW, outH, Math.max(24, Math.floor((outW * outH) * 0.08)));
    out.push(d);
  }
  return { frames: out, frameWidth: outW, frameHeight: outH, contentHeight: outContent, scale };
}

function stitch(frames, fw, fh) {
  const sheetW = fw * frames.length;
  const sheetH = fh;
  const sheet = Buffer.alloc(sheetW * sheetH * 4);
  frames.forEach((frame, index) => {
    for (let y = 0; y < fh; y += 1) {
      frame.copy(sheet, (y * sheetW + index * fw) * 4, y * fw * 4, (y + 1) * fw * 4);
    }
  });
  return { data: sheet, width: sheetW, height: sheetH };
}

async function writeSheet(name, frames, fw, fh, extra = {}) {
  const sheet = stitch(frames, fw, fh);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  await sharp(sheet.data, {
    raw: { width: sheet.width, height: sheet.height, channels: 4 },
  })
    .png()
    .toFile(path.join(OUT_DIR, `${name}.png`));
  const durationMs = Math.round((frames.length / FRAME_RATE) * 1000);
  const entry = {
    image: `/sprites/player/sakura/${name}.png`,
    frameWidth: fw,
    frameHeight: fh,
    frameCount: frames.length,
    frameRate: FRAME_RATE,
    durationMs,
    contentHeight: extra.contentHeight,
    scale: extra.scale,
    source: extra.source,
    ...extra,
  };
  console.log(
    `-> ${name}.png ${sheet.width}x${sheet.height} fw=${fw} fh=${fh} n=${frames.length}`,
  );
  return entry;
}

async function processSimple(fileName, expected, standingN, outName) {
  const { data, width, height } = await loadKeyed(fileName);
  const band = findBand(data, width, height);
  const cells = cellsInBand(data, width, band, expected);
  console.log(
    `${fileName} ${width}x${height} band ${band.t}-${band.b} n=${cells.length}`,
    cells.map((c) => c.r - c.l).join(','),
  );
  if (!cells.length) throw new Error(`Sem cells: ${fileName}`);
  const cut = cells.map((c) => extractCell(data, width, c));
  const norm = normalize(cut, standingN);
  const scaled = await scaleFrames(norm.frames, norm.cellW, norm.cellH, norm.contentHeight);
  return {
    entry: await writeSheet(outName, scaled.frames, scaled.frameWidth, scaled.frameHeight, {
      contentHeight: scaled.contentHeight,
      scale: scaled.scale,
      source: fileName,
    }),
    scaled,
  };
}

async function main() {
  const meta = {};

  {
    const r = await processSimple('sakura-idle.png', 4, 2, 'idle');
    meta['sakura-idle'] = r.entry;
    fs.mkdirSync(path.dirname(PREVIEW), { recursive: true });
    await sharp(r.scaled.frames[0], {
      raw: { width: r.scaled.frameWidth, height: r.scaled.frameHeight, channels: 4 },
    })
      .png()
      .toFile(PREVIEW);
    console.log('-> preview');
  }

  {
    const r = await processSimple('sakura-run.png', 6, 2, 'walk');
    meta['sakura-walk'] = r.entry;
  }

  // Jutsu 1
  {
    const { data, width, height } = await loadKeyed('sakura-jutsu1.png');
    const band = findBand(data, width, height);
    let cells = cellsInBand(data, width, band, 0);
    const typical =
      cells.reduce((s, c) => s + (c.r - c.l), 0) / Math.max(1, cells.length);
    cells = cells.filter((c) => {
      const cw = c.r - c.l;
      return cw >= 16 && cw < Math.max(110, typical * 2.0);
    });
    console.log(
      'jutsu1 cells',
      cells.length,
      cells.map((c) => c.r - c.l).join(','),
    );
    const cut = cells.map((c) => extractCell(data, width, c));
    const standingH = Math.round((cut[0].bh + cut[1].bh) / 2);
    const norm = normalize(cut, 2);
    const scaled = await scaleFrames(norm.frames, norm.cellW, norm.cellH, standingH);
    meta['sakura-chou-bakou'] = await writeSheet(
      'chou-bakou',
      scaled.frames,
      scaled.frameWidth,
      scaled.frameHeight,
      {
        contentHeight: scaled.contentHeight,
        scale: scaled.scale,
        source: 'sakura-jutsu1.png',
        hitDelayMs: Math.round((scaled.frames.length / FRAME_RATE) * 1000 * 0.55),
      },
    );

    const punchStart = Math.min(6, Math.max(0, scaled.frames.length - 5));
    const punch = scaled.frames.slice(punchStart, punchStart + 5);
    meta['sakura-combo1'] = await writeSheet(
      'combo1',
      punch.slice(0, 2),
      scaled.frameWidth,
      scaled.frameHeight,
      { contentHeight: scaled.contentHeight, scale: scaled.scale, source: 'sakura-jutsu1.png' },
    );
    meta['sakura-combo2'] = await writeSheet(
      'combo2',
      punch.slice(2, 4),
      scaled.frameWidth,
      scaled.frameHeight,
      { contentHeight: scaled.contentHeight, scale: scaled.scale, source: 'sakura-jutsu1.png' },
    );
    meta['sakura-combo3'] = await writeSheet(
      'combo3',
      punch.slice(4, 5).length ? punch.slice(4, 5) : punch.slice(-1),
      scaled.frameWidth,
      scaled.frameHeight,
      { contentHeight: scaled.contentHeight, scale: scaled.scale, source: 'sakura-jutsu1.png' },
    );
  }

  {
    const r = await processSimple('sakura-jutsu2.png', 12, 2, 'chakra-strength');
    meta['sakura-chakra-strength'] = {
      ...r.entry,
      hitDelayMs: Math.round((r.entry.frameCount / FRAME_RATE) * 1000 * 0.6),
    };
  }

  meta['skill-chou-bakou'] = meta['sakura-chou-bakou'];
  meta['skill-chakra-strength'] = meta['sakura-chakra-strength'];
  fs.writeFileSync(META_JSON, `${JSON.stringify(meta, null, 2)}\n`);
  console.log(
    JSON.stringify(
      {
        idle: meta['sakura-idle'],
        walk: meta['sakura-walk'],
        j1: meta['sakura-chou-bakou'],
        j2: meta['sakura-chakra-strength'],
        c1: meta['sakura-combo1'],
        c2: meta['sakura-combo2'],
        c3: meta['sakura-combo3'],
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
