if (!process.env) process.env = {};
process.env.npm_package_config_libvips = '8.14.5';

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

/**
 * Vila da Névoa — sheets com refs grandes no topo + walk pequeno embaixo.
 * Extrai componentes e monta pack 4 dirs (up/down/left/right).
 */

const SPECS = [
  {
    label: 'male',
    src: 'C:/Users/marlo/.cursor/projects/c-Users-marlo-Projects-idle-mmorpg/assets/c__Users_marlo_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_image-a3a96b97-9401-48a7-ba3e-5d38ee418125.png',
    outDir: 'public/sprites/player/kiri',
    prefix: 'kiri-male',
  },
  {
    label: 'female',
    src: 'C:/Users/marlo/.cursor/projects/c-Users-marlo-Projects-idle-mmorpg/assets/c__Users_marlo_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_image-eaa11249-aef4-48f4-9bc5-c4308ca778bf.png',
    outDir: 'public/sprites/player/kiri',
    prefix: 'kiri-female',
  },
];

async function loadKeyed(src) {
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const ch = info.channels;
  const bg = { r: data[0], g: data[1], b: data[2] };
  const out = Buffer.from(data);
  for (let i = 0; i < out.length; i += ch) {
    const dist = Math.hypot(out[i] - bg.r, out[i + 1] - bg.g, out[i + 2] - bg.b);
    if (dist < 48) out[i + 3] = 0;
    else if (dist < 75) out[i + 3] = Math.round(out[i + 3] * ((dist - 48) / 27));
  }
  return { data: out, w, h, ch };
}

function opaque(data, w, ch, x, y) {
  return data[(y * w + x) * ch + 3] > 28;
}

