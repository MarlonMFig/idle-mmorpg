/**
 * Reancora Nikudan Sensha existente: contato com o chão (bottom-center) fixo.
 * Não precisa das sheets-fonte — opera em public/.../nikudan-sensha.png.
 *
 * Uso: node scripts/process-chouji-nikudan-feet.js
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const IN = path.join(ROOT, 'public', 'sprites', 'player', 'chouji', 'nikudan-sensha.png');
const OUT = IN;
const META = path.join(ROOT, 'public', 'sprites', 'player', 'chouji', 'meta.json');
const TARGET_CONTENT_H = 85;
const PAD = 2;

function bottomContact(frame, w, h) {
  let maxY = -1;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (frame[(y * w + x) * 4 + 3] < 16) continue;
      if (y > maxY) maxY = y;
    }
  }
  if (maxY < 0) throw new Error('frame vazio');
  let sum = 0;
  let n = 0;
  let minX = w;
  let maxX = -1;
  for (let y = Math.max(0, maxY - 1); y <= maxY; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (frame[(y * w + x) * 4 + 3] < 16) continue;
      sum += x;
      n += 1;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
    }
  }
  return {
    feetY: maxY,
    contactX: n > 0 ? sum / n : w / 2,
    span: maxX >= 0 ? maxX - minX + 1 : 0,
  };
}

function fullBBox(frame, w, h) {
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
  return { minX, maxX, minY, maxY };
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

async function main() {
  const metaJson = fs.existsSync(META) ? JSON.parse(fs.readFileSync(META, 'utf8')) : {};
  const prev = metaJson['chouji-nikudan-sensha'] || {};
  const FW = prev.frameWidth || 103;
  const FH = prev.frameHeight || 137;

  const { data, info } = await sharp(IN).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const n = Math.round(info.width / FW);
  if (info.width !== n * FW || info.height !== FH) {
    throw new Error(`dimensão inesperada ${info.width}x${info.height} (esp. ${n * FW}x${FH} via meta)`);
  }

  const frames = [];
  for (let f = 0; f < n; f += 1) {
    const frame = Buffer.alloc(FW * FH * 4);
    for (let y = 0; y < FH; y += 1) {
      data.copy(frame, y * FW * 4, (y * info.width + f * FW) * 4, (y * info.width + f * FW + FW) * 4);
    }
    frames.push(frame);
  }

  const metas = frames.map((fr) => ({ ...bottomContact(fr, FW, FH), box: fullBBox(fr, FW, FH) }));

  let maxLeft = 0;
  let maxRight = 0;
  let maxAbove = 0;
  let maxBelow = 0;
  for (const m of metas) {
    maxLeft = Math.max(maxLeft, m.contactX - m.box.minX);
    maxRight = Math.max(maxRight, m.box.maxX - m.contactX);
    maxAbove = Math.max(maxAbove, m.feetY - m.box.minY);
    maxBelow = Math.max(maxBelow, m.box.maxY - m.feetY);
  }

  const anchorX = PAD + Math.ceil(maxLeft);
  const anchorY = PAD + Math.ceil(maxAbove);
  const fw = PAD + Math.ceil(maxLeft) + Math.ceil(maxRight) + PAD;
  const fh = PAD + Math.ceil(maxAbove) + Math.ceil(maxBelow) + PAD;
  console.log(`canvas ${fw}x${fh} anchor=(${anchorX},${anchorY}) n=${n}`);

  let outFrames = frames.map((fr, i) => {
    const m = metas[i];
    const canvas = Buffer.alloc(fw * fh * 4);
    const dx = Math.round(anchorX - m.contactX);
    const dy = Math.round(anchorY - m.feetY);
    paste(canvas, fw, fh, fr, FW, FH, dx, dy);
    return canvas;
  });

  // Refine pass
  outFrames = outFrames.map((fr) => {
    const m = bottomContact(fr, fw, fh);
    const canvas = Buffer.alloc(fw * fh * 4);
    paste(canvas, fw, fh, fr, fw, fh, Math.round(anchorX - m.contactX), Math.round(anchorY - m.feetY));
    return canvas;
  });

  const contacts = outFrames.map((fr) => bottomContact(fr, fw, fh));
  const xs = contacts.map((c) => Math.round(c.contactX));
  const ys = contacts.map((c) => c.feetY);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  console.log(`QA contactX ${xMin}..${xMax} Δ${xMax - xMin} | feetY ${yMin}..${yMax} Δ${yMax - yMin}`);

  let green = 0;
  for (const fr of outFrames) {
    for (let i = 0; i < fw * fh; i += 1) {
      const o = i * 4;
      if (fr[o + 3] < 16) continue;
      const r = fr[o];
      const g = fr[o + 1];
      const b = fr[o + 2];
      if (g > r + 35 && g > b + 35 && g > 90) green += 1;
    }
  }

  const issues = [];
  if (xMax - xMin > 1) issues.push(`contactX não fixo Δ${xMax - xMin}`);
  if (yMax - yMin > 0) issues.push(`feetY não fixo Δ${yMax - yMin}`);
  if (green > 0) issues.push(`franja verde ${green}px`);
  if (issues.length) {
    console.error(issues.join('\n'));
    throw new Error(`QA fail (${issues.length})`);
  }
  console.log('QA OK');

  const sheetW = fw * n;
  const sheet = Buffer.alloc(sheetW * fh * 4);
  outFrames.forEach((fr, f) => {
    for (let y = 0; y < fh; y += 1) {
      fr.copy(sheet, (y * sheetW + f * fw) * 4, y * fw * 4, (y + 1) * fw * 4);
    }
  });

  await sharp(sheet, { raw: { width: sheetW, height: fh, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(OUT);

  const originX = Number((anchorX / fw).toFixed(4));
  const durationMs = Math.round((n / 12) * 1000);
  const dashStartMs = Math.round((13 / 12) * 1000); // após expand (~f13)
  const hitDelayMs = Math.round((22 / 12) * 1000); // perto do fim do giro

  let meta = {};
  if (fs.existsSync(META)) meta = JSON.parse(fs.readFileSync(META, 'utf8'));
  meta['chouji-nikudan-sensha'] = {
    ...(meta['chouji-nikudan-sensha'] || {}),
    image: '/sprites/player/chouji/nikudan-sensha.png',
    frameWidth: fw,
    frameHeight: fh,
    frameCount: n,
    contentHeight: TARGET_CONTENT_H,
    originX,
    frameRate: 12,
    durationMs,
    hitDelayMs,
    dashStartMs,
    feetFixed: true,
    note: 'Nikudan Sensha reancorado (bottom-contact fixo); contentH=idle 85',
  };
  fs.writeFileSync(META, `${JSON.stringify(meta, null, 2)}\n`);

  console.log(
    JSON.stringify(
      { frameWidth: fw, frameHeight: fh, frameCount: n, contentHeight: TARGET_CONTENT_H, originX, durationMs, hitDelayMs, dashStartMs },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
