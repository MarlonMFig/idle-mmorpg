/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Extrai efeitos (VFX) do sheet Naruto (Jump Super Stars, DS).
 * Fonte: assets-src/jump-superstars-naruto.png (fundo azul solido 0,64,128).
 *
 * Para cada efeito:
 *  - detecta os frames (componentes conectados nao-fundo) dentro de uma regiao;
 *  - filtra por faixa X e tamanho minimo (remove texto japones / poeira);
 *  - aplica chroma key (fundo -> transparente);
 *  - normaliza todos os frames para uma celula uniforme (centralizado);
 *  - empacota horizontalmente num sprite sheet pronto pro Phaser.
 *
 * Saida:
 *  - public/sprites/vfx/<id>.png  (sprite sheet RGBA)
 *  - public/sprites/vfx/vfx-manifest.json  (frameWidth/frameHeight/frames)
 *  - assets-src/_vfx_<id>_preview.png (preview 3x para conferencia)
 */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'assets-src', 'jump-superstars-naruto.png');
const OUT_DIR = path.join(__dirname, '..', 'public', 'sprites', 'vfx');
const PREVIEW_DIR = path.join(__dirname, '..', 'assets-src');

const BG = [0, 64, 128];
const KEY_TOL = 40; // distancia por canal para considerar fundo

/** Configuracao de cada efeito a extrair. */
const EFFECTS = [
  {
    id: 'rasengan',
    // linha inferior do bloco "6-Koma" (esfera de chakra azul girando)
    // x0=450 pula as 4 nuvens de fumaca e o texto "螺旋丸!!"
    region: [450, 2888, 1035, 2984],
    minW: 12,
    minH: 12,
    minPixels: 90,
  },
  {
    id: 'chakra-burst',
    // "7-Koma": grande explosao de chakra azul (bijuu)
    // x0=210 pula o retrato e o traco de texto vertical
    region: [210, 3503, 1290, 3617],
    minW: 22,
    minH: 22,
    minPixels: 300,
  },
  {
    id: 'rasengan-gold',
    // "Super Rasengan / Spirit Bomb": esferas douradas girando
    region: [950, 4024, 1285, 4104],
    minW: 40,
    minH: 40,
    minPixels: 1500,
  },
  {
    id: 'smoke-poof',
    // "3-Koma": nuvem de fumaca (clone / substituicao / spawn)
    region: [110, 1595, 470, 1666],
    minW: 20,
    minH: 18,
    minPixels: 300,
  },
];

function isBg(r, g, b) {
  return (
    Math.abs(r - BG[0]) < KEY_TOL &&
    Math.abs(g - BG[1]) < KEY_TOL &&
    Math.abs(b - BG[2]) < KEY_TOL
  );
}

/** Componentes conectados (4-conn) nao-fundo dentro da regiao [x0,y0,x1,y1]. */
function findComponents(data, W, C, region, cfg) {
  const [x0, y0, x1, y1] = region;
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const seen = new Uint8Array(w * h);
  const boxes = [];
  const stack = [];
  for (let ly = 0; ly < h; ly++) {
    for (let lx = 0; lx < w; lx++) {
      const li = ly * w + lx;
      if (seen[li]) continue;
      const gi = ((y0 + ly) * W + (x0 + lx)) * C;
      if (isBg(data[gi], data[gi + 1], data[gi + 2])) {
        seen[li] = 1;
        continue;
      }
      let minx = lx,
        maxx = lx,
        miny = ly,
        maxy = ly,
        cnt = 0;
      stack.length = 0;
      stack.push(li);
      seen[li] = 1;
      while (stack.length) {
        const p = stack.pop();
        const px = p % w;
        const py = (p / w) | 0;
        cnt++;
        if (px < minx) minx = px;
        if (px > maxx) maxx = px;
        if (py < miny) miny = py;
        if (py > maxy) maxy = py;
        const nb = [
          [px - 1, py],
          [px + 1, py],
          [px, py - 1],
          [px, py + 1],
        ];
        for (const [nx, ny] of nb) {
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const ni = ny * w + nx;
          if (seen[ni]) continue;
          const ggi = ((y0 + ny) * W + (x0 + nx)) * C;
          if (isBg(data[ggi], data[ggi + 1], data[ggi + 2])) {
            seen[ni] = 1;
            continue;
          }
          seen[ni] = 1;
          stack.push(ni);
        }
      }
      boxes.push({
        x: x0 + minx,
        y: y0 + miny,
        w: maxx - minx + 1,
        h: maxy - miny + 1,
        n: cnt,
      });
    }
  }
  return boxes
    .filter((b) => b.w >= cfg.minW && b.h >= cfg.minH && b.n >= cfg.minPixels)
    .sort((a, b) => a.x - b.x);
}

