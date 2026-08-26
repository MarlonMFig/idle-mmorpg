/**
 * Native HQ pack from MUGEN SFF/AIR (idle ruler scale=1, feet lock).
 * Index 0 already transparent — costume greens (Yuno wind, etc.) are kept.
 */
const fs = require('fs');
const path = require('path');
const {
  packUniformGlobalScale,
  stitch,
  writePng,
  updateMeta,
  ALPHA_KEEP,
  writeMagentaPreview,
} = require('./alpha-frame-pack');
const { parseAir, collapse } = require('./mugen-air');
const { openAnySff } = require('./sff-open');

const TICK_MS = 1000 / 60;
const ROOT = path.resolve(__dirname, '../..');

function measureBodyH(frames, fw, fh) {
  let maxH = 1;
  for (const frame of frames) {
    let minY = fh;
    let maxY = -1;
    for (let y = 0; y < fh; y += 1) {
      for (let x = 0; x < fw; x += 1) {
        if (frame[(y * fw + x) * 4 + 3] < ALPHA_KEEP) continue;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    if (maxY >= minY) maxH = Math.max(maxH, maxY - minY + 1);
  }
  return maxH;
}

function assertSheet(
  sheetData,
  sheetW,
  fh,
  fw,
  n,
  name,
  { lockFeet = true, minOpaque = 30 } = {},
) {
  const footY = [];
  for (let f = 0; f < n; f += 1) {
    let opaque = 0;
    let maxFoot = -1;
    for (let y = 0; y < fh; y += 1) {
      for (let x = 0; x < fw; x += 1) {
        const i = (y * sheetW + f * fw + x) * 4;
        if (sheetData[i + 3] < ALPHA_KEEP) continue;
        opaque += 1;
        if (y > maxFoot) maxFoot = y;
      }
    }
    if (opaque < minOpaque) throw new Error(`${name} frame ${f} too empty (${opaque}px)`);
    footY.push(maxFoot);
  }
  const feet = footY.filter((y) => y >= 0);
  const spread = feet.length ? Math.max(...feet) - Math.min(...feet) : 0;
  if (lockFeet && n >= 2 && spread > 3) {
    throw new Error(`${name}: feet not locked (spread=${spread})`);
  }
  return { footSpread: spread };
}

function readAir(file) {
  const buf = fs.readFileSync(file);
  let text;
  if (buf[0] === 0xff && buf[1] === 0xfe) {
    text = buf.subarray(2).toString('utf16le');
  } else if (buf[0] === 0xfe && buf[1] === 0xff) {
    text = Buffer.from(buf.subarray(2)).swap16().toString('utf16le');
  } else {
    text = buf.toString('utf8');
    if (text.includes('\u0000')) text = buf.toString('latin1');
  }
  return parseAir(text);
}

function actionClips(air, id) {
  const act = air.get(id);
  if (!act) return [];
  return collapse(act.frames);
}

function spriteQuality(rgba) {
  let opaque = 0;
  let sum = 0;
  const colors = new Set();
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] <= ALPHA_KEEP) continue;
    opaque += 1;
    sum += rgba[i] + rgba[i + 1] + rgba[i + 2];
    colors.add((rgba[i] << 16) | (rgba[i + 1] << 8) | rgba[i + 2]);
  }
  return {
    opaque,
    colors: colors.size,
    lum: opaque ? sum / (opaque * 3) : 0,
  };
}

function filterBodyFrames(extracted) {
  if (extracted.length < 2) return extracted;
  const stats = extracted.map((row) => spriteQuality(row.sprite.rgba));
  const maxColors = Math.max(...stats.map((s) => s.colors));
  const lums = stats.map((s) => s.lum).sort((a, b) => a - b);
  const median = lums[Math.floor(lums.length / 2)];
  const kept = extracted.filter((_, i) => {
    if (stats[i].colors < 6) return false;
    if (median > 24 && stats[i].lum < median * 0.42) return false;
    if (maxColors >= 12 && stats[i].colors < maxColors * 0.38) return false;
    return true;
  });
  return kept.length ? kept : extracted;
}

async function extractRefs(
  sff,
  refs,
  { fx = false, keepAllBody = false, additive = false } = {},
) {
  const out = [];
  for (const ref of refs) {
    const sprite = await sff.tryGet(ref.group, ref.number);
    if (!sprite || sprite.width < 2 || sprite.height < 2) continue;
    // Additive VFX: converte antes dos filtros, senão o "preto vazio" conta
    // como pixel opaco e o frame é descartado como fundo sólido.
    if (fx && additive && (!ref.trans || ref.trans.startsWith('A'))) {
      additiveToAlpha(sprite.rgba);
    }
    const quality = spriteQuality(sprite.rgba);
    if (quality.opaque < (fx ? 16 : 40)) continue;
    out.push({ ...ref, sprite });
  }
  if (fx || keepAllBody) return out;
  return filterBodyFrames(out);
}

function knockoutFxBlack(rgba) {
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i] < 22 && rgba[i + 1] < 22 && rgba[i + 2] < 22) {
      rgba[i] = 0;
      rgba[i + 1] = 0;
      rgba[i + 2] = 0;
      rgba[i + 3] = 0;
    }
  }
}

/**
 * MUGEN desenha VFX com `trans = A` (additive): o preto do sprite é o "vazio".
 * Num renderer alpha normal isso vira borrão escuro. Converte para alpha reto
 * desfazendo o pré-multiplicado: alpha = luminância, cor = cor / alpha.
 */
function additiveToAlpha(rgba, { floor = 8, gain = 1 } = {}) {
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] === 0) continue;
    const r = rgba[i];
    const g = rgba[i + 1];
    const b = rgba[i + 2];
    const lum = Math.max(r, g, b);
    if (lum <= floor) {
      rgba[i + 3] = 0;
      continue;
    }
    const k = 255 / lum;
    rgba[i] = Math.min(255, Math.round(r * k));
    rgba[i + 1] = Math.min(255, Math.round(g * k));
    rgba[i + 2] = Math.min(255, Math.round(b * k));
    rgba[i + 3] = Math.min(255, Math.round(lum * gain));
  }
}

