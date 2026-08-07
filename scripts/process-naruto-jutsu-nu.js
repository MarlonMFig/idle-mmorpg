/**
 * Recorta as folhas de jutsu do Naruto (fonte "NU", fundo azul 73,176,255) em
 * strips horizontais uniformes prontos para `load.spritesheet` do Phaser.
 *
 * - Chroma key do fundo azul (+ regiões de crédito/título excluídas na mão)
 * - Bandas de linha e células por vãos transparentes
 * - Frames alinhados pelo pé (bottom) e centralizados em X
 *
 * Uso:
 *   node scripts/process-naruto-jutsu-nu.js            # grava as sheets
 *   node scripts/process-naruto-jutsu-nu.js --analyze  # só imprime a detecção
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'assets', 'naruto-source', 'nu');
const OUT = path.join(ROOT, 'public', 'sprites', 'player', 'naruto');

const BG = [73, 176, 255];
const TOL = 30;

const JOBS = [
  {
    key: 'naruto-rasengan-dash',
    file: 'rasengan-dash.png',
    out: 'rasengan-dash.png',
    // Crédito "Edited by Naruto[NU]" no canto inferior esquerdo.
    exclude: [{ x0: 0, y0: 52, x1: 240, y1: 65 }],
    minBandHeight: 20,
    gapX: 4,
    minCellWidth: 10,
  },
  {
    key: 'naruto-sexy-jutsu',
    file: 'sexy-jutsu.png',
    out: 'sexy-jutsu.png',
    minBandHeight: 30,
    gapX: 5,
    minCellWidth: 12,
  },
  {
    key: 'naruto-kyuubi',
    file: 'kyuubi.png',
    out: 'kyuubi.png',
    minBandHeight: 30,
    gapX: 5,
    minCellWidth: 14,
  },
];

function isBackground(r, g, b) {
  return (
    Math.abs(r - BG[0]) <= TOL &&
    Math.abs(g - BG[1]) <= TOL &&
    Math.abs(b - BG[2]) <= TOL
  );
}

/** Máscara de opacidade (1 = desenho) já sem fundo e sem regiões excluídas. */
function buildMask(data, width, height, channels, exclude) {
  const mask = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * channels;
      if (isBackground(data[i], data[i + 1], data[i + 2])) continue;
      mask[y * width + x] = 1;
    }
  }
  for (const rect of exclude ?? []) {
    for (let y = rect.y0; y < Math.min(rect.y1, height); y += 1) {
      for (let x = rect.x0; x < Math.min(rect.x1, width); x += 1) {
        mask[y * width + x] = 0;
      }
    }
  }
  return mask;
}

function findBands(mask, width, height, minBandHeight) {
  const bands = [];
  let start = -1;
  for (let y = 0; y <= height; y += 1) {
    let count = 0;
    if (y < height) {
      for (let x = 0; x < width; x += 1) count += mask[y * width + x];
    }
    const filled = count > 0;
    if (filled && start < 0) start = y;
    if (!filled && start >= 0) {
      if (y - start >= minBandHeight) bands.push({ top: start, bottom: y });
      start = -1;
    }
  }
  return bands;
}

function findCells(mask, width, band, gapX, minCellWidth) {
  const runs = [];
  let start = -1;
  for (let x = 0; x <= width; x += 1) {
    let count = 0;
    if (x < width) {
      for (let y = band.top; y < band.bottom; y += 1) count += mask[y * width + x];
    }
    const filled = count > 0;
    if (filled && start < 0) start = x;
    if (!filled && start >= 0) {
      runs.push({ left: start, right: x });
      start = -1;
    }
  }

  const merged = [];
  for (const run of runs) {
    const prev = merged[merged.length - 1];
    if (prev && run.left - prev.right <= gapX) prev.right = run.right;
    else merged.push({ ...run });
  }

  return merged
    .filter((run) => run.right - run.left >= minCellWidth)
    .map((run) => {
      let top = band.bottom;
      let bottom = band.top;
      for (let y = band.top; y < band.bottom; y += 1) {
        for (let x = run.left; x < run.right; x += 1) {
          if (!mask[y * width + x]) continue;
          if (y < top) top = y;
          if (y >= bottom) bottom = y + 1;
          break;
        }
      }
      return { left: run.left, right: run.right, top, bottom };
    })
    .filter((box) => box.bottom > box.top);
}

