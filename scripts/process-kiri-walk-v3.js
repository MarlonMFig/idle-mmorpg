if (!process.env) process.env = {};
process.env.npm_package_config_libvips = '8.14.5';

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

/**
 * Reprocessa sheets Névoa 4×4 via componentes (ignora labels).
 * Labels na arte: CIMA=frente, BAIXO=costas, ESQUERDA, DIREITA (invertidos vs pack).
 * Pack: up, down, left, right ← BAIXO, CIMA, ESQUERDA, DIREITA.
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
  return { data: out, w, h, ch, bg };
}

function opaque(data, w, ch, x, y) {
  return data[(y * w + x) * ch + 3] > 30;
}

function findComponents(data, w, h, ch) {
  const visited = new Uint8Array(w * h);
  const comps = [];
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (visited[idx] || !opaque(data, w, ch, x, y)) continue;
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      let count = 0;
      const q = [idx];
      visited[idx] = 1;
      while (q.length) {
        const cur = q.pop();
        const cx = cur % w;
        const cy = (cur / w) | 0;
        count++;
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;
        for (const [dx, dy] of dirs) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const ni = ny * w + nx;
          if (visited[ni] || !opaque(data, w, ch, nx, ny)) continue;
          visited[ni] = 1;
          q.push(ni);
        }
      }
      const width = maxX - minX + 1;
      const height = maxY - minY + 1;
      // Labels são baixos/largos; sprites são altos
      if (count < 400) continue;
      if (height < 80) continue;
      if (width > height * 1.6) continue; // caixa de texto
      comps.push({
        minX,
        maxX,
        minY,
        maxY,
        width,
        height,
        count,
        cx: (minX + maxX) / 2,
        cy: (minY + maxY) / 2,
      });
    }
  }
  return comps;
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

function groupIntoRows(comps, expectedRows = 4) {
  const sorted = comps.slice().sort((a, b) => a.cy - b.cy);
  // cluster by cy gaps
  const rows = [];
  let cur = [];
  let lastCy = -Infinity;
  const heights = sorted.map((c) => c.height);
  const medH = heights.sort((a, b) => a - b)[Math.floor(heights.length / 2)] || 100;
  const gapThresh = medH * 0.55;

  for (const c of sorted) {
    if (cur.length && c.cy - lastCy > gapThresh) {
      rows.push(cur.sort((a, b) => a.cx - b.cx));
      cur = [];
    }
    cur.push(c);
    lastCy = c.cy;
  }
  if (cur.length) rows.push(cur.sort((a, b) => a.cx - b.cx));

  // If too many rows, merge nearest
  while (rows.length > expectedRows) {
    let best = 0;
    let bestGap = Infinity;
    for (let i = 0; i < rows.length - 1; i++) {
      const cyA = rows[i].reduce((s, c) => s + c.cy, 0) / rows[i].length;
      const cyB = rows[i + 1].reduce((s, c) => s + c.cy, 0) / rows[i + 1].length;
      if (cyB - cyA < bestGap) {
        bestGap = cyB - cyA;
        best = i;
      }
    }
    rows[best] = rows[best].concat(rows[best + 1]).sort((a, b) => a.cx - b.cx);
    rows.splice(best + 1, 1);
  }

  // Each row: keep 4 largest by area, left-to-right
  return rows.map((row) =>
    row
      .slice()
      .sort((a, b) => b.width * b.height - a.width * a.height)
      .slice(0, 4)
      .sort((a, b) => a.cx - b.cx),
  );
}

async function processSpec(spec) {
  const { data, w, h, ch } = await loadKeyed(spec.src);
  let comps = findComponents(data, w, h, ch);
  console.log(spec.label, 'comps', comps.length);

  // Prefer exactly 16 largest character-like blobs
  if (comps.length > 16) {
    comps = comps
      .slice()
      .sort((a, b) => b.width * b.height - a.width * a.height)
      .slice(0, 16);
  }

  const srcRows = groupIntoRows(comps, 4);
  console.log(
    spec.label,
    'rows',
    srcRows.map((r) => r.length),
  );

  if (srcRows.length < 4 || srcRows.some((r) => r.length < 4)) {
    throw new Error(`${spec.label}: expected 4x4, got ${JSON.stringify(srcRows.map((r) => r.length))}`);
  }

  // Source rows: 0 CIMA(front), 1 BAIXO(back), 2 ESQUERDA, 3 DIREITA
  // Na arte, labels ESQUERDA/DIREITA estão invertidos vs o lado que o sprite olha.
  // Pack: up=back, down=front, left, right
  const packOrder = [1, 0, 3, 2];
  const frames = [];
  let maxW = 0;
  let maxH = 0;

  for (const srcRi of packOrder) {
    for (const c of srcRows[srcRi]) {
      maxW = Math.max(maxW, c.width);
      maxH = Math.max(maxH, c.height);
      frames.push({ ...c, buf: extract(data, w, ch, c) });
    }
  }

  const fw = maxW;
  const fh = maxH;
  const cols = 4;
  const rows = 4;
  const sheet = Buffer.alloc(fw * cols * fh * rows * 4);

  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const ox = Math.floor((fw - f.width) / 2);
    const oy = fh - f.height;
    for (let y = 0; y < f.height; y++) {
      for (let x = 0; x < f.width; x++) {
        const si = (y * f.width + x) * 4;
        const dx = col * fw + ox + x;
        const dy = row * fh + oy + y;
        const di = (dy * (fw * cols) + dx) * 4;
        sheet[di] = f.buf[si];
        sheet[di + 1] = f.buf[si + 1];
        sheet[di + 2] = f.buf[si + 2];
        sheet[di + 3] = f.buf[si + 3];
      }
    }
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const walk = path.join(OUT_DIR, `${spec.prefix}-walk.png`);
  const preview = path.join(OUT_DIR, `${spec.prefix}.png`);
  const attack = path.join(OUT_DIR, `${spec.prefix}-attack.png`);

  await sharp(sheet, { raw: { width: fw * cols, height: fh * rows, channels: 4 } })
    .png()
    .toFile(walk);

  // down idle = pack row 1 frame 0 = index 4
  const idle = frames[4];
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

  console.log(spec.label, 'ok', fw + 'x' + fh, 'sheet', fw * cols + 'x' + fh * rows);
  return { label: spec.label, fw, fh };
}

(async () => {
  const results = [];
  for (const s of SPECS) results.push(await processSpec(s));
  fs.writeFileSync('scripts/tmp-kiri-fix.json', JSON.stringify(results, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