/** Só remove fundo preto opaco (canvas cheio). VFX escuro real (azul/roxo) fica. */
function maybeKnockoutFxBlack(rgba) {
  let opaque = 0;
  let nearBlack = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] <= ALPHA_KEEP) continue;
    opaque += 1;
    if (rgba[i] < 22 && rgba[i + 1] < 22 && rgba[i + 2] < 22) nearBlack += 1;
  }
  if (opaque < 80 || nearBlack / opaque < 0.55) return;
  knockoutFxBlack(rgba);
}

/**
 * Aproxima PalFX do Mugen (ex.: AfterFX do Toji: color=0, add=0,-200,0 → rosa).
 * @param {Buffer} rgba
 * @param {{ add?: number[], color?: number }} pal
 */
function bakePalFx(rgba, pal) {
  if (!pal) return;
  const add = Array.isArray(pal.add) ? pal.add : [0, 0, 0];
  const color = typeof pal.color === 'number' ? pal.color : 256;
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] <= ALPHA_KEEP) continue;
    let r = rgba[i];
    let g = rgba[i + 1];
    let b = rgba[i + 2];
    if (color <= 0) {
      const gray = (r + g + b) / 3;
      r = gray;
      g = gray;
      b = gray;
    } else if (color < 256) {
      const gray = (r + g + b) / 3;
      const t = color / 256;
      r = gray + (r - gray) * t;
      g = gray + (g - gray) * t;
      b = gray + (b - gray) * t;
    }
    rgba[i] = Math.max(0, Math.min(255, Math.round(r + (add[0] || 0))));
    rgba[i + 1] = Math.max(0, Math.min(255, Math.round(g + (add[1] || 0))));
    rgba[i + 2] = Math.max(0, Math.min(255, Math.round(b + (add[2] || 0))));
  }
}

/** Reduz FX nativo gigante (AfterFX 700px+) pra caber no corpo do personagem. */
function downscaleFxPacked(packed, maxH, maxW) {
  if (!packed?.frames?.length) return packed;
  const scale = Math.min(
    maxH ? maxH / packed.frameHeight : 1,
    maxW ? maxW / packed.frameWidth : 1,
  );
  if (!(scale < 1)) return packed;
  const nw = Math.max(1, Math.round(packed.frameWidth * scale));
  const nh = Math.max(1, Math.round(packed.frameHeight * scale));
  // O padding nativo de 2px também encolhe. Reponha-o depois da redução para
  // nenhum pixel luminoso tocar a borda da célula e parecer recortado no atlas.
  const pad = 2;
  const fw = nw + pad * 2;
  const fh = nh + pad * 2;
  const frames = packed.frames.map((frame) => {
    const out = Buffer.alloc(fw * fh * 4);
    for (let y = 0; y < nh; y += 1) {
      const sy = Math.min(packed.frameHeight - 1, Math.floor(y / scale));
      for (let x = 0; x < nw; x += 1) {
        const sx = Math.min(packed.frameWidth - 1, Math.floor(x / scale));
        const si = (sy * packed.frameWidth + sx) * 4;
        const di = ((y + pad) * fw + x + pad) * 4;
        out[di] = frame[si];
        out[di + 1] = frame[si + 1];
        out[di + 2] = frame[si + 2];
        out[di + 3] = frame[si + 3];
      }
    }
    return out;
  });
  const originPx = (packed.originX ?? 0.5) * packed.frameWidth * scale;
  return {
    ...packed,
    frames,
    frameWidth: fw,
    frameHeight: fh,
    originX: (originPx + pad) / fw,
  };
}

/**
 * Compõe os sprites no eixo SFF (pés). Crop por bbox + floor-align
 * desfaz o axisY e o walk "quica" (Itadori 0,30–37 varia 54–57).
 */
function compositeOnAxis(sprites) {
  const axes = sprites.map((s) => ({
    ax: Number.isFinite(s.axisX) ? s.axisX : Math.floor(s.width / 2),
    ay: Number.isFinite(s.axisY) ? s.axisY : s.height,
  }));
  const left = Math.max(...axes.map((a) => a.ax), 0);
  const right = Math.max(...sprites.map((s, i) => s.width - axes[i].ax), 1);
  const above = Math.max(...axes.map((a) => a.ay), 0);
  const below = Math.max(...sprites.map((s, i) => Math.max(0, s.height - axes[i].ay)), 0);
  const width = Math.max(1, left + right);
  const height = Math.max(1, above + below);
  return sprites.map((s, i) => {
    const rgba = Buffer.alloc(width * height * 4);
    const ox = left - axes[i].ax;
    const oy = above - axes[i].ay;
    for (let y = 0; y < s.height; y += 1) {
      for (let x = 0; x < s.width; x += 1) {
        const si = (y * s.width + x) * 4;
        if (s.rgba[si + 3] <= ALPHA_KEEP) continue;
        const dx = ox + x;
        const dy = oy + y;
        if (dx < 0 || dy < 0 || dx >= width || dy >= height) continue;
        const di = (dy * width + dx) * 4;
        rgba[di] = s.rgba[si];
        rgba[di + 1] = s.rgba[si + 1];
        rgba[di + 2] = s.rgba[si + 2];
        rgba[di + 3] = s.rgba[si + 3];
      }
    }
    return { ...s, rgba, width, height, axisX: left, axisY: above };
  });
}

function trimSharedEmpty(sprites) {
  const w = sprites[0].width;
  const h = sprites[0].height;
  let minX = w;
  let maxX = -1;
  let minY = h;
  let maxY = -1;
  for (const s of sprites) {
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        if (s.rgba[(y * w + x) * 4 + 3] <= ALPHA_KEEP) continue;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX || maxY < minY) return sprites;
  const tw = maxX - minX + 1;
  const th = maxY - minY + 1;
  if (tw === w && th === h) return sprites;
  return sprites.map((s) => {
    const rgba = Buffer.alloc(tw * th * 4);
    for (let y = 0; y < th; y += 1) {
      for (let x = 0; x < tw; x += 1) {
        const si = ((minY + y) * w + (minX + x)) * 4;
        const di = (y * tw + x) * 4;
        rgba[di] = s.rgba[si];
        rgba[di + 1] = s.rgba[si + 1];
        rgba[di + 2] = s.rgba[si + 2];
        rgba[di + 3] = s.rgba[si + 3];
      }
    }
    return {
      ...s,
      rgba,
      width: tw,
      height: th,
      axisX: s.axisX - minX,
      axisY: s.axisY - minY,
    };
  });
}