/** Recorta um frame com chroma key -> RGBA buffer. */
async function cutFrame(src, box) {
  const { data, info } = await sharp(src)
    .extract({ left: box.x, top: box.y, width: box.w, height: box.h })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    if (isBg(data[o], data[o + 1], data[o + 2])) data[o + 3] = 0;
  }
  return { data, width, height };
}

async function buildEffect(src, srcMeta, cfg) {
  const { data, info } = srcMeta;
  const boxes = findComponents(data, info.width, info.channels, cfg.region, cfg);
  if (!boxes.length) {
    console.log(`  [${cfg.id}] nenhum frame detectado`);
    return null;
  }

  const frames = [];
  let cellW = 0;
  let cellH = 0;
  for (const box of boxes) {
    const f = await cutFrame(src, box);
    frames.push(f);
    if (f.width > cellW) cellW = f.width;
    if (f.height > cellH) cellH = f.height;
  }
  const PAD = 4;
  cellW += PAD * 2;
  cellH += PAD * 2;
  if (cellW % 2) cellW++;
  if (cellH % 2) cellH++;

  const sheetW = cellW * frames.length;
  const sheet = Buffer.alloc(sheetW * cellH * 4, 0);
  frames.forEach((f, idx) => {
    const offX = idx * cellW + Math.floor((cellW - f.width) / 2);
    const offY = Math.floor((cellH - f.height) / 2);
    for (let y = 0; y < f.height; y++) {
      for (let x = 0; x < f.width; x++) {
        const s = (y * f.width + x) * 4;
        if (f.data[s + 3] === 0) continue;
        const dx = offX + x;
        const dy = offY + y;
        const d = (dy * sheetW + dx) * 4;
        sheet[d] = f.data[s];
        sheet[d + 1] = f.data[s + 1];
        sheet[d + 2] = f.data[s + 2];
        sheet[d + 3] = f.data[s + 3];
      }
    }
  });

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, `${cfg.id}.png`);
  await sharp(sheet, { raw: { width: sheetW, height: cellH, channels: 4 } })
    .png()
    .toFile(outPath);

  await sharp(sheet, { raw: { width: sheetW, height: cellH, channels: 4 } })
    .resize({ width: sheetW * 3, kernel: 'nearest' })
    .png()
    .toFile(path.join(PREVIEW_DIR, `_vfx_${cfg.id}_preview.png`));

  console.log(
    `  [${cfg.id}] ${frames.length} frames  cell ${cellW}x${cellH}  -> ${path.relative(process.cwd(), outPath)}`,
  );
  return { id: cfg.id, frameWidth: cellW, frameHeight: cellH, frames: frames.length };
}

(async () => {
  const srcMeta = await sharp(SRC).raw().toBuffer({ resolveWithObject: true });
  const manifest = {};
  console.log('Extraindo VFX de', path.basename(SRC));
  for (const cfg of EFFECTS) {
    const r = await buildEffect(SRC, srcMeta, cfg);
    if (r) manifest[r.id] = { frameWidth: r.frameWidth, frameHeight: r.frameHeight, frames: r.frames };
  }
  fs.writeFileSync(
    path.join(OUT_DIR, 'vfx-manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n',
  );
  console.log('Manifest:', path.join(OUT_DIR, 'vfx-manifest.json'));
})();
