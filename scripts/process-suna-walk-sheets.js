if (!process.env) process.env = {};
process.env.npm_package_config_libvips = '8.14.5';

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

/**
 * Sheets Areia 1024×682: labels à esquerda + 6 linhas × 7 frames.
 * As colunas não são uniformes, então detectamos linhas/colunas por densidade
 * (grid fixo vazava fatias dos sprites vizinhos).
 *
 * Linhas fonte: FRENTE, COSTAS, DIREITA, ESQUERDA, CIMA, BAIXO.
 * Pack: up, down, left, right ← COSTAS, FRENTE, ESQUERDA, DIREITA.
 */

const SPECS = [
  {
    label: 'female',
    src: 'C:/Users/marlo/.cursor/projects/c-Users-marlo-Projects-idle-mmorpg/assets/c__Users_marlo_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_56e8a978-d548-4dc5-be27-be8eed855f4a-d1168982-23b3-4751-a96f-1dec22111218.png',
    prefix: 'suna-female',
  },
  {
    label: 'male',
    src: 'C:/Users/marlo/.cursor/projects/c-Users-marlo-Projects-idle-mmorpg/assets/c__Users_marlo_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_68886dd4-7e13-4ec5-ae7d-dee28dd6be30-fe9f5ce3-f964-4342-8170-54c58679e30d.png',
    prefix: 'suna-male',
  },
];

const OUT_DIR = 'public/sprites/player/suna';
/** Faixa dos rótulos ("FRENTE", "COSTAS", …) — ignorada na detecção. */
const LABEL_W = 150;
const SRC_COLS = 7;
const SRC_ROWS = 6;
const PACK_FROM_SRC = [1, 0, 3, 2];

async function loadKeyed(src) {
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const ch = info.channels;
  const bg = { r: data[0], g: data[1], b: data[2] };
  const out = Buffer.from(data);
  for (let i = 0; i < out.length; i += ch) {
    const dist = Math.hypot(out[i] - bg.r, out[i + 1] - bg.g, out[i + 2] - bg.b);
    if (dist < 50) out[i + 3] = 0;
    else if (dist < 78) out[i + 3] = Math.round(out[i + 3] * ((dist - 50) / 28));
  }
  return { data: out, w, h, ch };
}

function opaque(data, w, ch, x, y) {
  return data[(y * w + x) * ch + 3] > 30;
}

function clusters(arr, min, from) {
  const cs = [];
  let start = -1;
  for (let i = from || 0; i < arr.length; i++) {
    if (arr[i] >= min) {
      if (start < 0) start = i;
    } else if (start >= 0) {
      cs.push([start, i - 1]);
      start = -1;
    }
  }
  if (start >= 0) cs.push([start, arr.length - 1]);
  return cs;
}

/** Mantém as `count` faixas mais largas, em ordem de posição. */
function keepWidest(bands, count) {
  if (bands.length <= count) return bands;
  return bands
    .slice()
    .sort((a, b) => b[1] - b[0] - (a[1] - a[0]))
    .slice(0, count)
    .sort((a, b) => a[0] - b[0]);
}

function detectBands(data, w, h, ch) {
  const colDens = new Array(w).fill(0);
  const rowDens = new Array(h).fill(0);
  for (let y = 0; y < h; y++) {
    for (let x = LABEL_W; x < w; x++) {
      if (!opaque(data, w, ch, x, y)) continue;
      colDens[x]++;
      rowDens[y]++;
    }
  }

  const rows = keepWidest(
    clusters(rowDens, 6).filter((c) => c[1] - c[0] > 30),
    SRC_ROWS,
  );
  const cols = keepWidest(
    clusters(colDens, 4, LABEL_W).filter((c) => c[1] - c[0] > 10),
    SRC_COLS,
  );
  return { rows, cols };
}