function clipBelowAxis(sprites, footSlack = 2) {
  const axisY = sprites[0].axisY;
  if (!Number.isFinite(axisY) || axisY >= sprites[0].height - 1) return sprites;
  // Inclui a linha do eixo + alguns px de dedo/sola. Cortar em `axisY`
  // (exclusivo) arrancava o pé do Toji e outros MUGEN com footGap 1–2.
  const h = Math.min(
    sprites[0].height,
    Math.max(1, Math.floor(axisY) + 1 + footSlack),
  );
  if (h >= sprites[0].height) return sprites;
  const w = sprites[0].width;
  return sprites.map((s) => {
    const rgba = Buffer.alloc(w * h * 4);
    const copyH = Math.min(s.height, h);
    for (let y = 0; y < copyH; y += 1) {
      s.rgba.copy(rgba, y * w * 4, y * w * 4, y * w * 4 + w * 4);
    }
    return { ...s, rgba, height: h };
  });
}

/**
 * VFX no eixo do MUGEN. Centrar cada frame por bbox faz um jato de fogo
 * "nascer" no meio do personagem e tremer entre frames; o eixo é o ponto de
 * emissão real (boca / mão), então fica fixo e o `originX` resultante diz ao
 * renderer onde encostar o efeito no caster.
 */
function packFxOnAxis(sprites, { softAlpha = false } = {}) {
  const trimmed = trimSharedEmpty(compositeOnAxis(sprites));
  const pad = 2;
  const w = trimmed[0].width;
  const h = trimmed[0].height;
  const fw = w + pad * 2;
  const fh = h + pad * 2;
  const cut = softAlpha ? ALPHA_KEEP : 128;
  const frames = trimmed.map((s) => {
    const canvas = Buffer.alloc(fw * fh * 4);
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const si = (y * w + x) * 4;
        if (s.rgba[si + 3] < cut) continue;
        const di = ((y + pad) * fw + (x + pad)) * 4;
        canvas[di] = s.rgba[si];
        canvas[di + 1] = s.rgba[si + 1];
        canvas[di + 2] = s.rgba[si + 2];
        canvas[di + 3] = softAlpha ? s.rgba[si + 3] : 255;
      }
    }
    return canvas;
  });
  return {
    frames,
    frameWidth: fw,
    frameHeight: fh,
    originX: (trimmed[0].axisX + pad) / Math.max(1, fw),
    scale: 1,
    contentHeight: measureBodyH(frames, fw, fh),
  };
}

function packAxisLocked(sprites) {
  const trimmed = trimSharedEmpty(clipBelowAxis(compositeOnAxis(sprites)));
  const pad = 2;
  const w = trimmed[0].width;
  const h = trimmed[0].height;
  const fw = w + pad * 2;
  const fh = h + pad * 2;
  const frames = trimmed.map((s) => {
    const canvas = Buffer.alloc(fw * fh * 4);
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const si = (y * w + x) * 4;
        if (s.rgba[si + 3] <= ALPHA_KEEP) continue;
        const di = ((y + pad) * fw + (x + pad)) * 4;
        canvas[di] = s.rgba[si];
        canvas[di + 1] = s.rgba[si + 1];
        canvas[di + 2] = s.rgba[si + 2];
        canvas[di + 3] = s.rgba[si + 3];
      }
    }
    return canvas;
  });
  const axisX = trimmed[0].axisX + pad;
  return {
    frames,
    frameWidth: fw,
    frameHeight: fh,
    originX: axisX / Math.max(1, fw),
    scale: 1,
    contentHeight: measureBodyH(frames, fw, fh),
  };
}

/**
 * Walk/combo MUGEN às vezes vem mais baixo que o idle. Sem upsample, o
 * contentHeight do idle (régua) deixa a sprite “encolhida” e parece quicar.
 * Escala NN em torno do eixo (origin) e reempacota com axis-lock — sem
 * realinhar por pés/bbox (isso deslizava ou picotava o run).
 *
 * `targetBodyH` nulo desliga o ajuste (ver `sameRipZoom`).
 */
async function matchPackedBodyHeight(packed, targetBodyH) {
  if (!packed?.frames?.length || !(targetBodyH > 0)) return packed;
  const current = measureBodyH(packed.frames, packed.frameWidth, packed.frameHeight);
  if (current < 8 || Math.abs(current - targetBodyH) <= 1) return packed;
  const scale = targetBodyH / current;
  console.log(`  matchBodyH ${current}→${targetBodyH} scale=${scale.toFixed(4)} (axis-lock)`);

  const sharp = require('sharp');
  const fw = packed.frameWidth;
  const fh = packed.frameHeight;
  let axisY = fh - 1;
  for (let y = fh - 1; y >= 0; y -= 1) {
    let hit = false;
    for (let x = 0; x < fw; x += 1) {
      if (packed.frames[0][(y * fw + x) * 4 + 3] > ALPHA_KEEP) {
        hit = true;
        break;
      }
    }
    if (hit) {
      axisY = y;
      break;
    }
  }
  const axisX = (packed.originX ?? 0.5) * fw;

  const sprites = [];
  for (const frame of packed.frames) {
    const newW = Math.max(1, Math.round(fw * scale));
    const newH = Math.max(1, Math.round(fh * scale));
    const { data } = await sharp(frame, {
      raw: { width: fw, height: fh, channels: 4 },
    })
      .resize(newW, newH, { kernel: sharp.kernel.nearest })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    sprites.push({
      rgba: Buffer.from(data),
      width: newW,
      height: newH,
      axisX: axisX * scale,
      axisY: axisY * scale,
    });
  }
  return packAxisLocked(sprites);
}

