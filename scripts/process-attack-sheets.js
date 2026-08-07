if (!process.env) process.env = {};
process.env.npm_package_config_libvips = '8.14.5';
const sharp = require('sharp');
const fs = require('fs');

const SPECS = [
  {
    label: 'male',
    src: 'C:/Users/marlo/.cursor/projects/c-Users-marlo-Projects-idle-mmorpg/assets/c__Users_marlo_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_6875608d-2b05-483b-b205-1d2b294cb7eb-b2b44294-c04a-47c4-8400-aa9ca19a056f.png',
    outAttack: 'public/sprites/player/generic/konoha-male-attack.png',
    outDash: 'public/sprites/player/generic/konoha-male-dash.png',
  },
  {
    label: 'female',
    src: 'C:/Users/marlo/.cursor/projects/c-Users-marlo-Projects-idle-mmorpg/assets/c__Users_marlo_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_61679939-620c-4ba1-8eb1-3cfc25ede3d8-a0ae776d-1baa-4e3b-bfa5-f7d0902d2fad.png',
    outAttack: 'public/sprites/player/generic/konoha-female-attack.png',
    outDash: 'public/sprites/player/generic/konoha-female-dash.png',
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
  return { data: out, w, h, ch, bg };
}

function opaque(data, w, ch, x, y) {
  return data[(y * w + x) * ch + 3] > 24;
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
      if (count < 120) continue;
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

async function packFrames(frames, outPath) {
  let maxW = 0;
  let maxH = 0;
  for (const f of frames) {
    maxW = Math.max(maxW, f.width);
    maxH = Math.max(maxH, f.height);
  }
  const n = frames.length;
  const sheet = Buffer.alloc(maxW * n * maxH * 4);
  for (let i = 0; i < n; i++) {
    const f = frames[i];
    const ox = Math.floor((maxW - f.width) / 2);
    const oy = maxH - f.height;
    for (let y = 0; y < f.height; y++) {
      for (let x = 0; x < f.width; x++) {
        const si = (y * f.width + x) * 4;
        const dx = i * maxW + ox + x;
        const dy = oy + y;
        const di = (dy * (maxW * n) + dx) * 4;
        sheet[di] = f.buf[si];
        sheet[di + 1] = f.buf[si + 1];
        sheet[di + 2] = f.buf[si + 2];
        sheet[di + 3] = f.buf[si + 3];
      }
    }
  }
  await sharp(sheet, { raw: { width: maxW * n, height: maxH, channels: 4 } })
    .png()
    .toFile(outPath);
  return { fw: maxW, fh: maxH, count: n };
}

async function process(spec) {
  const { data, w, h, ch, bg } = await loadKeyed(spec.src);
  console.log(spec.label, 'bg', bg, w + 'x' + h);
  let comps = findComponents(data, w, h, ch);
  const midY = h / 2;
  comps.sort((a, b) => {
    const ra = a.cy < midY ? 0 : 1;
    const rb = b.cy < midY ? 0 : 1;
    if (ra !== rb) return ra - rb;
    return a.minX - b.minX;
  });
  console.log(
    spec.label,
    'components',
    comps.length,
    comps.map((c) => ({ x: c.minX, w: c.width, h: c.height, cy: Math.round(c.cy) })),
  );

  // Keep largest blobs if oversplit
  if (comps.length > 10) {
    comps = comps
      .slice()
      .sort((a, b) => b.width * b.height - a.width * a.height)
      .slice(0, 7)
      .sort((a, b) => {
        const ra = a.cy < midY ? 0 : 1;
        const rb = b.cy < midY ? 0 : 1;
        if (ra !== rb) return ra - rb;
        return a.minX - b.minX;
      });
  }

  const frames = comps.map((c) => ({ ...c, buf: extract(data, w, ch, c) }));
  let top = frames.filter((f) => f.cy < midY).sort((a, b) => a.minX - b.minX);
  let bot = frames.filter((f) => f.cy >= midY).sort((a, b) => a.minX - b.minX);

  // Top: keep 4 largest (idle + punch). Bottom: 3 largest (dash), drop dust blobs.
  if (top.length > 4) {
    top = top
      .slice()
      .sort((a, b) => b.width * b.height - a.width * a.height)
      .slice(0, 4)
      .sort((a, b) => a.minX - b.minX);
  }
  if (bot.length > 3) {
    bot = bot
      .slice()
      .sort((a, b) => b.width * b.height - a.width * a.height)
      .slice(0, 3)
      .sort((a, b) => a.minX - b.minX);
  }
  console.log(spec.label, 'top', top.length, 'bot', bot.length);

  // Punch: skip ready stance if 4 frames on top
  const attackFrames = top.length >= 4 ? top.slice(1) : top;
  const dashFrames = bot.length ? bot : [];

  const atk = await packFrames(attackFrames, spec.outAttack);
  const dash = dashFrames.length
    ? await packFrames(dashFrames, spec.outDash)
    : null;
  console.log(spec.label, 'attack', atk, 'dash', dash);
  return { label: spec.label, attack: atk, dash };
}

(async () => {
  const results = [];
  for (const s of SPECS) results.push(await process(s));
  fs.writeFileSync('scripts/tmp-attack-meta.json', JSON.stringify(results, null, 2));
  console.log('done');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
