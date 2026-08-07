/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Gera os previews da tela de criação a partir do 1º frame do walk sheet
 * de cada starter. Saída: public/sprites/player/previews/<id>.png
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'previews');

const SOURCES = [
  {
    id: 'naruto-classic',
    sheet: 'public/sprites/player/naruto-walk.png',
    frameWidth: 64,
    frameHeight: 98,
    frame: 0,
  },
  {
    id: 'sasuke-classic',
    sheet: 'public/sprites/player/sasuke/classic/walk.png',
    frameWidth: 98,
    frameHeight: 98,
    frame: 0,
  },
  {
    // Rock Lee ainda usa o visual do Naruto (mesmo fallback do character pack).
    id: 'rock-lee',
    sheet: 'public/sprites/player/naruto-walk.png',
    frameWidth: 64,
    frameHeight: 98,
    frame: 0,
  },
];

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const source of SOURCES) {
    const input = path.join(ROOT, source.sheet);
    if (!fs.existsSync(input)) {
      console.warn(`pulando ${source.id}: ${source.sheet} não encontrado`);
      continue;
    }

    const out = path.join(OUT_DIR, `${source.id}.png`);
    await sharp(input)
      .extract({
        left: source.frame * source.frameWidth,
        top: 0,
        width: source.frameWidth,
        height: source.frameHeight,
      })
      .trim()
      .png()
      .toFile(out);

    const meta = await sharp(out).metadata();
    console.log(`${source.id}: ${meta.width}x${meta.height} → ${out}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
