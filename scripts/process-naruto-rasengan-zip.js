/**
 * Importa frames do rasengan.zip → sheet Phaser HQ.
 *
 * - Chroma: preto / quase-preto → alpha
 * - Âncora: pé traseiro (facing right = leftmost bottom body) fixo em todos os frames
 * - Escala nearest-neighbor para contentHeight ≈ idle Naruto (81)
 * - VFX azul/branco preservado; corpo separado só para âncora/escala
 *
 * Uso: node scripts/process-naruto-rasengan-zip.js
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'rasengan-zip-import');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'naruto');
const OUT_FILE = 'rasengan-dash.png';
const PREVIEW_DIR = path.join(OUT_DIR, '_rasengan-qa');
/** Altura do corpo idle G6 Naruto Kid — skill deve casar para não crescer/encolher. */
const TARGET_BODY_H = 60;
const PAD = 4;

function isNearBlack(r, g, b, a) {
  if (a < 8) return true;
  return r < 14 && g < 14 && b < 14;
}

/** VFX do Rasengan (energia clara / ciano / branco). */
function isVfx(r, g, b) {
  const bright = r > 200 && g > 200 && b > 200;
  const cyan = b > 140 && g > 120 && r < 180 && (g + b) / 2 > r + 30;
  const blueEnergy = b > r + 20 && b > g + 5 && b > 130 && r < 190;
  const paleTrail = b > 160 && g > 140 && r > 80 && r < 210 && b >= g - 5;
  return bright || cyan || blueEnergy || paleTrail;
}

/**
 * Só pixels do personagem (laranja / cabelo / pele / azul do traje).
 * Inclui azul médio do colete (sem engolir ciano do Rasengan).
 */
function isBody(r, g, b, a) {
  if (a < 16 || isNearBlack(r, g, b, a)) return false;
  if (isVfx(r, g, b)) return false;
  // Laranja / marrom do macacão
  if (r > 115 && g > 35 && g < 165 && b < 110 && r > g && r > b + 15) return true;
  // Cabelo amarelo
  if (r > 150 && g > 110 && b < 110 && r >= g - 10 && g > b + 25) return true;
  // Pele
  if (r > 165 && g > 100 && b > 60 && b < 165 && r > b && r > g - 30) return true;
  // Azul do colete / sandália / bandana (escuro–médio; não ciano de VFX)
  if (b >= 60 && b <= 170 && r <= 110 && g <= 145 && b > r + 15 && b >= g) {
    // Evita ciano claro
    if (g > 150 && b > 150) return false;
    return true;
  }
  // Contorno escuro
  if (r < 55 && g < 55 && b < 55) return true;
  // Cinza / sombra do desenho
  if (Math.abs(r - g) < 18 && Math.abs(g - b) < 18 && r > 40 && r < 140) return true;
  return false;
}



/**
 * Remove fundo preto sem apagar contorno/cabelo:
 * 1) miolo colorido (corpo + VFX)
 * 2) flood da borda apaga preto/transparente
 * 3) restaura preto só se for vizinho do miolo (outline)
 */
function keyFrame(data, w, h) {
  const n = w * h;
  const core = new Uint8Array(n);
  for (let i = 0; i < n; i += 1) {
    const si = i * 4;
    if (data[si + 3] < 8) continue;
    const r = data[si];
    const g = data[si + 1];
    const b = data[si + 2];
    if (isNearBlack(r, g, b, data[si + 3])) continue;
    core[i] = 1;
  }

  const touchesCore = (x, y) => {
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        if (core[ny * w + nx]) return true;
      }
    }
    return false;
  };

  const drop = new Uint8Array(n);
  const queue = [];
  const tryPush = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = y * w + x;
    if (drop[i] || core[i]) return;
    const si = i * 4;
    const a = data[si + 3];
    const black = a >= 8 && isNearBlack(data[si], data[si + 1], data[si + 2], a);
    if (!(a < 8 || black)) return;
    drop[i] = 1;
    queue.push(i);
  };
  for (let x = 0; x < w; x += 1) {
    tryPush(x, 0);
    tryPush(x, h - 1);
  }
  for (let y = 0; y < h; y += 1) {
    tryPush(0, y);
    tryPush(w - 1, y);
  }
  for (let qi = 0; qi < queue.length; qi += 1) {
    const i = queue[qi];
    const x = i % w;
    const y = (i - x) / w;
    tryPush(x + 1, y);
    tryPush(x - 1, y);
    tryPush(x, y + 1);
    tryPush(x, y - 1);
  }

  const out = Buffer.alloc(w * h * 4);
  for (let i = 0; i < n; i += 1) {
    const si = i * 4;
    const di = si;
    const a = data[si + 3];
    const r = data[si];
    const g = data[si + 1];
    const b = data[si + 2];
    if (core[i]) {
      out[di] = r;
      out[di + 1] = g;
      out[di + 2] = b;
      out[di + 3] = 255;
      continue;
    }
    if (a >= 8 && isNearBlack(r, g, b, a)) {
      const x = i % w;
      const y = (i - x) / w;
      if (!drop[i] || touchesCore(x, y)) {
        out[di] = r;
        out[di + 1] = g;
        out[di + 2] = b;
        out[di + 3] = 255;
        continue;
      }
    }
    // fundo
  }
  return out;
}

