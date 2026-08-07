/**
 * Extração de sprites com fundo preto/charcoal (AI mockups / JPEG).
 *
 * Não usa flood global que "come" calças/cinto cinza da mesma faixa do fundo.
 * 1) Pixels cromáticos (roupa, pele, cabelo, areia) = corpo seed
 * 2) Dilata o seed para capturar contornos/pretos adjacentes
 * 3) Resto (fundo, labels) = transparente
 */
function isLabelPixel(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const avg = (r + g + b) / 3;
  if (max - min <= 18 && avg >= 70) return true;
  if (r > 160 && g > 160 && b > 90 && Math.abs(r - g) < 40) return true;
  return false;
}

/** Baixa saturação + escuro ≈ fundo (ou contorno). */
function isLowSatDark(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max - min <= 16 && max <= 50;
}

/** Seed do personagem: cor cromática ou pele/areia/sombra da roupa. */
function isBodySeed(r, g, b) {
  if (isLabelPixel(r, g, b)) return false;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max - min;
  // cromático forte (cabelo, robe, gourd, efeito areia)
  if (sat >= 14 && max >= 28) return true;
  // sombra de robe/cabelo avermelhada (mesmo com sat baixa)
  if (r >= g + 4 && r >= b + 4 && r >= 18 && r <= 140 && max <= 150) return true;
  // pele
  if (r > 110 && g > 85 && b > 65 && r >= g && g >= b - 8 && sat >= 10) return true;
  // areia clara / gourd highlights
  if (r > 85 && g > 65 && b < 145 && r >= g - 8 && g >= b - 5 && sat >= 10 && max < 235) {
    return true;
  }
  return false;
}

function keyBackground(data, w, h) {
  const N = w * h;
  const seed = new Uint8Array(N);

  for (let i = 0; i < N; i += 1) {
    const p = i * 4;
    if (isBodySeed(data[p], data[p + 1], data[p + 2])) seed[i] = 1;
  }

  // Dilata seed 4x para abraçar contornos pretos e calças escuras
  let mark = seed;
  for (let pass = 0; pass < 4; pass += 1) {
    const next = new Uint8Array(N);
    next.set(mark);
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const idx = y * w + x;
        if (mark[idx]) continue;
        const p = idx * 4;
        const r = data[p];
        const g = data[p + 1];
        const b = data[p + 2];
        if (isLabelPixel(r, g, b)) continue;
        // só expande em pixels escuros/contorno (não engolir o fundo inteiro)
        if (!isLowSatDark(r, g, b) && Math.max(r, g, b) > 55) continue;
        let near = false;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
          [1, 1],
          [1, -1],
          [-1, 1],
          [-1, -1],
        ]) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          if (mark[ny * w + nx]) {
            near = true;
            break;
          }
        }
        if (near) next[idx] = 1;
      }
    }
    mark = next;
  }

  const out = Buffer.alloc(data.length);
  for (let i = 0; i < N; i += 1) {
    const p = i * 4;
    if (!mark[i]) {
      out[p + 3] = 0;
      continue;
    }
    const r = data[p];
    const g = data[p + 1];
    const b = data[p + 2];
    if (isLabelPixel(r, g, b)) {
      out[p + 3] = 0;
      continue;
    }
    out[p] = r;
    out[p + 1] = g;
    out[p + 2] = b;
    out[p + 3] = 255;
  }

  // remove ilhas minúsculas (sujeira)
  const visit = new Uint8Array(N);
  for (let i = 0; i < N; i += 1) {
    if (out[i * 4 + 3] < 16 || visit[i]) continue;
    const stack = [i];
    const comp = [];
    visit[i] = 1;
    while (stack.length) {
      const idx = stack.pop();
      comp.push(idx);
      const x = idx % w;
      const y = (idx / w) | 0;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const nidx = ny * w + nx;
        if (visit[nidx] || out[nidx * 4 + 3] < 16) continue;
        visit[nidx] = 1;
        stack.push(nidx);
      }
    }
    if (comp.length < 18) {
      for (const idx of comp) out[idx * 4 + 3] = 0;
    }
  }

  return out;
}

function isContent(data, i) {
  return data[i + 3] >= 16;
}

module.exports = {
  isLabelPixel,
  keyBackground,
  isContent,
};