function compose(job, source) {
  const { data, width, height, channels, mask } = source;
  const bands = findBands(mask, width, height, job.minBandHeight);
  const boxes = [];
  const layout = [];
  for (const band of bands) {
    const cells = findCells(mask, width, band, job.gapX, job.minCellWidth);
    layout.push({ band, count: cells.length, widths: cells.map((c) => c.right - c.left) });
    boxes.push(...cells);
  }
  if (boxes.length === 0) throw new Error(`${job.key}: nenhum frame detectado`);

  const frameWidth = Math.max(...boxes.map((b) => b.right - b.left));
  const frameHeight = Math.max(...boxes.map((b) => b.bottom - b.top));
  const sheetWidth = frameWidth * boxes.length;
  const out = Buffer.alloc(sheetWidth * frameHeight * 4);

  boxes.forEach((box, index) => {
    const boxWidth = box.right - box.left;
    const boxHeight = box.bottom - box.top;
    const offsetX = index * frameWidth + Math.floor((frameWidth - boxWidth) / 2);
    const offsetY = frameHeight - boxHeight;
    for (let y = 0; y < boxHeight; y += 1) {
      for (let x = 0; x < boxWidth; x += 1) {
        const sx = box.left + x;
        const sy = box.top + y;
        if (!mask[sy * width + sx]) continue;
        const si = (sy * width + sx) * channels;
        const di = ((offsetY + y) * sheetWidth + offsetX + x) * 4;
        out[di] = data[si];
        out[di + 1] = data[si + 1];
        out[di + 2] = data[si + 2];
        out[di + 3] = 255;
      }
    }
  });

  const first = boxes[0];
  return {
    buffer: out,
    sheetWidth,
    frameWidth,
    frameHeight,
    frameCount: boxes.length,
    /** Altura do Naruto no primeiro frame — base da escala em jogo. */
    contentHeight: first.bottom - first.top,
    layout,
  };
}

async function run(job, analyzeOnly) {
  const input = path.join(SRC, job.file);
  const { data, info } = await sharp(input).raw().toBuffer({ resolveWithObject: true });
  const source = {
    data,
    width: info.width,
    height: info.height,
    channels: info.channels,
    mask: buildMask(data, info.width, info.height, info.channels, job.exclude),
  };

  const result = compose(job, source);
  console.log(`${job.key}: ${info.width}x${info.height} -> ${result.frameCount} frames`);
  for (const row of result.layout) {
    console.log(
      `  banda y=${row.band.top}..${row.band.bottom - 1} cells=${row.count} widths=[${row.widths.join(',')}]`,
    );
  }
  console.log(
    `  frame=${result.frameWidth}x${result.frameHeight} contentHeight=${result.contentHeight}`,
  );

  if (analyzeOnly) return null;

  fs.mkdirSync(OUT, { recursive: true });
  const outPath = path.join(OUT, job.out);
  await sharp(result.buffer, {
    raw: { width: result.sheetWidth, height: result.frameHeight, channels: 4 },
  })
    .png()
    .toFile(outPath);
  console.log(`  -> ${path.relative(ROOT, outPath)} ${result.sheetWidth}x${result.frameHeight}`);

  return {
    image: `/sprites/player/naruto/${job.out}`,
    frameWidth: result.frameWidth,
    frameHeight: result.frameHeight,
    frameCount: result.frameCount,
    contentHeight: result.contentHeight,
    source: job.file,
  };
}

async function main() {
  const analyzeOnly = process.argv.includes('--analyze');
  const meta = {};
  for (const job of JOBS) {
    const entry = await run(job, analyzeOnly);
    if (entry) meta[job.key] = entry;
  }
  if (analyzeOnly) return;
  const metaPath = path.join(OUT, 'meta.json');
  fs.writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`);
  console.log('\nmeta:', path.relative(ROOT, metaPath));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
