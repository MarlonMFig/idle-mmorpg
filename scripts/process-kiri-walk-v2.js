if (!process.env) process.env = {};
process.env.npm_package_config_libvips = '8.14.5';

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

/**
 * Sheets Névoa 4×4 com labels:
 * CIMA=frente(down), BAIXO=costas(up), ESQUERDA=left, DIREITA=right.
 * Pack order: up, down, left, right.
 */

const SPECS = [
  {
    label: 'male',
    src: 'C:/Users/marlo/.cursor/projects/c-Users-marlo-Projects-idle-mmorpg/assets/c__Users_marlo_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_image-96459aec-cc78-4b8d-8517-f987d09888fc.png',
    prefix: 'kiri-male',
  },
  {
    label: 'female',
    src: 'C:/Users/marlo/.cursor/projects/c-Users-marlo-Projects-idle-mmorpg/assets/c__Users_marlo_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_image-e68b9bfb-fd0a-4ac9-b938-b3332e8d60f7.png',
    prefix: 'kiri-female',
  },
];

const OUT_DIR = 'public/sprites/player/kiri';
const LABEL_W = 140;
const SRC_ROWS = 4;
const SRC_COLS = 4;
// Source: 0 CIMA(front/down), 1 BAIXO(back/up), 2 ESQUERDA(left), 3 DIREITA(right)
const PACK_FROM_SRC = [1, 0, 2, 3];

async function loadKeyed(src) {
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const ch = info.channels;
  const bg = { r: data[0], g: data[1], b: data[2] };
  const out = Buffer.from(data);
  for (let i = 0; i < out.length; i += ch) {
    const dist = Math.hypot(out[i] - bg.r, out[i + 1] - bg.g, out[i + 2] - bg.b);
    if (dist < 45) out[i + 3] = 0;
    else if (dist < 70) out[i + 3] = Math.round(out[i + 3] * ((dist - 45) / 25));
  }
  return { data: out, w, h, ch };
}

function opaque(data, w, ch, x, y) {
  return data[(y * w + x) * ch + 3] > 24;
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

async function processSpec(spec) {
  const { data, w, h, ch } = await loadKeyed(spec.src);
  const contentW = w - LABEL_W;
  const cellW = Math.floor(contentW / SRC_COLS);
  const cellH = Math.floor(h / SRC_ROWS);
  console.log(spec.label, w + 'x' + h, 'cell', cellW + 'x' + cellH);

  const byPackRow = [];
  let maxW = 0;
  let maxH = 0;

  for (let r = 0; r < 4; r++) {
    const srcR = PACK_FROM_SRC[r];
    const rowFrames = [];
    const y0 = srcR * cellH;
    const y1 = Math.min(h - 1, (srcR + 1) * cellH - 1);
    for (let c = 0; c < SRC_COLS; c++) {
      const x0 = LABEL_W + c * cellW;
      const x1 = Math.min(w - 1, LABEL_W + (c + 1) * cellW - 1);
      const b = cellBounds(data, w, ch, x0, x1, y0, y1);
      if (!b) {
        rowFrames.push(null);
        continue;
      }
      maxW = Math.max(maxW, b.width);
      maxH = Math.max(maxH, b.height);
      rowFrames.push({ ...b, buf: extract(data, w, ch, b) });
    }
    byPackRow.push(rowFrames);
  }

  const fw = maxW;
  const fh = maxH;
  const sheet = Buffer.alloc(fw * SRC_COLS * fh * 4 * 4);

  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < SRC_COLS; c++) {
      const f = byPackRow[r][c];
      if (!f) continue;
      const ox = Math.floor((fw - f.width) / 2);
      const oy = fh - f.height;
      for (let y = 0; y < f.height; y++) {
        for (let x = 0; x < f.width; x++) {
          const si = (y * f.width + x) * 4;
          const dx = c * fw + ox + x;
          const dy = r * fh + oy + y;
          const di = (dy * (fw * SRC_COLS) + dx) * 4;
          sheet[di] = f.buf[si];
          sheet[di + 1] = f.buf[si + 1];
          sheet[di + 2] = f.buf[si + 2];
          sheet[di + 3] = f.buf[si + 3];
        }
      }
    }
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const walk = path.join(OUT_DIR, `${spec.prefix}-walk.png`);
  const preview = path.join(OUT_DIR, `${spec.prefix}.png`);
  const attack = path.join(OUT_DIR, `${spec.prefix}-attack.png`);

  await sharp(sheet, { raw: { width: fw * SRC_COLS, height: fh * 4, channels: 4 } })
    .png()
    .toFile(walk);

  const idle = byPackRow[1][0] || byPackRow[1].find(Boolean);
  if (idle) {
    await sharp(idle.buf, { raw: { width: idle.width, height: idle.height, channels: 4 } })
      .png()
      .toFile(preview);

    const atk = Buffer.alloc(fw * fh * 4);
    const ox = Math.floor((fw - idle.width) / 2);
    const oy = fh - idle.height;
    for (let y = 0; y < idle.height; y++) {
      for (let x = 0; x < idle.width; x++) {
        const si = (y * idle.width + x) * 4;
        const di = ((oy + y) * fw + (ox + x)) * 4;
        atk[di] = idle.buf[si];
        atk[di + 1] = idle.buf[si + 1];
        atk[di + 2] = idle.buf[si + 2];
        atk[di + 3] = idle.buf[si + 3];
      }
    }
    await sharp(atk, { raw: { width: fw, height: fh, channels: 4 } }).png().toFile(attack);
  }

  const filled = byPackRow.flat().filter(Boolean).length;
  console.log(spec.label, 'frame', fw + 'x' + fh, 'filled', filled);
  return { label: spec.label, fw, fh, filled };
}

(async () => {
  const results = [];
  for (const s of SPECS) results.push(await processSpec(s));
  fs.writeFileSync('scripts/tmp-kiri-walk-meta.json', JSON.stringify(results, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