function cellBounds(data, w, ch, x0, x1, y0, y1) {
  let minX = x1;
  let minY = y1;
  let maxX = x0;
  let maxY = y0;
  let found = false;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (!opaque(data, w, ch, x, y)) continue;
      found = true;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (!found) return null;
  return { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

function extract(data, w, ch, b) {
  const buf = Buffer.alloc(b.width * b.height * 4);
  for (let y = 0; y < b.height; y++) {
    for (let x = 0; x < b.width; x++) {
      const si = ((b.minY + y) * w + (b.minX + x)) * ch;
      const di = (y * b.width + x) * 4;
      buf[di] = data[si];
      buf[di + 1] = data[si + 1];
      buf[di + 2] = data[si + 2];
      buf[di + 3] = data[si + 3];
    }
  }
  return buf;
}

/** Escreve `frame` centralizado horizontalmente e alinhado pelos pés. */
function blitFrame(sheet, sheetW, frame, cellX, cellY, fw, fh) {
  const ox = cellX + Math.floor((fw - frame.width) / 2);
  const oy = cellY + (fh - frame.height);
  for (let y = 0; y < frame.height; y++) {
    for (let x = 0; x < frame.width; x++) {
      const si = (y * frame.width + x) * 4;
      const di = ((oy + y) * sheetW + (ox + x)) * 4;
      sheet[di] = frame.buf[si];
      sheet[di + 1] = frame.buf[si + 1];
      sheet[di + 2] = frame.buf[si + 2];
      sheet[di + 3] = frame.buf[si + 3];
    }
  }
}

async function processSpec(spec) {
  const { data, w, h, ch } = await loadKeyed(spec.src);
  const { rows, cols } = detectBands(data, w, h, ch);
  console.log(spec.label, w + 'x' + h, 'rows', rows.length, 'cols', cols.length);

  if (rows.length < 4 || cols.length !== SRC_COLS) {
    throw new Error(`${spec.label}: bandas inesperadas (${rows.length}×${cols.length})`);
  }

  const packRows = [];
  let fw = 0;
  let fh = 0;

  for (const srcRow of PACK_FROM_SRC) {
    const [y0, y1] = rows[srcRow];
    const rowFrames = [];
    for (const [x0, x1] of cols) {
      const bounds = cellBounds(data, w, ch, x0, x1, y0, y1);
      if (!bounds) throw new Error(`${spec.label}: célula vazia em ${srcRow}`);
      fw = Math.max(fw, bounds.width);
      fh = Math.max(fh, bounds.height);
      rowFrames.push({ ...bounds, buf: extract(data, w, ch, bounds) });
    }
    packRows.push(rowFrames);
  }

  const sheetW = fw * SRC_COLS;
  const sheetH = fh * packRows.length;
  const sheet = Buffer.alloc(sheetW * sheetH * 4);

  packRows.forEach((rowFrames, r) => {
    rowFrames.forEach((frame, c) => {
      blitFrame(sheet, sheetW, frame, c * fw, r * fh, fw, fh);
    });
  });

  fs.mkdirSync(OUT_DIR, { recursive: true });
  await sharp(sheet, { raw: { width: sheetW, height: sheetH, channels: 4 } })
    .png()
    .toFile(path.join(OUT_DIR, `${spec.prefix}-walk.png`));

  // Preview e ataque usam o idle de frente (linha down, frame 0).
  const idle = packRows[1][0];
  await sharp(idle.buf, { raw: { width: idle.width, height: idle.height, channels: 4 } })
    .png()
    .toFile(path.join(OUT_DIR, `${spec.prefix}.png`));

  const attack = Buffer.alloc(fw * fh * 4);
  blitFrame(attack, fw, idle, 0, 0, fw, fh);
  await sharp(attack, { raw: { width: fw, height: fh, channels: 4 } })
    .png()
    .toFile(path.join(OUT_DIR, `${spec.prefix}-attack.png`));

  console.log(spec.label, 'frame', fw + 'x' + fh, 'sheet', sheetW + 'x' + sheetH);
  return { label: spec.label, fw, fh, columns: SRC_COLS, rows: packRows.length };
}

(async () => {
  for (const spec of SPECS) {
    const meta = await processSpec(spec);
    console.log(JSON.stringify(meta));
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