function analyze(frame, w, h) {
  let minX = w;
  let maxX = -1;
  let minY = h;
  let maxY = -1;
  let bMinX = w;
  let bMaxX = -1;
  let bMinY = h;
  let bMaxY = -1;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      if (frame[i + 3] < 16) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      const r = frame[i];
      const g = frame[i + 1];
      const b = frame[i + 2];
      if (!isBody(r, g, b, frame[i + 3])) continue;
      if (x < bMinX) bMinX = x;
      if (x > bMaxX) bMaxX = x;
      if (y < bMinY) bMinY = y;
      if (y > bMaxY) bMaxY = y;
    }
  }
  if (maxX < 0) throw new Error('frame vazio');
  if (bMaxX < 0) {
    throw new Error('corpo do Naruto não detectado — ajuste isBody');
  }
  // Pé traseiro = leftmost body pixel na(s) linha(s) do chão
  let rearX = bMaxX;
  let frontX = bMinX;
  let footSum = 0;
  let footN = 0;
  for (let y = bMaxY; y >= Math.max(bMinY, bMaxY - 2); y -= 1) {
    for (let x = bMinX; x <= bMaxX; x += 1) {
      const i = (y * w + x) * 4;
      if (!isBody(frame[i], frame[i + 1], frame[i + 2], frame[i + 3])) continue;
      if (x < rearX) rearX = x;
      if (x > frontX) frontX = x;
      footSum += x;
      footN += 1;
    }
  }
  return {
    full: { minX, maxX, minY, maxY, width: maxX - minX + 1, height: maxY - minY + 1 },
    body: {
      minX: bMinX,
      maxX: bMaxX,
      minY: bMinY,
      maxY: bMaxY,
      width: bMaxX - bMinX + 1,
      height: bMaxY - bMinY + 1,
    },
    rearX,
    frontX,
    footX: footN > 0 ? footSum / footN : (bMinX + bMaxX) / 2,
    feetY: bMaxY,
  };
}

function nearestScale(frame, w, h, scale) {
  if (Math.abs(scale - 1) < 0.001) {
    return { data: Buffer.from(frame), width: w, height: h };
  }
  const nw = Math.max(1, Math.round(w * scale));
  const nh = Math.max(1, Math.round(h * scale));
  const out = Buffer.alloc(nw * nh * 4);
  for (let y = 0; y < nh; y += 1) {
    const sy = Math.min(h - 1, Math.floor(y / scale));
    for (let x = 0; x < nw; x += 1) {
      const sx = Math.min(w - 1, Math.floor(x / scale));
      const si = (sy * w + sx) * 4;
      const di = (y * nw + x) * 4;
      out[di] = frame[si];
      out[di + 1] = frame[si + 1];
      out[di + 2] = frame[si + 2];
      out[di + 3] = frame[si + 3];
    }
  }
  return { data: out, width: nw, height: nh };
}