/** Força o mesmo footY em todos os frames (spread 0 após upsample NN). */
function hardenPackedFeet(packed) {
  if (!packed?.frames?.length) return packed;
  const fw = packed.frameWidth;
  const fh = packed.frameHeight;
  const footYs = packed.frames.map((frame) => {
    for (let y = fh - 1; y >= 0; y -= 1) {
      for (let x = 0; x < fw; x += 1) {
        if (frame[(y * fw + x) * 4 + 3] > ALPHA_KEEP) return y;
      }
    }
    return -1;
  });
  const target = Math.max(...footYs);
  if (target < 0) return packed;
  if (Math.max(...footYs) - Math.min(...footYs.filter((y) => y >= 0)) === 0) {
    return packed;
  }
  const frames = packed.frames.map((frame, i) => {
    const shift = target - footYs[i];
    if (!shift) return frame;
    const out = Buffer.alloc(fw * fh * 4);
    for (let y = 0; y < fh; y += 1) {
      const dy = y + shift;
      if (dy < 0 || dy >= fh) continue;
      frame.copy(out, dy * fw * 4, y * fw * 4, (y + 1) * fw * 4);
    }
    return out;
  });
  return { ...packed, frames };
}

/**
 * Frames aéreos do run (pés acima do axisY) fazem hop. Em vez de descartá-los
 * (ciclo curto / “picotado”), desloca o desenho para baixo até os pés no eixo.
 */
function plantFeetOnAxis(sprites) {
  if (!sprites?.length) return sprites;
  return sprites.map((s) => {
    const ay = Number.isFinite(s.axisY) ? Math.floor(s.axisY) : s.height;
    let maxY = -1;
    for (let y = 0; y < s.height; y += 1) {
      for (let x = 0; x < s.width; x += 1) {
        if (s.rgba[(y * s.width + x) * 4 + 3] <= ALPHA_KEEP) continue;
        if (y > maxY) maxY = y;
      }
    }
    if (maxY < 0 || maxY >= ay - 1) return s;
    const shift = ay - 1 - maxY;
    if (shift <= 0) return s;
    const rgba = Buffer.alloc(s.width * s.height * 4);
    for (let y = 0; y < s.height; y += 1) {
      const dy = y + shift;
      if (dy < 0 || dy >= s.height) continue;
      for (let x = 0; x < s.width; x += 1) {
        const si = (y * s.width + x) * 4;
        if (s.rgba[si + 3] <= ALPHA_KEEP) continue;
        const di = (dy * s.width + x) * 4;
        rgba[di] = s.rgba[si];
        rgba[di + 1] = s.rgba[si + 1];
        rgba[di + 2] = s.rgba[si + 2];
        rgba[di + 3] = s.rgba[si + 3];
      }
    }
    return { ...s, rgba };
  });
}

/** @deprecated Prefer plantFeetOnAxis — descartar frames deixa o run picotado. */
function dropAirborneWalk(sprites) {
  if (!sprites || sprites.length < 4) return sprites;
  const grounded = sprites.filter((s) => {
    const ay = Number.isFinite(s.axisY) ? s.axisY : s.height;
    let maxY = -1;
    for (let y = 0; y < s.height; y += 1) {
      for (let x = 0; x < s.width; x += 1) {
        if (s.rgba[(y * s.width + x) * 4 + 3] <= ALPHA_KEEP) continue;
        if (y > maxY) maxY = y;
      }
    }
    return maxY >= ay - 2;
  });
  return grounded.length >= 4 ? grounded : sprites;
}

async function packSprites(sprites, { fx = false, additive = false } = {}) {
  if (fx) {
    if (!additive) for (const sprite of sprites) maybeKnockoutFxBlack(sprite.rgba);
    const hasFxAxis = sprites.every(
      (s) => Number.isFinite(s.axisX) && Number.isFinite(s.axisY),
    );
    if (hasFxAxis) return packFxOnAxis(sprites, { softAlpha: additive });
    return packUniformGlobalScale(
      sprites.map((s) => s.rgba),
      sprites.map((s) => s.width),
      sprites.map((s) => s.height),
      {
        absoluteScale: 1,
        allowOversizedFrames: true,
        alignX: 'bbox',
        preserveCostumeGreen: true,
        softAlpha: additive,
      },
    );
  }
  const hasAxis = sprites.some((s) => Number.isFinite(s.axisX) && Number.isFinite(s.axisY));
  if (hasAxis) return packAxisLocked(sprites);
  return packUniformGlobalScale(
    sprites.map((s) => s.rgba),
    sprites.map((s) => s.width),
    sprites.map((s) => s.height),
    {
      absoluteScale: 1,
      allowOversizedFrames: true,
      alignX: 'feet',
      preserveCostumeGreen: true,
    },
  );
}

function timing(refs, action) {
  const durationTicks =
    action?.durationTicks || refs.reduce((sum, f) => sum + (f.time || 1), 0);
  let hitTicks = action?.hitTicks;
  if (hitTicks == null) {
    const hit = refs.find((f) => f.hit);
    hitTicks = 0;
    if (hit) {
      for (const f of refs) {
        if (f === hit) break;
        hitTicks += f.time || 1;
      }
    } else {
      hitTicks = Math.round(durationTicks * 0.45);
    }
  }
  const n = Math.max(1, refs.length);
  return {
    durationMs: Math.max(280, Math.round(durationTicks * TICK_MS)),
    hitDelayMs: Math.round(hitTicks * TICK_MS),
    frameRate: Math.max(8, Math.min(18, Math.round(60 / Math.max(1, durationTicks / n)))),
  };
}

function slugName(value) {
  return String(value || 'especial')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 28) || 'especial';
}

function pickComboActions(air, override) {
  if (Array.isArray(override) && override.length) {
    return [0, 1, 2].map((i) => override[i] ?? override[0]);
  }
  const candidates = [200, 210, 220, 230, 240, 250, 400];
  const usable = [];
  for (const id of candidates) {
    const frames = actionClips(air, id);
    if (frames.length >= 2) usable.push(id);
  }
  if (usable.length >= 3) return usable.slice(0, 3);
  if (usable.length === 2) return [usable[0], usable[1], usable[0]];
  if (usable.length === 1) return [usable[0], usable[0], usable[0]];
  return [0, 0, 0];
}

