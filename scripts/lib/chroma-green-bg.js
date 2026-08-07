/**
 * Sakura — chroma verde robusto.
 * - Só remove verde ligado ao exterior (não ilhas entre pernas… mas
 *   preenche buracos fechos pelo interior via closing leve).
 * - Labels brancos ("IDLE") sem confudir pele rosa.
 */
function isLabelPixel(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const avg = (r + g + b) / 3;
  if (max - min <= 22 && avg >= 160) return true;
  if (avg >= 200 && max - min <= 28 && Math.abs(g - r) <= 18 && Math.abs(g - b) <= 18) {
    return true;
  }
  return false;
}

function greenness(r, g, b) {
  return g - Math.max(r, b);
}

function isGreenBg(r, g, b) {
  const gn = greenness(r, g, b);
  // inclui verde escuro residual de AA (#082f07) sem pegar botas azuladas
  if (g >= 38 && gn >= 22 && r <= 40 && b <= 40) return true;
  if (g >= 50 && gn >= 22) return true;
  if (g >= 70 && gn >= 14 && r <= 90 && b <= 90) return true;
  if (g >= 55 && g >= r + 25 && g >= b + 25) return true;
  if (g >= 90 && r <= 120 && b <= 100 && g > r + 15 && g > b + 15) return true;
  return false;
}

function isStrongGreen(r, g, b) {
  return g >= 60 && greenness(r, g, b) >= 28;
}

/**
 * @param {Buffer} data
 * @param {number} w
 * @param {number} h
 * @param {{ stripLabels?: boolean, floodLabels?: boolean }} [opts]
 *  stripLabels — remove pixels “label-like” (branco saturado) no strip inteiro.
 *    Padrão true (IDLE tags em sakura…). Desligar p/ cachecol/bandagens brancas (chouji).
 *  floodLabels — exterior propaga também por pixel label-like. Padrão = stripLabels.
 */
function keyGreenBackground(data, w, h, opts = {}) {
  const stripLabels = opts.stripLabels !== false;
  const floodLabels = opts.floodLabels !== undefined ? !!opts.floodLabels : stripLabels;
  const out = Buffer.from(data);
  const N = w * h;
  const exterior = new Uint8Array(N);
  const stack = [];

  const tryExterior = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const idx = y * w + x;
    if (exterior[idx]) return;
    const i = idx * 4;
    const r = out[i];
    const g = out[i + 1];
    const b = out[i + 2];
    const a = out[i + 3];
    // Exterior propaga por verde/label/já-transparente — NÃO por pele/corpo.
    if (a < 16 || isGreenBg(r, g, b) || (floodLabels && isLabelPixel(r, g, b))) {
      exterior[idx] = 1;
      stack.push(idx);
    }
  };

  for (let x = 0; x < w; x += 1) {
    tryExterior(x, 0);
    tryExterior(x, h - 1);
  }
  for (let y = 0; y < h; y += 1) {
    tryExterior(0, y);
    tryExterior(w - 1, y);
  }

  while (stack.length) {
    const idx = stack.pop();
    const x = idx % w;
    const y = (idx / w) | 0;
    tryExterior(x + 1, y);
    tryExterior(x - 1, y);
    tryExterior(x, y + 1);
    tryExterior(x, y - 1);
  }

  // Remove apenas o que é exterior (fundo/labels). Ilhas interiores de "verde"
  // no JPEG viram despill, não buraco.
  for (let idx = 0; idx < N; idx += 1) {
    const i = idx * 4;
    if (out[i + 3] < 16) continue;
    const r = out[i];
    const g = out[i + 1];
    const b = out[i + 2];
    if (
      exterior[idx] &&
      (isGreenBg(r, g, b) || (stripLabels && isLabelPixel(r, g, b)))
    ) {
      out[i] = 0;
      out[i + 1] = 0;
      out[i + 2] = 0;
      out[i + 3] = 0;
      continue;
    }
    // Labels flutuantes no meio do strip (ainda connected exterior) já saíram.
    // Labels isolados? Raro; limpa branco puro não-exterior se minúsculo depois.
    if (!exterior[idx] && isStrongGreen(r, g, b)) {
      // despill interior residual
      out[i + 1] = Math.max(r, b);
    }
  }

  // Labels brancos que sobraram (não green) — opcional: confunde com cachecol/bandagem.
  if (stripLabels) {
    for (let i = 0; i < out.length; i += 4) {
      if (out[i + 3] < 16) continue;
      if (isLabelPixel(out[i], out[i + 1], out[i + 2])) {
        out[i] = 0;
        out[i + 1] = 0;
        out[i + 2] = 0;
        out[i + 3] = 0;
      }
    }
  }

  // Despill de franja exterior (verde residual residual no contorno)
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const i = (y * w + x) * 4;
      if (out[i + 3] < 16) continue;
      const r = out[i];
      const g = out[i + 1];
      const b = out[i + 2];
      const gn = greenness(r, g, b);
      if (gn < 8) continue;
      let edge = false;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        if (out[((y + dy) * w + (x + dx)) * 4 + 3] < 16) {
          edge = true;
          break;
        }
      }
      if (edge && g > Math.max(r, b) + 6) {
        out[i + 1] = Math.max(r, b);
      }
    }
  }

  // Preenche buracos interiores pequenos (transparentes 4-conectado sem tocar borda)
  fillInteriorHoles(out, w, h, 48);

  return out;
}

function fillInteriorHoles(out, w, h, maxHole) {
  const N = w * h;
  const visit = new Uint8Array(N);
  const isEmpty = (idx) => out[idx * 4 + 3] < 16;

  for (let start = 0; start < N; start += 1) {
    if (visit[start] || !isEmpty(start)) continue;

    // flood component
    const comp = [];
    const stack = [start];
    visit[start] = 1;
    let touchesBorder = false;
    while (stack.length) {
      const idx = stack.pop();
      comp.push(idx);
      const x = idx % w;
      const y = (idx / w) | 0;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) touchesBorder = true;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        if (visit[ni] || !isEmpty(ni)) continue;
        visit[ni] = 1;
        stack.push(ni);
      }
    }

    if (touchesBorder || comp.length > maxHole) continue;

    // preenche com média dos vizinhos opacos
    for (const idx of comp) {
      const x = idx % w;
      const y = (idx / w) | 0;
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const ni = (ny * w + nx) * 4;
          if (out[ni + 3] < 16) continue;
          if (isGreenBg(out[ni], out[ni + 1], out[ni + 2])) continue;
          r += out[ni];
          g += out[ni + 1];
          b += out[ni + 2];
          n += 1;
        }
      }
      const i = idx * 4;
      if (n === 0) {
        // fallback pele/sombra neutra
        out[i] = 180;
        out[i + 1] = 140;
        out[i + 2] = 130;
        out[i + 3] = 255;
      } else {
        out[i] = Math.round(r / n);
        out[i + 1] = Math.round(g / n);
        out[i + 2] = Math.round(b / n);
        out[i + 3] = 255;
      }
    }
  }
}

function isContent(data, i) {
  return data[i + 3] >= 16;
}

module.exports = {
  isLabelPixel,
  isGreenBg,
  keyGreenBackground,
  fillInteriorHoles,
  isContent,
};
