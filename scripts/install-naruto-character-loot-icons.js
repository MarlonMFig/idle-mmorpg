const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const root =
  'c:/Users/marlo/Projects/idle-mmorpg/assets/loot-icons-atlas/anime-idle-world-loots-ordem-personagens';
const outDir = 'c:/Users/marlo/Projects/idle-mmorpg/public/ui/items/naruto';
const dropItemsPath =
  'c:/Users/marlo/Projects/idle-mmorpg/src/data/naruto-character-drop-items.ts';

async function main() {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));

  const nameToId = {
    'Casulo de Inseto': 'item-anime-naruto-casulo-insetos',
    'Cabaça de Areia': 'item-anime-naruto-cabaca-areia',
    'Máscara ANBU': 'item-anime-naruto-mascara-anbu',
  };

  const dropSrc = fs.readFileSync(dropItemsPath, 'utf8');
  const re = /'(item-anime-naruto-[^']+)':\s*item\(\s*'[^']+',\s*'([^']+)'/g;
  let m;
  while ((m = re.exec(dropSrc))) {
    nameToId[m[2]] = m[1];
  }

  const byName = new Map();
  for (const c of manifest.characters) {
    for (const loot of c.loots) {
      if (!byName.has(loot.name)) byName.set(loot.name, loot);
    }
  }

  fs.mkdirSync(outDir, { recursive: true });

  const iconByItemId = {};
  const missing = [];
  const copied = [];

  for (const [name, loot] of byName) {
    const itemId = nameToId[name];
    if (!itemId) {
      missing.push(name);
      continue;
    }
    const slug = itemId.replace(/^item-anime-naruto-/, '');
    const destName = `${slug}.png`;
    const src = path.join(root, loot.flat_file);
    const dest = path.join(outDir, destName);
    await sharp(src).png().toFile(dest);
    iconByItemId[itemId] = destName;
    copied.push({ name, itemId, destName });
  }

  fs.writeFileSync(
    path.join(root, '_install-map.json'),
    JSON.stringify({ iconByItemId, missing, copied }, null, 2),
  );

  console.log('copied', copied.length);
  console.log('missing', missing);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
