/**
 * GIF do Rasengan (chroma verde + contorno) → sheet horizontal Phaser.
 *
 * Uso: node scripts/process-naruto-rasengan-gif.js
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const INPUT = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'rasengan-gif.gif');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'naruto');
const OUT_FILE = 'rasengan.png';

// Contorno/fundo verde do GIF (amostra ~80,152,80 / brilho alto).
function isGreenKey(r, g, b) {
  if (g < 90) return false;
  if (g <= r + 25 && g <= b + 25) return false;
  return g > r + 28 && g > b + 28;
}

function isNearBlack(r, g, b) {
  return r < 28 && g < 28 && b < 28;
}

function keyFrame(data, w, h) {
  const out = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i += 1) {
    const si = i * 4;
    const r = data[si];
    const g = data[si + 1];
    const b = data[si + 2];
    const a = data[si + 3];
    const di = i * 4;
    if (a < 8 || isGreenKey(r, g, b) || isNearBlack(r, g, b)) {
      out[di + 3] = 0;
      continue;
    }
    // Remove contorno verde residual nos pixels limítrofes (meio-chave).
    if (g > r + 18 && g > b + 18 && g > 70 && r < 140 && b < 140) {
      out[di + 3] = 0;
      continue;
    }
    out[di] = r;
    out[di + 1] = g;
    out[di + 2] = b;
    out[di + 3] = 255;
  }
  return out;
}

function bbox(frame, w, h) {
  let minX = w;
  let maxX = -1;
  let minY = h;
  let maxY = -1;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (frame[(y * w + x) * 4 + 3] < 16) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 1, height: 1 };
  }
  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

/** Altura aproximada só do personagem (ignora VFX acima/lados). */
function bodyContentHeight(frame, w, h, box) {
  // Varrendo de baixo p/ cima, a proporção de pixels “pele/laranja/cabelo”
  // define o bloco do corpo; VFX azul claro/branco brilhante é 2º plano.
  let topBody = box.minY;
  for (let y = box.maxY; y >= box.minY; y -= 1) {
    let body = 0;
    let total = 0;
    for (let x = box.minX; x <= box.maxX; x += 1) {
      const i = (y * w + x) * 4;
      if (frame[i + 3] < 16) continue;
      total += 1;
      const r = frame[i];
      const g = frame[i + 1];
      const b = frame[i + 2];
      const isBright = r > 200 && g > 200 && b > 200;
      const isBlueFx = b > r + 20 && b > g && b > 140;
      if (!isBright && !isBlueFx) body += 1;
    }
    if (total > 4 && body / total >= 0.35) topBody = y;
    else if (total > 8 && body / total < 0.15 && y < box.maxY - 20) break;
  }
  return Math.max(12, box.maxY - topBody + 1);
}

function normalize(frames, widths, heights) {
  const boxes = frames.map((frame, i) => bbox(frame, widths[i], heights[i]));
  const contentHeights = frames.map((frame, i) =>
    bodyContentHeight(frame, widths[i], heights[i], boxes[i]),
  );
  const pad = 2;
  const fw = Math.max(...boxes.map((b) => b.width)) + pad * 2;
  const fh = Math.max(...boxes.map((b) => b.height)) + pad * 2;
  const out = frames.map((frame, index) => {
    const box = boxes[index];
    const srcW = widths[index];
    const canvas = Buffer.alloc(fw * fh * 4);
    const destX = Math.floor((fw - box.width) / 2);
    const destY = fh - box.height - pad;
    for (let y = 0; y < box.height; y += 1) {
      for (let x = 0; x < box.width; x += 1) {
        const si = ((box.minY + y) * srcW + (box.minX + x)) * 4;
        const di = ((destY + y) * fw + destX + x) * 4;
        canvas[di] = frame[si];
        canvas[di + 1] = frame[si + 1];
        canvas[di + 2] = frame[si + 2];
        canvas[di + 3] = frame[si + 3];
      }
    }
    return canvas;
  });
  return {
    frames: out,
    frameWidth: fw,
    frameHeight: fh,
    contentHeight: contentHeights[0],
  };
}

/**
 * Escala frames raw com nearest-neighbor (mantém pixel art).
 * Alvo: corpo do frame 0 ~100–120 px — cabe em textura GPU e 2× altura de jogo.
 */
