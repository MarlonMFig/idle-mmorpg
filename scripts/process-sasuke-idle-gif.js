/**
 * GIF idle (parado) do Sasuke → public/sprites/player/sasuke/idle.png
 *
 * Uso: node scripts/process-sasuke-idle-gif.js
 *
 * Fonte: fundo preto + contorno verde (vários tons). Outline preto do
 * personagem é mantido; lixo flutuante e residual verde somem.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const INPUT = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'sasuke-idle.gif');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'sasuke');
const TARGET_BODY_H = 48; // = CHARACTER_DISPLAY_HEIGHT → scale 1x no jogo, sem double-blur

/** Todos os tons do contorno verde deste GIF (inclui 7,19,7). */
function isGreen(r, g, b) {
  // Verde clássico / brilhante
  if (g >= 50 && r <= 70 && b <= 70 && g >= r + 12 && g >= b + 12) return true;
  // Residual escuro: G é canal dominante, baixo R/B
  if (g >= 14 && r <= 45 && b <= 45 && g >= r + 6 && g >= b + 6 && g > r && g > b) {
    // evita cinza (74,74,74) e navy (8,41,74)
    if (Math.abs(g - b) < 6 && Math.abs(g - r) < 6) return false;
    if (b > g) return false; // azul navy
    return true;
  }
  return false;
}

function isNeutralDark(r, g, b) {
  // Preto / cinza-preto do fundo (não navy nem verde)
  if (r > 32 || g > 32 || b > 32) return false;
  return Math.max(r, g, b) - Math.min(r, g, b) <= 12;
}

function isBodyColor(r, g, b) {
  if (isGreen(r, g, b) || isNeutralDark(r, g, b)) return false;
  return true;
}

function bodyNeighborCount(data, w, h, x, y) {
  let n = 0;
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const i = (ny * w + nx) * 4;
      if (data[i + 3] < 12) continue;
      if (isBodyColor(data[i], data[i + 1], data[i + 2])) n += 1;
    }
  }
  return n;
}

function canFlood(data, w, h, x, y) {
  const i = (y * w + x) * 4;
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  const a = data[i + 3];
  if (a < 12) return true;
  if (isGreen(r, g, b)) return true;
  // Preto de fundo: sem vizinho de cor do corpo
  if (isNeutralDark(r, g, b) && bodyNeighborCount(data, w, h, x, y) === 0) return true;
  return false;
}

function floodMark(data, w, h) {
  const n = w * h;
  const marked = new Uint8Array(n);
  const q = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = y * w + x;
    if (marked[i]) return;
    if (!canFlood(data, w, h, x, y)) return;
    marked[i] = 1;
    q.push(i);
  };
  for (let x = 0; x < w; x += 1) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y += 1) {
    push(0, y);
    push(w - 1, y);
  }
  while (q.length) {
    const i = q.pop();
    const x = i % w;
    const y = (i / w) | 0;
    push(x - 1, y);
    push(x + 1, y);
    push(x, y - 1);
    push(x, y + 1);
  }
  return marked;
}

/** Remove pixel se for verde residual ou lixo preto sem miolo. */
function cleanEdge(frame, w, h, passes = 2) {
  let cur = frame;
  for (let p = 0; p < passes; p += 1) {
    const next = Buffer.from(cur);
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const i = (y * w + x) * 4;
        if (cur[i + 3] < 16) continue;
        const r = cur[i];
        const g = cur[i + 1];
        const b = cur[i + 2];

        let empty = 0;
        let body = 0;
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) {
              empty += 1;
              continue;
            }
            const ni = (ny * w + nx) * 4;
            if (cur[ni + 3] < 16) empty += 1;
            else if (isBodyColor(cur[ni], cur[ni + 1], cur[ni + 2])) body += 1;
          }
        }

        if (isGreen(r, g, b)) {
          next[i + 3] = 0;
          continue;
        }
        // Poeira preta / floating
        if (isNeutralDark(r, g, b) && body === 0) {
          next[i + 3] = 0;
          continue;
        }
        if (isNeutralDark(r, g, b) && empty >= 4 && body <= 1) {
          next[i + 3] = 0;
        }
      }
    }
    cur = next;
  }
  return cur;
}

function keepLargest(frame, w, h) {
  const n = w * h;
  const seen = new Uint8Array(n);
  let best = [];
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  for (let s = 0; s < n; s += 1) {
    if (seen[s] || frame[s * 4 + 3] < 16) continue;
    const stack = [s];
    const comp = [];
    seen[s] = 1;
    while (stack.length) {
      const i = stack.pop();
      comp.push(i);
      const x = i % w;
      const y = (i / w) | 0;
      for (const [dx, dy] of dirs) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        if (seen[ni] || frame[ni * 4 + 3] < 16) continue;
        seen[ni] = 1;
        stack.push(ni);
      }
    }
    if (comp.length > best.length) best = comp;
  }
  const out = Buffer.alloc(n * 4);
  for (const i of best) {
    const si = i * 4;
    out[si] = frame[si];
    out[si + 1] = frame[si + 1];
    out[si + 2] = frame[si + 2];
    out[si + 3] = frame[si + 3];
  }
  return out;
}

function fillHoles(frame, w, h) {
  const next = Buffer.from(frame);
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const i = (y * w + x) * 4;
      if (frame[i + 3] >= 16) continue;
      let c = 0;
      let rs = 0;
      let gs = 0;
      let bs = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const ni = ((y + dy) * w + (x + dx)) * 4;
          if (frame[ni + 3] < 16) continue;
          if (isGreen(frame[ni], frame[ni + 1], frame[ni + 2])) continue;
          c += 1;
          rs += frame[ni];
          gs += frame[ni + 1];
          bs += frame[ni + 2];
        }
      }
      if (c >= 6) {
        next[i] = Math.round(rs / c);
        next[i + 1] = Math.round(gs / c);
        next[i + 2] = Math.round(bs / c);
        next[i + 3] = 255;
      }
    }
  }
  return next;
}

