/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Procura no layer de colisão do TMX um tile livre com folga ao redor,
 * o mais próximo possível do centro do recorte.
 *
 * Uso: node scripts/find-spawn.js public/maps/wonsr-konoha.tmx [raio]
 */
const fs = require('fs');

const tmxPath = process.argv[2] || 'public/maps/wonsr-konoha.tmx';
const radius = Number.parseInt(process.argv[3] || '2', 10);

const xml = fs.readFileSync(tmxPath, 'utf8');

const size = xml.match(/<map[^>]*\bwidth="(\d+)"[^>]*\bheight="(\d+)"/);
const width = Number.parseInt(size[1], 10);
const height = Number.parseInt(size[2], 10);

const layer = xml.match(
  /<layer[^>]*name="collision"[\s\S]*?<data[^>]*>([\s\S]*?)<\/data>/,
);
if (!layer) throw new Error('layer "collision" não encontrado no TMX');

const cells = layer[1]
  .trim()
  .split(/[,\s]+/)
  .filter(Boolean)
  .map(Number);

const isBlocked = (x, y) =>
  x < 0 || y < 0 || x >= width || y >= height || cells[y * width + x] !== 0;

const hasClearance = (x, y) => {
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (isBlocked(x + dx, y + dy)) return false;
    }
  }
  return true;
};

const candidates = [];
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    if (!hasClearance(x, y)) continue;
    candidates.push({
      x,
      y,
      distance: Math.hypot(x - width / 2, y - height / 2),
    });
  }
}
candidates.sort((a, b) => a.distance - b.distance);

const best = candidates[0];
console.log({
  freeTiles: cells.filter((v) => v === 0).length,
  totalTiles: cells.length,
  clearSpots: candidates.length,
  bestTile: best && { x: best.x, y: best.y },
  bestPixel: best && { x: best.x * 32 + 16, y: best.y * 32 + 16 },
  nextOptions: candidates
    .slice(1, 40)
    .map((c) => ({ tx: c.x, ty: c.y, px: c.x * 32 + 16, py: c.y * 32 + 16 })),
});
