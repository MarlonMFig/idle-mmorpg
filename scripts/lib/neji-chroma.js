/**
 * Neji sheets — exterior chroma for cyan/teal (and optional magenta) backgrounds.
 * Flood from edges only so skin, white shirt, black hair and yellow dome stay.
 */

function isLabelPixel(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const avg = (r + g + b) / 3;
  if (max - min <= 22 && avg >= 160) return true;
  return false;
}

/** Pure cyan #01FFFF + mid teal ~48,152,153 + fringes. */
function isCyanTealBg(r, g, b) {
  // pure / near-pure cyan
  if (r <= 40 && g >= 200 && b >= 200) return true;
  if (r <= 20 && g >= 230 && b >= 230) return true;
  // mid teal screen (~#2E9292 / #309898)
  if (
    r >= 20 &&
    r <= 100 &&
    g >= 100 &&
    g <= 200 &&
    b >= 100 &&
    b <= 205 &&
    Math.abs(g - b) <= 40 &&
    Math.min(g, b) >= r + 28
  ) {
    return true;
  }
  // bright cyan AA / grid
  if (r <= 90 && g >= 165 && b >= 165 && Math.min(g, b) > r + 45) return true;
  // light cyan residual
  if (r <= 100 && g >= 210 && b >= 200 && Math.abs(g - b) <= 40 && g > r + 50) return true;
  // dark teal AA fringe (often stuck to silhouette edges)
  if (r <= 70 && g >= 75 && b >= 75 && Math.min(g, b) > r + 28 && Math.abs(g - b) <= 35) {
    return true;
  }
  // pale teal residual
  if (r <= 130 && g >= 140 && b >= 140 && Math.min(g, b) > r + 20 && Math.abs(g - b) <= 28 && g >= 150) {
    return true;
  }
  return false;
}

/** Dark magenta dome backdrop ~152,24,72 (+ AA). Not brown dust. */
function isMagentaBg(r, g, b) {
  // Never key yellow energy as magenta.
  if (isYellowEnergy(r, g, b)) return false;
  // Gate: low green, red-magenta dominant (not earth brown dust).
  if (g > 95) return false;
  if (b < 35 || b > 160) return false;

  // Classic #981848 family
  if (r >= 100 && g <= 80 && b >= 40 && b <= 140 && r > g + 40 && r >= b - 10) return true;
  // Slightly brighter AA fringe
  if (r >= 130 && g <= 70 && b >= 50 && b <= 130 && r > g + 50) return true;
  // Desat purple-magenta
  if (r >= 110 && g <= 55 && b >= 70 && b <= 140 && r - g >= 55) return true;
  // Muted mauve residual ~87,53,90 (grid / AA). Require purple bias (b ~ r).
  if (
    r >= 80 &&
    r <= 110 &&
    g >= 40 &&
    g <= 65 &&
    b >= 75 &&
    b <= 110 &&
    r > g + 22 &&
    b > g + 18 &&
    Math.abs(r - b) <= 28
  ) {
    return true;
  }
  // Deep wine residual
  if (r >= 100 && r <= 145 && g <= 40 && b >= 45 && b <= 95 && r > g + 55) return true;
  return false;
}

function isYellowEnergy(r, g, b) {
  // Preserve Kaiten dome / motion arcs — never treat as bg.
  if (r >= 130 && g >= 85 && b <= 130 && r + g > b * 2) return true;
  if (r >= 160 && g >= 120 && b <= 100) return true;
  if (r >= 100 && g >= 60 && b <= 55 && r > b && g > b) return true;
  return false;
}

function isKeyableBg(r, g, b, opts = {}) {
  if (isYellowEnergy(r, g, b)) return false;
  if (isCyanTealBg(r, g, b)) return true;
  if (opts.magenta && isMagentaBg(r, g, b)) return true;
  if (isLabelPixel(r, g, b)) return true;
  return false;
}

/**
 * Exterior flood-fill key. opts.magenta = also remove magenta dome backdrop.
 */
