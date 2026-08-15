/**
 * Shared combo hit-spark sheet (5×48px frames).
 * node scripts/generate-combo-hit-fx.js
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const FW = 48;
const FH = 48;
const FRAMES = 5;
const OUT = path.join(__dirname, '..', 'public', 'sprites', 'fx', 'combo-hit.png');

function frameSvg(i) {
  const t = i / (FRAMES - 1);
  const len = 6 + t * 16;
  const thick = Math.max(1.2, 3.2 - t * 2.4);
  const alpha = 1 - t * 0.55;
  const coreR = Math.max(1.5, 5 - t * 3.5);
  const glowR = 8 + t * 10;
  const glowA = 0.35 * (1 - t);
  const cx = 24;
  const cy = 24;
  const lines = [];
  for (let a = 0; a < 8; a++) {
    const rad = (a * Math.PI) / 4;
    const x2 = cx + Math.cos(rad) * len;
    const y2 = cy + Math.sin(rad) * len;
    lines.push(
      `<line x1="${cx}" y1="${cy}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="rgba(255,248,220,${alpha.toFixed(2)})" stroke-width="${thick}" stroke-linecap="round"/>`,
    );
  }
  for (let a = 0; a < 4; a++) {
    const rad = (a * Math.PI) / 2 + Math.PI / 8;
    const L = len * 0.55;
    const x2 = cx + Math.cos(rad) * L;
    const y2 = cy + Math.sin(rad) * L;
    lines.push(
      `<line x1="${cx}" y1="${cy}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="rgba(255,210,90,${(alpha * 0.85).toFixed(2)})" stroke-width="${thick * 0.7}" stroke-linecap="round"/>`,
    );
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${FW}" height="${FH}">
    <circle cx="${cx}" cy="${cy}" r="${glowR}" fill="rgba(255,200,80,${glowA.toFixed(2)})"/>
    ${lines.join('\n    ')}
    <circle cx="${cx}" cy="${cy}" r="${coreR}" fill="rgba(255,255,255,${alpha.toFixed(2)})"/>
  </svg>`;
}

async function main() {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const bufs = [];
  for (let i = 0; i < FRAMES; i++) {
    bufs.push(await sharp(Buffer.from(frameSvg(i))).png().toBuffer());
  }
  await sharp({
    create: {
      width: FW * FRAMES,
      height: FH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(bufs.map((input, i) => ({ input, left: i * FW, top: 0 })))
    .png()
    .toFile(OUT);
  console.log('wrote', OUT, `${FRAMES}×${FW}x${FH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
