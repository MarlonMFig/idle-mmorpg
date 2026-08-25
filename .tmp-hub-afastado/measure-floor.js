const sharp = require('sharp');
const path = require('path');

const hub = path.join(__dirname, '..', 'public', 'hubs', 'hub-interdimensional.png');
const out = path.join(__dirname, 'floor-preview.png');

async function main() {
  const W = 1024;
  const H = Math.round((1024 * 2160) / 4096);
  const scale = W / 4096;
  const oldY = 1489 * scale;
  const newY = 1566 * scale;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <line x1="0" y1="${oldY}" x2="${W}" y2="${oldY}" stroke="red" stroke-width="2"/>
    <line x1="0" y1="${newY}" x2="${W}" y2="${newY}" stroke="lime" stroke-width="2"/>
    <text x="10" y="${oldY - 4}" fill="red" font-size="14">old floor 1489</text>
    <text x="10" y="${newY - 4}" fill="lime" font-size="14">new floor 1566</text>
  </svg>`;
  await sharp(hub)
    .resize(W, H)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toFile(out);
  console.log('wrote', out);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