async function scaleFrames(frames, fw, fh, targetBodyHeight, contentHeight) {
  const scale = Math.min(1, targetBodyHeight / Math.max(1, contentHeight));
  if (scale >= 0.99) {
    return { frames, frameWidth: fw, frameHeight: fh, contentHeight, scale: 1 };
  }
  const outW = Math.max(1, Math.round(fw * scale));
  const outH = Math.max(1, Math.round(fh * scale));
  const outContent = Math.max(1, Math.round(contentHeight * scale));
  const out = [];
  for (const frame of frames) {
    const { data } = await sharp(frame, {
      raw: { width: fw, height: fh, channels: 4 },
    })
      .resize(outW, outH, { kernel: sharp.kernel.nearest })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    out.push(data);
  }
  return {
    frames: out,
    frameWidth: outW,
    frameHeight: outH,
    contentHeight: outContent,
    scale,
  };
}

/** Grelha multi-linha para caber no limite WebGL (≤4096). */
function stitchGrid(frames, fw, fh, maxTexture = 4096) {
  let cols = Math.min(frames.length, Math.max(1, Math.floor(maxTexture / fw)));
  // Preferir ~5–8 colunas para sheet quadrada.
  cols = Math.min(cols, 6);
  while (cols > 1 && cols * fw > maxTexture) cols -= 1;
  const rows = Math.ceil(frames.length / cols);
  if (rows * fh > maxTexture) {
    throw new Error(
      `folha ${cols}x${rows} @ ${fw}x${fh} excede ${maxTexture}px — reduza a escala`,
    );
  }
  const outW = cols * fw;
  const outH = rows * fh;
  const out = Buffer.alloc(outW * outH * 4);
  frames.forEach((frame, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    for (let y = 0; y < fh; y += 1) {
      const src = y * fw * 4;
      const dest = ((row * fh + y) * outW + col * fw) * 4;
      frame.copy(out, dest, src, src + fw * 4);
    }
  });
  return { data: out, width: outW, height: outH, cols, rows };
}

async function extractPage(pageIndex) {
  const { data, info } = await sharp(INPUT, {
    animated: true,
    page: pageIndex,
    pages: 1,
    limitInputPixels: false,
  })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Algumas builds do sharp devolvem a pilha inteira se page falhar.
  const pageH = info.pageHeight || info.height;
  const w = info.width;
  let h = info.height;
  let slice = data;
  if (h > pageH * 1.5) {
    h = pageH;
    const offset = pageIndex * pageH * w * 4;
    slice = data.subarray(offset, offset + w * h * 4);
  }
  return { data: keyFrame(slice, w, h), width: w, height: h };
}

async function main() {
  if (!fs.existsSync(INPUT)) {
    throw new Error(`GIF não encontrado: ${INPUT}`);
  }

  const metaProbe = await sharp(INPUT, { animated: true, limitInputPixels: false }).metadata();
  const pageCount = metaProbe.pages || 1;
  console.log(`rasengan-gif: ${metaProbe.width}x${metaProbe.height} pages=${pageCount}`);

  const cut = [];
  for (let i = 0; i < pageCount; i += 1) {
    const page = await extractPage(i);
    const box = bbox(page.data, page.width, page.height);
    console.log(
      `  frame ${i}: ${page.width}x${page.height} content=${box.width}x${box.height}`,
    );
    cut.push(page);
  }

  const normalized = normalize(
    cut.map((c) => c.data),
    cut.map((c) => c.width),
    cut.map((c) => c.height),
  );
  // ~110 px de corpo (≈2× CHARACTER_DISPLAY_HEIGHT) — textura < 4k.
  const scaled = await scaleFrames(
    normalized.frames,
    normalized.frameWidth,
    normalized.frameHeight,
    110,
    normalized.contentHeight,
  );
  const sheet = stitchGrid(scaled.frames, scaled.frameWidth, scaled.frameHeight);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, OUT_FILE);
  await sharp(sheet.data, {
    raw: { width: sheet.width, height: sheet.height, channels: 4 },
  })
    .png()
    .toFile(outPath);

  const metaPath = path.join(OUT_DIR, 'meta.json');
  const meta = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf8')) : {};
  meta['naruto-rasengan'] = {
    image: `/sprites/player/naruto/${OUT_FILE}`,
    frameWidth: scaled.frameWidth,
    frameHeight: scaled.frameHeight,
    frameCount: scaled.frames.length,
    contentHeight: scaled.contentHeight,
    sheetCols: sheet.cols,
    sheetRows: sheet.rows,
    source: 'rasengan-gif.gif',
    frameRate: 10,
    durationMs: Math.round((scaled.frames.length / 10) * 1000),
  };
  fs.writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`);

  console.log(
    `-> ${path.relative(ROOT, outPath)} ${sheet.width}x${sheet.height}`,
    `grid=${sheet.cols}x${sheet.rows}`,
    `fw=${scaled.frameWidth} fh=${scaled.frameHeight}`,
    `count=${scaled.frames.length} contentH=${scaled.contentHeight}`,
    `scale=${scaled.scale.toFixed(3)}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