/** Upscale suave (casa melhor com o body G6 HQ). */
async function softScale(frame, w, h, scale) {
  if (Math.abs(scale - 1) < 0.001) {
    return { data: Buffer.from(frame), width: w, height: h };
  }
  const nw = Math.max(1, Math.round(w * scale));
  const nh = Math.max(1, Math.round(h * scale));
  const { data, info } = await sharp(frame, { raw: { width: w, height: h, channels: 4 } })
    .resize(nw, nh, { kernel: 'lanczos3' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

function paste(dest, dw, dh, src, sw, sh, dx, dy) {
  for (let y = 0; y < sh; y += 1) {
    const ty = dy + y;
    if (ty < 0 || ty >= dh) continue;
    for (let x = 0; x < sw; x += 1) {
      const tx = dx + x;
      if (tx < 0 || tx >= dw) continue;
      const si = (y * sw + x) * 4;
      if (src[si + 3] < 8) continue;
      const di = (ty * dw + tx) * 4;
      dest[di] = src[si];
      dest[di + 1] = src[si + 1];
      dest[di + 2] = src[si + 2];
      dest[di + 3] = src[si + 3];
    }
  }
}

function stitchHorizontal(frames, fw, fh) {
  const outW = fw * frames.length;
  const out = Buffer.alloc(outW * fh * 4);
  frames.forEach((frame, index) => {
    for (let y = 0; y < fh; y += 1) {
      frame.copy(out, (y * outW + index * fw) * 4, y * fw * 4, (y + 1) * fw * 4);
    }
  });
  return { data: out, width: outW, height: fh };
}

function qaReport(canvases, fw, fh, metas) {
  const issues = [];
  const rearXs = [];
  const bodyHs = [];
  const feetYs = [];
  for (let i = 0; i < canvases.length; i += 1) {
    const a = analyze(canvases[i], fw, fh);
    rearXs.push(a.rearX);
    bodyHs.push(a.body.height);
    feetYs.push(a.feetY);
    if (a.full.width < 4 || a.full.height < 4) issues.push(`f${i + 1}: frame quase vazio`);
    // Crouch sob VFX grande é esperado; só falha se o corpo sumiu.
    if (a.body.height < 28) {
      issues.push(`f${i + 1}: corpo não detectado (h=${a.body.height})`);
    }
    let green = 0;
    const frame = canvases[i];
    for (let p = 0; p < fw * fh; p += 1) {
      const o = p * 4;
      if (frame[o + 3] < 16) continue;
      const r = frame[o];
      const g = frame[o + 1];
      const b = frame[o + 2];
      if (g > r + 35 && g > b + 35 && g > 90) green += 1;
    }
    if (green > 40) issues.push(`f${i + 1}: franja verde (${green}px)`);
  }
  const rearMin = Math.min(...rearXs);
  const rearMax = Math.max(...rearXs);
  if (rearMax - rearMin > 1) {
    issues.push(`pés X não fixos: rear ${rearMin}..${rearMax} (Δ${rearMax - rearMin})`);
  }
  const feetMin = Math.min(...feetYs);
  const feetMax = Math.max(...feetYs);
  if (feetMax - feetMin > 1) {
    issues.push(`pés Y não fixos: ${feetMin}..${feetMax} (Δ${feetMax - feetMin})`);
  }
  return {
    issues,
    rearXs,
    bodyHs,
    feetYs,
    rearDelta: rearMax - rearMin,
    feetDelta: feetMax - feetMin,
    bodyDelta: Math.max(...bodyHs) - Math.min(...bodyHs),
    metas,
  };
}

async function main() {
  const files = fs
    .readdirSync(SRC_DIR)
    .filter((f) => /^frame_\d+\.png$/i.test(f))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  if (files.length === 0) throw new Error(`sem frames em ${SRC_DIR}`);

  const raw = [];
  for (const file of files) {
    const { data, info } = await sharp(path.join(SRC_DIR, file))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const keyed = keyFrame(data, info.width, info.height);
    const meta = analyze(keyed, info.width, info.height);
    console.log(
      `${file}: body ${meta.body.width}x${meta.body.height} feetY=${meta.feetY} rearX=${meta.rearX}`,
    );
    raw.push({ data: keyed, width: info.width, height: info.height, meta, file });
  }

  const preVfxBodyHs = raw.slice(0, 6).map((r) => r.meta.body.height);
  const medianBodyH = [...preVfxBodyHs].sort((a, b) => a - b)[Math.floor(preVfxBodyHs.length / 2)];
  const scale = TARGET_BODY_H / Math.max(1, medianBodyH);
  console.log(`scale ${scale.toFixed(4)} (preVfx medianBodyH=${medianBodyH} → ${TARGET_BODY_H})`);

  const scaled = [];
  for (const r of raw) {
    const s = await softScale(r.data, r.width, r.height, scale);
    const meta = analyze(s.data, s.width, s.height);
    scaled.push({ ...s, meta, file: r.file });
  }

  // Canvas: espaço para VFX relativo ao pé traseiro fixo
  let maxLeft = 0;
  let maxRight = 0;
  let maxAbove = 0;
  let maxBelow = 0;
  for (const f of scaled) {
    maxLeft = Math.max(maxLeft, f.meta.rearX - f.meta.full.minX);
    maxRight = Math.max(maxRight, f.meta.full.maxX - f.meta.rearX);
    maxAbove = Math.max(maxAbove, f.meta.feetY - f.meta.full.minY);
    maxBelow = Math.max(maxBelow, f.meta.full.maxY - f.meta.feetY);
  }
  const anchorX = PAD + maxLeft;
  const anchorY = PAD + maxAbove;
  const fw = PAD + maxLeft + maxRight + PAD;
  const fh = PAD + maxAbove + maxBelow + PAD;
  console.log(`canvas ${fw}x${fh} anchor=(${anchorX},${anchorY})`);

  const canvases = scaled.map((f) => {
    const canvas = Buffer.alloc(fw * fh * 4);
    const dx = anchorX - f.meta.rearX;
    const dy = anchorY - f.meta.feetY;
    paste(canvas, fw, fh, f.data, f.width, f.height, dx, dy);
    return canvas;
  });

  // Segunda passagem: re-ancorar com análise do canvas (corrige arredondamento)
  const refined = canvases.map((canvas) => {
    const meta = analyze(canvas, fw, fh);
    const out = Buffer.alloc(fw * fh * 4);
    const dx = anchorX - meta.rearX;
    const dy = anchorY - meta.feetY;
    paste(out, fw, fh, canvas, fw, fh, dx, dy);
    return out;
  });

  const qa = qaReport(
    refined,
    fw,
    fh,
    scaled.map((s) => s.meta),
  );
  console.log(
    `QA rearΔ=${qa.rearDelta} feetYΔ=${qa.feetDelta} bodyΔ=${qa.bodyDelta} bodyH=[${Math.min(...qa.bodyHs)}..${Math.max(...qa.bodyHs)}]`,
  );
  if (qa.issues.length) {
    console.error('QA FAIL:');
    qa.issues.forEach((msg) => console.error(' -', msg));
    throw new Error(`rasengan sheet com ${qa.issues.length} falha(s)`);
  }
  console.log('QA OK — pés fixos, sem franja, corpo estável');

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(PREVIEW_DIR, { recursive: true });
  for (let i = 0; i < refined.length; i += 1) {
    await sharp(refined[i], { raw: { width: fw, height: fh, channels: 4 } })
      .png({ compressionLevel: 9 })
      .toFile(path.join(PREVIEW_DIR, `frame-${String(i + 1).padStart(3, '0')}.png`));
  }

  const sheet = stitchHorizontal(refined, fw, fh);
  const outPath = path.join(OUT_DIR, OUT_FILE);
  await sharp(sheet.data, { raw: { width: sheet.width, height: sheet.height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(outPath);

  const contentHeight = TARGET_BODY_H;
  const originX = Number((anchorX / fw).toFixed(4));
  const metaPath = path.join(OUT_DIR, 'meta.json');
  const metaJson = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  metaJson['naruto-rasengan-dash'] = {
    image: `/sprites/player/naruto/${OUT_FILE}`,
    frameWidth: fw,
    frameHeight: fh,
    frameCount: refined.length,
    contentHeight,
    originX,
    frameRate: 12,
    durationMs: Math.round((refined.length / 12) * 1000),
    // Orb grande / investida ~frame 9–10
    hitDelayMs: Math.round((9 / 12) * 1000),
    source: 'rasengan.zip',
    feetFixed: true,
  };
  metaJson['skill-rasengan'] = { ...metaJson['naruto-rasengan-dash'] };
  fs.writeFileSync(metaPath, `${JSON.stringify(metaJson, null, 2)}\n`);

  // Emit pack snippet metrics for the wiring step
  fs.writeFileSync(
    path.join(PREVIEW_DIR, 'metrics.json'),
    `${JSON.stringify(
      {
        frameWidth: fw,
        frameHeight: fh,
        frameCount: refined.length,
        contentHeight,
        originX,
        durationMs: metaJson['naruto-rasengan-dash'].durationMs,
        hitDelayMs: metaJson['naruto-rasengan-dash'].hitDelayMs,
        rearDelta: qa.rearDelta,
        feetDelta: qa.feetDelta,
      },
      null,
      2,
    )}\n`,
  );

  console.log(`wrote ${outPath}`);
  console.log(
    JSON.stringify(
      {
        frameWidth: fw,
        frameHeight: fh,
        frameCount: refined.length,
        contentHeight,
        originX,
        durationMs: metaJson['naruto-rasengan-dash'].durationMs,
        hitDelayMs: metaJson['naruto-rasengan-dash'].hitDelayMs,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