function keyFrame(data, w, h) {
  const marked = floodMark(data, w, h);
  const n = w * h;
  let out = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i += 1) {
    const si = i * 4;
    const r = data[si];
    const g = data[si + 1];
    const b = data[si + 2];
    // Verde some sempre (mesmo no miolo residual)
    if (marked[i] || isGreen(r, g, b)) {
      out[si + 3] = 0;
      continue;
    }
    out[si] = r;
    out[si + 1] = g;
    out[si + 2] = b;
    out[si + 3] = 255;
  }
  out = cleanEdge(out, w, h, 3);
  out = keepLargest(out, w, h);
  out = fillHoles(out, w, h);
  out = cleanEdge(out, w, h, 1);
  out = keepLargest(out, w, h);
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

function normalize(frames, widths, heights) {
  const boxes = frames.map((frame, i) => bbox(frame, widths[i], heights[i]));
  const pad = 1;
  const fw = Math.max(...boxes.map((b) => b.width)) + pad * 2;
  const fh = Math.max(...boxes.map((b) => b.height)) + pad * 2;
  // Alinha pés: bottom, centro horizontal
  const framesOut = frames.map((frame, index) => {
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
    frames: framesOut,
    frameWidth: fw,
    frameHeight: fh,
    contentHeight: boxes[0].height,
  };
}

function stitchRow(frames, fw, fh) {
  const outW = fw * frames.length;
  const out = Buffer.alloc(outW * fh * 4);
  frames.forEach((frame, index) => {
    for (let y = 0; y < fh; y += 1) {
      frame.copy(out, (y * outW + index * fw) * 4, y * fw * 4, (y + 1) * fw * 4);
    }
  });
  return { data: out, width: outW, height: fh };
}

async function extractPage(pageIndex) {
  // Exporta PNG intermediário para forçar composite correto do gif
  const tmp = path.join(OUT_DIR, `_tmp-idle-${pageIndex}.png`);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  await sharp(INPUT, {
    animated: true,
    page: pageIndex,
    pages: 1,
    limitInputPixels: false,
  })
    .ensureAlpha()
    .png()
    .toFile(tmp);

  const { data, info } = await sharp(tmp).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  fs.unlinkSync(tmp);

  return {
    data: keyFrame(data, info.width, info.height),
    width: info.width,
    height: info.height,
  };
}

async function main() {
  if (!fs.existsSync(INPUT)) throw new Error(`GIF não encontrado: ${INPUT}`);

  const probe = await sharp(INPUT, { animated: true, limitInputPixels: false }).metadata();
  const pages = probe.pages || 1;
  console.log(`sasuke-idle.gif pages=${pages} delay=${probe.delay?.[0]}ms`);

  const cut = [];
  for (let i = 0; i < pages; i += 1) {
    const page = await extractPage(i);
    const box = bbox(page.data, page.width, page.height);
    console.log(`  f${i}: ${page.width}x${page.height} content=${box.width}x${box.height}`);
    cut.push(page);
  }

  const normalized = normalize(
    cut.map((c) => c.data),
    cut.map((c) => c.width),
    cut.map((c) => c.height),
  );

  const scale = Math.min(1, TARGET_BODY_H / Math.max(1, normalized.contentHeight));
  const outW = Math.max(1, Math.round(normalized.frameWidth * scale));
  const outH = Math.max(1, Math.round(normalized.frameHeight * scale));
  const contentHeight = Math.max(1, Math.round(normalized.contentHeight * scale));

  const frames = [];
  for (const frame of normalized.frames) {
    let { data } = await sharp(frame, {
      raw: {
        width: normalized.frameWidth,
        height: normalized.frameHeight,
        channels: 4,
      },
    })
      .resize(outW, outH, { kernel: sharp.kernel.nearest })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    data = cleanEdge(data, outW, outH, 2);
    data = keepLargest(data, outW, outH);
    frames.push(data);
  }

  const sheet = stitchRow(frames, outW, outH);
  await sharp(sheet.data, {
    raw: { width: sheet.width, height: sheet.height, channels: 4 },
  })
    .png()
    .toFile(path.join(OUT_DIR, 'idle.png'));

  const fps = probe.delay?.[0] ? Math.round(1000 / probe.delay[0]) : 7;
  const metaPath = path.join(OUT_DIR, 'meta.json');
  const meta = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf8')) : {};
  meta['sasuke-idle'] = {
    image: '/sprites/player/sasuke/idle.png',
    frameWidth: outW,
    frameHeight: outH,
    frameCount: frames.length,
    contentHeight,
    source: 'sasuke-idle.gif',
    frameRate: fps,
    durationMs: pages * (probe.delay?.[0] || 150),
  };
  fs.writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`);

  // QC
  let green = 0;
  let black = 0;
  let op = 0;
  for (let i = 0; i < sheet.data.length; i += 4) {
    if (sheet.data[i + 3] < 16) continue;
    op += 1;
    if (isGreen(sheet.data[i], sheet.data[i + 1], sheet.data[i + 2])) green += 1;
    if (isNeutralDark(sheet.data[i], sheet.data[i + 1], sheet.data[i + 2])) black += 1;
  }

  console.log(
    `-> idle.png ${sheet.width}x${sheet.height} fw=${outW} fh=${outH}`,
    `count=${frames.length} contentH=${contentHeight}`,
    `greenLeft=${green} darkLeft=${black} opaque=${op}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