function findComponents(data, w, h, ch, minCount = 200) {
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
      if (count < minCount) continue;
      comps.push({
        minX,
        maxX,
        minY,
        maxY,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
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

function flipH(buf, width, height) {
  const out = Buffer.alloc(buf.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const si = (y * width + x) * 4;
      const di = (y * width + (width - 1 - x)) * 4;
      out[di] = buf[si];
      out[di + 1] = buf[si + 1];
      out[di + 2] = buf[si + 2];
      out[di + 3] = buf[si + 3];
    }
  }
  return out;
}

async function packRows(rows, outPath) {
  let maxW = 0;
  let maxH = 0;
  const nCols = Math.max(...rows.map((r) => r.length));
  for (const row of rows) {
    for (const f of row) {
      maxW = Math.max(maxW, f.width);
      maxH = Math.max(maxH, f.height);
    }
  }
  const nRows = rows.length;
  const sheet = Buffer.alloc(maxW * nCols * maxH * nRows * 4);
  for (let r = 0; r < nRows; r++) {
    for (let c = 0; c < rows[r].length; c++) {
      const f = rows[r][c];
      const ox = Math.floor((maxW - f.width) / 2);
      const oy = maxH - f.height;
      for (let y = 0; y < f.height; y++) {
        for (let x = 0; x < f.width; x++) {
          const si = (y * f.width + x) * 4;
          const dx = c * maxW + ox + x;
          const dy = r * maxH + oy + y;
          const di = (dy * (maxW * nCols) + dx) * 4;
          sheet[di] = f.buf[si];
          sheet[di + 1] = f.buf[si + 1];
          sheet[di + 2] = f.buf[si + 2];
          sheet[di + 3] = f.buf[si + 3];
        }
      }
    }
  }
  await sharp(sheet, { raw: { width: maxW * nCols, height: maxH * nRows, channels: 4 } })
    .png()
    .toFile(outPath);
  return { fw: maxW, fh: maxH, columns: nCols, rows: nRows, walkFrames: nCols };
}

async function processSpec(spec) {
  const { data, w, h, ch } = await loadKeyed(spec.src);
  const comps = findComponents(data, w, h, ch, 180);
  comps.sort((a, b) => a.cy - b.cy || a.cx - b.cx);
  console.log(
    spec.label,
    'comps',
    comps.length,
    comps.map((c) => ({
      x: c.minX,
      y: c.minY,
      w: c.width,
      h: c.height,
      cy: Math.round(c.cy),
    })),
  );

  // Split large (refs) vs small (walk)
  const byArea = comps.slice().sort((a, b) => b.width * b.height - a.width * a.height);
  const large = byArea.filter((c) => c.height > h * 0.35).sort((a, b) => a.cx - b.cx);
  const small = comps.filter((c) => c.height <= h * 0.35).sort((a, b) => a.cy - b.cy || a.cx - b.cx);

  console.log(spec.label, 'large', large.length, 'small', small.length);

  // Group small into 2 rows by cy
  const midY =
    small.length > 0
      ? small.reduce((s, c) => s + c.cy, 0) / small.length
      : h * 0.7;
  let topSmall = small.filter((c) => c.cy < midY).sort((a, b) => a.cx - b.cx);
  let botSmall = small.filter((c) => c.cy >= midY).sort((a, b) => a.cx - b.cx);

  // Keep up to 4 per row (largest)
  const take4 = (arr) =>
    arr
      .slice()
      .sort((a, b) => b.width * b.height - a.width * a.height)
      .slice(0, 4)
      .sort((a, b) => a.cx - b.cx);

  topSmall = take4(topSmall);
  botSmall = take4(botSmall);
  console.log(spec.label, 'walk rows', topSmall.length, botSmall.length);

  const toFrame = (c) => ({ ...c, buf: extract(data, w, ch, c) });
  const frontWalk = topSmall.map(toFrame);
  const backWalk = botSmall.map(toFrame);

  // If female sheet: top=front, bot=back. Male may mix side walks.
  // Heuristic: prefer first large as front preview.
  const frontRef = large[0] ? toFrame(large[0]) : frontWalk[0];
  const backRef = large[1] ? toFrame(large[1]) : backWalk[0];

  // Build dirs: up=back, down=front, right=front (or side), left=mirrored right
  const downFrames = frontWalk.length ? frontWalk : [frontRef];
  const upFrames = backWalk.length ? backWalk : [backRef];
  // For left/right: use front walk if no dedicated side; mirror for left
  const rightFrames = downFrames.map((f) => ({
    width: f.width,
    height: f.height,
    buf: Buffer.from(f.buf),
  }));
  const leftFrames = rightFrames.map((f) => ({
    width: f.width,
    height: f.height,
    buf: flipH(f.buf, f.width, f.height),
  }));

  // Normalize frame count across rows (pad with last)
  const n = Math.max(downFrames.length, upFrames.length, 1);
  const pad = (arr) => {
    const out = arr.slice(0, n);
    while (out.length < n) out.push(out[out.length - 1] || frontRef);
    return out;
  };

  const rows = [pad(upFrames), pad(downFrames), pad(leftFrames), pad(rightFrames)];

  fs.mkdirSync(spec.outDir, { recursive: true });
  const walkPath = path.join(spec.outDir, `${spec.prefix}-walk.png`);
  const meta = await packRows(rows, walkPath);

  // Preview + attack from front ref, padded to frame size
  const previewPath = path.join(spec.outDir, `${spec.prefix}.png`);
  const attackPath = path.join(spec.outDir, `${spec.prefix}-attack.png`);
  await sharp(frontRef.buf, {
    raw: { width: frontRef.width, height: frontRef.height, channels: 4 },
  })
    .png()
    .toFile(previewPath);

  const atk = Buffer.alloc(meta.fw * meta.fh * 4);
  const ox = Math.floor((meta.fw - frontRef.width) / 2);
  const oy = meta.fh - frontRef.height;
  for (let y = 0; y < frontRef.height; y++) {
    for (let x = 0; x < frontRef.width; x++) {
      const si = (y * frontRef.width + x) * 4;
      const di = ((oy + y) * meta.fw + (ox + x)) * 4;
      atk[di] = frontRef.buf[si];
      atk[di + 1] = frontRef.buf[si + 1];
      atk[di + 2] = frontRef.buf[si + 2];
      atk[di + 3] = frontRef.buf[si + 3];
    }
  }
  await sharp(atk, { raw: { width: meta.fw, height: meta.fh, channels: 4 } })
    .png()
    .toFile(attackPath);

  console.log(spec.label, 'meta', meta);
  return { label: spec.label, ...meta };
}

(async () => {
  const results = [];
  for (const s of SPECS) results.push(await processSpec(s));
  fs.writeFileSync('scripts/tmp-kiri-meta.json', JSON.stringify(results, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