function pickHurtDeath(air, cfg = {}) {
  const hurtIds = cfg.hurtIds || [5000, 5001, 5030, 5050, 5070];
  const deathIds = cfg.deathIds || [5110, 5170, 5150, 5100, 5080, 5120];
  const hurt = [];
  const seen = new Set();
  for (const id of hurtIds) {
    for (const f of actionClips(air, id)) {
      const k = `${f.group},${f.number}`;
      if (seen.has(k)) continue;
      seen.add(k);
      hurt.push(f);
    }
  }
  let death = [];
  for (const id of deathIds) {
    const frames = actionClips(air, id);
    if (frames.length) {
      death = frames;
      break;
    }
  }
  if (hurt.length < 1) hurt.push(...actionClips(air, 0).slice(0, 1));
  if (death.length < 1) death = hurt.slice(-1);
  return { hurt: hurt.slice(0, 3), death: death.slice(0, 3) };
}

function looksLikeFxDump(frames) {
  if (frames.length < 8) return false;
  return frames.every((f) => f.group >= 800);
}

function pickSpecials(air, override) {
  if (Array.isArray(override) && override.length) {
    return override
      .map((id) => {
        const act = air.get(id);
        if (!act) return null;
        const frames = collapse(act.frames);
        if (frames.length < 2) return null;
        return { id, act, frames };
      })
      .filter(Boolean);
  }
  const preferred = new Set([1000, 1100, 1200, 1300, 1400, 1500, 2000, 3000]);
  const scored = [];
  for (const [id, act] of air) {
    if (id < 1000 || id > 3999) continue;
    const frames = collapse(act.frames);
    if (frames.length < 2) continue;
    if (id % 100 === 50 || id % 100 === 60 || id % 100 === 61) continue;
    if (looksLikeFxDump(frames)) continue;
    const hasBody = frames.some((f) => f.group < 600);
    scored.push({
      id,
      act,
      frames,
      score:
        Math.min(frames.length, 16) +
        (act.hitTicks != null ? 25 : 0) +
        (preferred.has(id) ? 80 : 0) +
        (id % 100 === 0 ? 20 : 0) +
        (hasBody ? 40 : 0),
    });
  }
  scored.sort((a, b) => b.score - a.score || a.id - b.id);
  const picked = [];
  const sigs = new Set();
  for (const row of scored) {
    const sig = row.frames
      .slice(0, 5)
      .map((f) => `${f.group},${f.number}`)
      .join('|');
    if (sigs.has(sig)) continue;
    sigs.add(sig);
    picked.push(row);
    if (picked.length >= 4) break;
  }
  return picked;
}

function isFxClip(frames) {
  if (frames.length < 2) return false;
  const fxish = frames.filter((f) => f.group >= 600).length;
  return fxish >= Math.ceil(frames.length * 0.6) || frames.every((f) => f.group >= 500);
}

function fxActionIds(specialId, air, override) {
  if (Array.isArray(override)) return [...override];
  const found = new Set();
  for (const off of [50, 51, 52, 53, 60, 61, 62, 63, 70, 71, 80, 81]) {
    const id = specialId + off;
    const frames = actionClips(air, id);
    if (frames.length >= 2 && isFxClip(frames)) found.add(id);
  }
  for (const [id, act] of air) {
    if (id <= specialId || id >= specialId + 100) continue;
    if (id % 100 === 0) continue;
    const frames = collapse(act.frames);
    if (isFxClip(frames)) found.add(id);
  }
  return [...found];
}

function splitBodyFx(frames) {
  const body = frames.filter((f) => f.group < 600);
  const fx = frames.filter((f) => f.group >= 600);
  return { body, fx };
}