function keyExteriorChroma(data, w, h, opts = {}) {
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
    if (a < 16 || isKeyableBg(r, g, b, opts)) {
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

  for (let idx = 0; idx < N; idx += 1) {
    const i = idx * 4;
    if (out[i + 3] < 16) continue;
    const r = out[i];
    const g = out[i + 1];
    const b = out[i + 2];
    if (exterior[idx] && isKeyableBg(r, g, b, opts)) {
      out[i] = 0;
      out[i + 1] = 0;
      out[i + 2] = 0;
      out[i + 3] = 0;
      continue;
    }
    // Non-exterior solid cyan still has no business — rare leftovers.
    if (!exterior[idx] && isCyanTealBg(r, g, b) && !isYellowEnergy(r, g, b)) {
      // light despill only if near-edge teal bleed into AA
      if (g > Math.max(r, b) + 20 && Math.min(g, b) > r + 40) {
        out[i + 1] = Math.max(r, Math.min(g, 160));
      }
    }
  }

  // Magenta dome backdrop is never character ink — strip globally when enabled
  // (rings of yellow isolate pockets of magenta from exterior flood).
  if (opts.magenta) {
    for (let i = 0; i < out.length; i += 4) {
      if (out[i + 3] < 16) continue;
      const r = out[i];
      const g = out[i + 1];
      const b = out[i + 2];
      if (isYellowEnergy(r, g, b)) continue;
      if (isMagentaBg(r, g, b)) {
        out[i] = 0;
        out[i + 1] = 0;
        out[i + 2] = 0;
        out[i + 3] = 0;
      }
    }
  }

  // Strip residual pure cyan/teal/magenta screen wherever it remains.
  for (let i = 0; i < out.length; i += 4) {
    if (out[i + 3] < 16) continue;
    const r = out[i];
    const g = out[i + 1];
    const b = out[i + 2];
    if (isYellowEnergy(r, g, b)) continue;
    if (isCyanTealBg(r, g, b) || (opts.magenta && isMagentaBg(r, g, b))) {
      out[i] = 0;
      out[i + 1] = 0;
      out[i + 2] = 0;
      out[i + 3] = 0;
    }
  }

  // Edge despill: teal/magenta AA stuck 1px into silhouette → kill if next to empty.
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      if (out[i + 3] < 16) continue;
      const r = out[i];
      const g = out[i + 1];
      const b = out[i + 2];
      if (isYellowEnergy(r, g, b)) continue;
      const tealish =
        g > Math.max(r, b) + 8 && Math.min(g, b) > r + 15 && g >= 70 && b >= 70;
      const magish =
        opts.magenta &&
        r >= 70 &&
        g <= 90 &&
        b >= 50 &&
        r > g + 15 &&
        !(r >= 160 && g >= 100);
      if (!tealish && !magish) continue;
      let nearEmpty = false;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) {
          nearEmpty = true;
          break;
        }
        if (out[(ny * w + nx) * 4 + 3] < 16) {
          nearEmpty = true;
          break;
        }
      }
      if (nearEmpty) {
        out[i + 3] = 0;
      }
    }
  }

  fillInteriorHoles(out, w, h, opts.maxHole ?? 120);
  return out;
}

function fillInteriorHoles(out, w, h, maxHole) {
  const N = w * h;
  const visit = new Uint8Array(N);
  const isEmpty = (idx) => out[idx * 4 + 3] < 16;

  for (let start = 0; start < N; start += 1) {
    if (visit[start] || !isEmpty(start)) continue;
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
          r += out[ni];
          g += out[ni + 1];
          b += out[ni + 2];
          n += 1;
        }
      }
      const i = idx * 4;
      if (n === 0) {
        out[i] = 180;
        out[i + 1] = 150;
        out[i + 2] = 140;
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
  isCyanTealBg,
  isMagentaBg,
  isYellowEnergy,
  isKeyableBg,
  keyExteriorChroma,
  fillInteriorHoles,
  isContent,
};
