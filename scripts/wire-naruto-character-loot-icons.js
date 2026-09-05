const fs = require('fs');

const mapPath =
  'assets/loot-icons-atlas/anime-idle-world-loots-ordem-personagens/_install-map.json';
const filePath = 'src/data/naruto-character-drop-items.ts';
const { iconByItemId } = JSON.parse(fs.readFileSync(mapPath, 'utf8'));

let src = fs.readFileSync(filePath, 'utf8');

const re =
  /'(item-anime-naruto-[^']+)':\s*item\(\s*'([^']+)',\s*'([^']+)',\s*'([^']+)'(?:\s*,\s*'([^']+)')?\s*,?\s*\)/g;

let matched = 0;
src = src.replace(re, (_full, id, id2, name, rarity, existingIcon) => {
  matched += 1;
  const icon = iconByItemId[id] || existingIcon;
  if (!icon) {
    console.warn('no icon for', id);
    return `'${id}': item(\n    '${id2}',\n    '${name}',\n    '${rarity}',\n  )`;
  }
  return `'${id}': item(\n    '${id2}',\n    '${name}',\n    '${rarity}',\n    '${icon}',\n  )`;
});

fs.writeFileSync(filePath, src);
console.log('matched', matched);

const check = fs.readFileSync(filePath, 'utf8');
const withIcon = [
  ...check.matchAll(
    /'(item-anime-naruto-[^']+)':\s*item\(\s*'[^']+',\s*'[^']+',\s*'[^']+',\s*'[^']+'/g,
  ),
].map((m) => m[1]);
console.log('with icon', withIcon.length);