function uniqueRefs(refs) {
  const seen = new Set();
  const out = [];
  for (const ref of refs) {
    const k = `${ref.group},${ref.number}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(ref);
  }
  return out;
}

/**
 * `spec` é um grupo SFF (`3010`) ou uma faixa (`{ group: 3010, to: 18 }`) quando
 * o grupo guarda o mesmo efeito em paletas diferentes e só uma serve.
 */
async function extractGroupRefs(sff, spec, max = 48) {
  const group = typeof spec === 'object' ? spec.group : spec;
  const from = typeof spec === 'object' ? (spec.from ?? 0) : 0;
  const to = typeof spec === 'object' ? (spec.to ?? max) : max;
  const refs = [];
  for (let number = from; number < to; number += 1) {
    const sprite = await sff.tryGet(group, number);
    if (!sprite || sprite.width < 2 || sprite.height < 2) continue;
    if (spriteQuality(sprite.rgba).opaque < 16) continue;
    refs.push({ group, number, time: 2 });
  }
  return refs;
}

function capFxSprites(sprites, maxFrames) {
  if (sprites.length <= 2) return sprites;
  const maxW = Math.max(...sprites.map((s) => s.width));
  const maxH = Math.max(...sprites.map((s) => s.height));
  let cap = maxFrames || 36;
  if (!maxFrames) {
    if (maxW > 1400 || maxH > 700) cap = 6;
    else if (maxW > 900 || maxH > 480) cap = 10;
    else if (maxW > 500 || maxH > 320) cap = 16;
  }
  if (sprites.length <= cap) return sprites;
  const out = [];
  for (let i = 0; i < cap; i += 1) {
    const idx = Math.round((i * (sprites.length - 1)) / (cap - 1));
    out.push(sprites[idx]);
  }
  return out;
}

/** VFX sheet não deve misturar o corpo do personagem (grupo alto com sprite pequeno). */
function dropBodySizedFx(sprites, contentHeight) {
  const maxBodyW = Math.max(120, Math.round(contentHeight * 1.9));
  const maxBodyH = Math.round(contentHeight * 1.5);
  const fx = sprites.filter((s) => s.width > maxBodyW || s.height > maxBodyH);
  return fx.length >= 2 ? fx : [];
}

function hasOpaqueCorners(rgba, width, height) {
  const pts = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
    [2, 2],
    [width - 3, 2],
  ];
  let n = 0;
  for (const [x, y] of pts) {
    if (x < 0 || y < 0) continue;
    const i = (y * width + x) * 4;
    if (rgba[i + 3] > 40) n += 1;
  }
  return n >= 3;
}

/** Descarta frames que são um retângulo sólido (flash de tela / fundo opaco). */
function dropSolidFillFx(sprites) {
  const kept = sprites.filter((s) => {
    const q = spriteQuality(s.rgba);
    const area = s.width * s.height;
    if (area < 1) return false;
    if (hasOpaqueCorners(s.rgba, s.width, s.height)) return false;
    if (q.opaque / area > 0.62 && q.colors < 48) return false;
    return q.opaque >= 16;
  });
  return kept.length >= 2 ? kept : sprites.filter((s) => spriteQuality(s.rgba).opaque >= 16);
}

function eraseTinyIslands(frame, w, h, minSize = 4) {
  const seen = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i += 1) {
    if (seen[i] || frame[i * 4 + 3] < ALPHA_KEEP) continue;
    const stack = [i];
    seen[i] = 1;
    const cells = [];
    while (stack.length) {
      const p = stack.pop();
      cells.push(p);
      const px = p % w;
      const py = (p - px) / w;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [-1, -1],
        [1, -1],
        [-1, 1],
      ]) {
        const nx = px + dx;
        const ny = py + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const np = ny * w + nx;
        if (seen[np] || frame[np * 4 + 3] < ALPHA_KEEP) continue;
        seen[np] = 1;
        stack.push(np);
      }
    }
    if (cells.length < minSize) {
      for (const p of cells) frame[p * 4 + 3] = 0;
    }
  }
}

async function writeSheet(outDir, qaDir, metaJson, id, name, packed, contentHeight, extra, qa) {
  const stableBody = name === 'idle' || name === 'walk' || /^combo\d+$/.test(name);
  if (stableBody) {
    for (const frame of packed.frames) {
      eraseTinyIslands(frame, packed.frameWidth, packed.frameHeight);
    }
  }
  const sheet = stitch(packed.frames, packed.frameWidth, packed.frameHeight);
  assertSheet(
    sheet.data,
    sheet.width,
    packed.frameHeight,
    packed.frameWidth,
    packed.frames.length,
    `${id}-${name}`,
    qa,
  );
  await writePng(path.join(outDir, `${name}.png`), sheet.data, sheet.width, sheet.height);
  await writeMagentaPreview(sheet, path.join(qaDir, `${name}-magenta.png`));
  const entry = {
    image: `/sprites/player/${id}/${name}.png`,
    frameWidth: packed.frameWidth,
    frameHeight: packed.frameHeight,
    frameCount: packed.frames.length,
    contentHeight,
    scale: packed.scale,
    originX: packed.originX,
    ...extra,
  };
  updateMeta(metaJson, `${id}-${name}`, entry);
  console.log(
    `  ${name}: ${packed.frames.length}f ${packed.frameWidth}x${packed.frameHeight} originX=${packed.originX.toFixed(3)}`,
  );
  return entry;
}

async function packSequence(sff, refs, outDir, srcDir, folder, opts = {}) {
  const extracted = await extractRefs(sff, refs, opts);
  if (extracted.length === 0) return null;
  fs.mkdirSync(path.join(srcDir, folder), { recursive: true });
  const sprites = [];
  for (let i = 0; i < extracted.length; i += 1) {
    const sprite = extracted[i].sprite;
    sprites.push(sprite);
    await writePng(
      path.join(srcDir, folder, `frame_${String(i + 1).padStart(3, '0')}.png`),
      sprite.rgba,
      sprite.width,
      sprite.height,
    );
  }
  return { sprites, refs: extracted };
}

/**
 * @param {{
 *   id: string,
 *   name: string,
 *   lookType: number,
 *   charDir: string,
 *   sffRel?: string,
 *   airRel?: string,
 * }} cfg
 */
async function packMugenCharacter(cfg) {
  const id = cfg.id;
  const charDir = cfg.charDir;
  const sffPath = path.join(charDir, cfg.sffRel || '');
  const airPath = path.join(charDir, cfg.airRel || '');
  if (!fs.existsSync(sffPath) || !fs.existsSync(airPath)) {
    throw new Error(`${id}: missing SFF/AIR (${sffPath})`);
  }

  const outDir = path.join(ROOT, 'public', 'sprites', 'player', id);
  const srcDir = path.join(ROOT, cfg.srcRoot || 'assets/black-clover-source/nu', id);
  const qaDir = path.join(ROOT, 'assets-src', '_qa', id);
  const preview = path.join(ROOT, 'public', 'sprites', 'player', 'previews', `${id}.png`);
  const metaJson = path.join(outDir, 'meta.json');
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(qaDir, { recursive: true });
  fs.mkdirSync(path.dirname(preview), { recursive: true });
  fs.mkdirSync(srcDir, { recursive: true });

  const sff = openAnySff(sffPath);
  const air = readAir(airPath);
  console.log(`\n=== ${cfg.name} (${id}) sff=v${sff.version} ===`);

  const idleActionId = cfg.idleActionId ?? 0;
  const idleRefs = actionClips(air, idleActionId);
  if (idleRefs.length < 1) throw new Error(`${id}: no idle`);
  const idleSeq = await packSequence(sff, idleRefs, outDir, srcDir, 'idle');
  if (!idleSeq) throw new Error(`${id}: idle sprites missing`);
  let idlePacked = await packSprites(idleSeq.sprites);

  const walkActionIds = cfg.walkActionIds || cfg.walkActionIds || [20, 21];
  let walkRefs = actionClips(air, walkActionIds[0]);
  if (walkRefs.length < 2) walkRefs = actionClips(air, walkActionIds[1]);
  if (walkRefs.length < 2) walkRefs = idleRefs;
  const walkSeq = await packSequence(sff, walkRefs, outDir, srcDir, 'walk', {
    keepAllBody: true,
  });
  let walkPacked = await packSprites(
    plantFeetOnAxis((walkSeq || idleSeq).sprites),
  );
  if (
    spriteQuality(idlePacked.frames[0]).colors < 4 &&
    spriteQuality(walkPacked.frames[0]).colors >= 8
  ) {
    console.log('  idle was silhouette — using walk as idle');
    idlePacked = walkPacked;
  }
  if (
    spriteQuality(walkPacked.frames[0]).colors < 4 &&
    spriteQuality(idlePacked.frames[0]).colors >= 8
  ) {
    console.log('  walk was silhouette — using idle as walk');
    walkPacked = idlePacked;
  }
  const contentHeight = measureBodyH(
    idlePacked.frames,
    idlePacked.frameWidth,
    idlePacked.frameHeight,
  );
  // O MUGEN desenha todas as ações de um personagem na mesma escala. Quando o
  // rip é consistente, igualar a altura do corpo distorce a pose: corrida
  // curvada e ataques fletidos são ampliados, e uma ação com frame de salto é
  // encolhida junto. `sameRipZoom` mantém tudo no pixel nativo.
  const bodyRuler = cfg.sameRipZoom ? null : contentHeight;
  // Walk MUGEN costuma ser mais baixo que o idle. Com sameRipZoom o personagem
  // "encolhe" na corrida; matchWalkHeight faz upsample NN só no walk.
  walkPacked = await matchPackedBodyHeight(
    walkPacked,
    cfg.matchWalkHeight ? contentHeight : bodyRuler,
  );
  walkPacked = hardenPackedFeet(walkPacked);

  const comboIds = pickComboActions(air, cfg.comboActionIds);
  const comboSheets = [];
  for (let i = 0; i < 3; i += 1) {
    const comboId = comboIds[i];
    const refs = actionClips(air, comboId);
    const seq = await packSequence(sff, refs.length ? refs : idleRefs, outDir, srcDir, `combo${i + 1}`);
    const packed = await matchPackedBodyHeight(
      await packSprites((seq || idleSeq).sprites),
      bodyRuler,
    );
    const extra = { frameRate: 12 };
    const entry = await writeSheet(
      outDir,
      qaDir,
      metaJson,
      id,
      `combo${i + 1}`,
      packed,
      contentHeight,
      extra,
      { lockFeet: packed.frames.length >= 2 },
    );

    let fxEntry = null;
    const comboFxGroups = cfg.comboFxGroups?.[comboId] || [];
    const fxRefs = uniqueRefs(
      comboFxGroups.flatMap((group) => {
        // group id can be an AIR action id (7303) or raw sprite group.
        const fromAction = actionClips(air, group);
        return fromAction.length ? fromAction : [];
      }),
    );
    let resolvedFx = fxRefs;
    if (resolvedFx.length < 2) {
      // Fallback: treat ids as SFF groups.
      const groupSprites = [];
      for (const group of comboFxGroups) {
        groupSprites.push(...(await extractGroupRefs(sff, group)));
      }
      resolvedFx = uniqueRefs(groupSprites);
    }
    if (resolvedFx.length >= 2) {
      const fxSeq = await packSequence(
        sff,
        resolvedFx,
        outDir,
        srcDir,
          `combo${i + 1}-fx`,
        { fx: true, additive: Boolean(cfg.fxAdditive) },
      );
      if (fxSeq && fxSeq.sprites.length >= 2) {
        if (cfg.comboFxPalFx) {
          for (const spr of fxSeq.sprites) bakePalFx(spr.rgba, cfg.comboFxPalFx);
        }
        const fxSprites = dropSolidFillFx(dropBodySizedFx(fxSeq.sprites, contentHeight));
        if (fxSprites.length >= 2) {
          let fxPacked = await packSprites(capFxSprites(fxSprites, cfg.fxFrameCap), {
            fx: true,
            additive: Boolean(cfg.fxAdditive),
          });
          const opaqueFrames = fxPacked.frames.filter((frame) => spriteQuality(frame).opaque >= 12);
          if (opaqueFrames.length >= 2) {
            fxPacked.frames = opaqueFrames;
            // AfterFX nativo é enorme; limita a ~2.4× a altura do corpo.
            const maxFxH = Math.max(96, Math.round(contentHeight * 2.4));
            fxPacked = downscaleFxPacked(fxPacked, maxFxH);
            const fxH = measureBodyH(fxPacked.frames, fxPacked.frameWidth, fxPacked.frameHeight);
            fxEntry = await writeSheet(
              outDir,
              qaDir,
              metaJson,
              id,
              `combo${i + 1}-fx`,
              fxPacked,
              fxH,
              { frameRate: 14 },
              { lockFeet: false, minOpaque: 12 },
            );
          }
        }
      }
    }

    comboSheets.push(fxEntry ? { ...entry, fx: fxEntry } : entry);
  }

  const { hurt, death } = pickHurtDeath(air, cfg);
  const hurtSeq = await packSequence(sff, hurt, outDir, srcDir, 'hurt');
  const deathSeq = await packSequence(sff, death, outDir, srcDir, 'death');
  const hurtPacked = await packSprites((hurtSeq || idleSeq).sprites);
  const deathPacked = await packSprites((deathSeq || idleSeq).sprites);

  const idleEntry = await writeSheet(outDir, qaDir, metaJson, id, 'idle', idlePacked, contentHeight, {
    frameRate: 8,
  }, { lockFeet: true });
  const walkEntry = await writeSheet(outDir, qaDir, metaJson, id, 'walk', walkPacked, contentHeight, {
    frameRate: 12,
  }, { lockFeet: walkPacked.frames.length >= 2 });
  await writePng(preview, idlePacked.frames[0], idlePacked.frameWidth, idlePacked.frameHeight);

  const hurtEntry = await writeSheet(
    outDir,
    qaDir,
    metaJson,
    id,
    'hurt',
    hurtPacked,
    contentHeight,
    { frameRate: 10 },
    { lockFeet: hurtPacked.frames.length >= 2 },
  );
  const deathEntry = await writeSheet(
    outDir,
    qaDir,
    metaJson,
    id,
    'death',
    deathPacked,
    contentHeight,
    { frameRate: 8 },
    { lockFeet: false },
  );

  const specials = pickSpecials(air, cfg.specialIds || cfg.specialIds);
  const omitSkills = new Set((cfg.omitSkillIndexes ?? []).map(Number));
  const skillAnims = [];
  for (let i = 0; i < specials.length; i += 1) {
    if (omitSkills.has(i)) continue;
    const spec = specials[i];
    const file = `special${i + 1}`;
    const split = splitBodyFx(spec.frames);
    let leftoverFx = split.fx;
    let packed = idlePacked;
    // Some chars store attack poses in high sprite groups (e.g. Mereoleona 633).
    // Treat those action frames as body when they are not a long FX dump.
    const highGroupBody =
      split.body.length < 2 &&
      spec.frames.length >= 2 &&
      !looksLikeFxDump(spec.frames) &&
      spec.frames.every((f) => f.group < 2000);
    const bodyFrames = highGroupBody ? spec.frames : split.body;
    if (highGroupBody) leftoverFx = [];
    if (bodyFrames.length >= 2) {
      const seq = await packSequence(sff, bodyFrames.slice(0, 24), outDir, srcDir, file);
      if (!seq) continue;
      packed = await packSprites(seq.sprites);
      if (packed.frames.length < 2 || packed.frameHeight > contentHeight * 2.6) {
        leftoverFx = [...spec.frames, ...leftoverFx];
        packed = idlePacked;
        console.log(`  ${file} body was FX dump — idle pose + VFX`);
      }
    } else {
      leftoverFx = [...spec.frames, ...leftoverFx];
      console.log(`  ${file} no body clip — idle pose + VFX`);
    }
    const times = timing(spec.frames, spec.act);
    const skillId = `skill-${id}-${i + 1}`;
    const skillName = spec.act.name && !/^Action /i.test(spec.act.name)
      ? spec.act.name
      : `${cfg.name} · Especial ${i + 1}`;

    const entry = await writeSheet(
      outDir,
      qaDir,
      metaJson,
      id,
      file,
      packed,
      contentHeight,
      { ...times, skillId, skillName, actionId: spec.id },
      // Skills frequentemente saltam / dash — não exigir pés travados.
      { lockFeet: false },
    );

    const fxGroupSpecs = cfg.specialFxGroups?.[spec.id] || [];
    const groupFx = [];
    for (const groupSpec of fxGroupSpecs) {
      groupFx.push(...(await extractGroupRefs(sff, groupSpec)));
    }
    const fxIdOverride = Array.isArray(cfg.specialFxIds?.[spec.id])
      ? cfg.specialFxIds[spec.id]
      : [];
    // Chave presente em specialFxIds = FX curado (mesmo se [] = sem overlay).
    // Evita que leftoverFx misture o corpo no VFX.
    const curatedFx =
      groupFx.length >= 2 ||
      (cfg.specialFxIds != null && Object.prototype.hasOwnProperty.call(cfg.specialFxIds, spec.id));
    const fxRefs = uniqueRefs([
      ...(curatedFx ? [] : leftoverFx),
      ...groupFx,
      ...fxActionIds(spec.id, air, fxIdOverride).flatMap((fxId) => actionClips(air, fxId)),
    ]);
    let fxEntry = null;
    if (fxRefs.length >= 2) {
      const fxSeq = await packSequence(
        sff,
        fxRefs,
        outDir,
        srcDir,
        `${file}-fx`,
        { fx: true, additive: Boolean(cfg.fxAdditive) },
      );
      if (fxSeq && fxSeq.sprites.length >= 2) {
        const specialPalFx = cfg.specialFxPalFx?.[spec.id];
        if (specialPalFx) {
          for (const spr of fxSeq.sprites) bakePalFx(spr.rgba, specialPalFx);
        }
        // FX curado dispensa o filtro por tamanho (jutsu pode ser menor que o
        // corpo), mas o descarte de canvas sólido continua valendo: rip aditivo
        // vem com fundo preto opaco.
        const fxSprites = curatedFx
          ? dropSolidFillFx(fxSeq.sprites)
          : dropSolidFillFx(dropBodySizedFx(fxSeq.sprites, contentHeight));
        if (fxSprites.length < 2) {
          console.log(`  ${file}-fx skipped: body-sized only`);
        } else {
          let fxPacked = await packSprites(capFxSprites(fxSprites, cfg.fxFrameCap), {
            fx: true,
            additive: Boolean(cfg.fxAdditive),
          });
          const opaqueFrames = fxPacked.frames.filter((frame) => spriteQuality(frame).opaque >= 12);
          if (opaqueFrames.length < 2) {
            console.log(`  ${file}-fx skipped: empty after knockout`);
          } else {
            fxPacked.frames = opaqueFrames;
            // Jutsu pode ser maior que um combo, mas sem virar tela cheia.
            fxPacked = downscaleFxPacked(
              fxPacked,
              Math.max(128, Math.round(contentHeight * 3.2)),
              Math.max(160, Math.round(contentHeight * 4)),
            );
            const fxH = measureBodyH(fxPacked.frames, fxPacked.frameWidth, fxPacked.frameHeight);
            const fxTimes = timing(fxSeq.refs);
            fxEntry = await writeSheet(
              outDir,
              qaDir,
              metaJson,
              id,
              `${file}-fx`,
              fxPacked,
              fxH,
              { frameRate: fxTimes.frameRate, durationMs: fxTimes.durationMs },
              { lockFeet: false, minOpaque: 12 },
            );
          }
        }
      }
    }
    skillAnims.push({ skillId, skillName, file, entry, fx: fxEntry, index: i });
  }

  const wire = {
    id,
    name: cfg.name,
    lookType: cfg.lookType,
    contentHeight,
    idle: idleEntry,
    walk: walkEntry,
    combo: comboSheets,
    hurt: hurtEntry,
    death: deathEntry,
    skills: skillAnims,
  };
  fs.writeFileSync(path.join(outDir, 'wire.json'), JSON.stringify(wire, null, 2));
  console.log(`  contentHeight=${contentHeight} skills=${skillAnims.length}`);
  return wire;
}

module.exports = { packMugenCharacter };
