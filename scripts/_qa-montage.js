/**
 * Visual QA montage for a packed MUGEN character.
 * node scripts/_qa-montage.js <id> [scale]
 * Writes assets-src/_qa/<id>/_review-<name>.png (nearest upscale over magenta).
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const id = process.argv[2] || 'ichigo';
const scale = Number(process.argv[3] || 4);
const outDir = path.join(ROOT, 'assets-src', '_qa', id);
const sheetDir = path.join(ROOT, 'public', 'sprites', 'player', id);

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const wire = JSON.parse(fs.readFileSync(path.join(sheetDir, 'wire.json'), 'utf8'));
  const names = fs
    .readdirSync(sheetDir)
    .filter((f) => f.endsWith('.png'))
    .sort();
  for (const file of names) {
    const src = path.join(sheetDir, file);
    const img = sharp(src);
    const meta = await img.metadata();
    const w = meta.width * scale;
    const h = meta.height * scale;
    const up = await sharp(src)
      .resize(w, h, { kernel: sharp.kernel.nearest })
      .png()
      .toBuffer();
    await sharp({
      create: {
        width: w,
        height: h,
        channels: 4,
        background: { r: 255, g: 0, b: 255, alpha: 1 },
      },
    })
      .composite([{ input: up }])
      .png()
      .toFile(path.join(outDir, `_review-${file}`));
    console.log(`${file} ${meta.width}x${meta.height} -> ${w}x${h}`);
  }
  console.log('contentHeight', wire.contentHeight);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
