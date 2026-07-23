import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

function csvGrid(w: number, h: number, fill: (x: number, y: number) => number): string {
  const rows: string[] = [];
  for (let y = 0; y < h; y += 1) {
    const row: string[] = [];
    for (let x = 0; x < w; x += 1) row.push(String(fill(x, y)));
    rows.push(row.join(','));
  }
  return `${rows.join(',\n')},`;
}

function tmx(w: number, h: number, fill: (x: number, y: number) => number): string {
  const data = csvGrid(w, h, fill);
  return `<?xml version="1.0" encoding="UTF-8"?>
<map version="1.10" tiledversion="1.10.2" orientation="orthogonal" renderorder="right-down" width="${w}" height="${h}" tilewidth="32" tileheight="32" infinite="0" nextlayerid="2" nextobjectid="1">
 <tileset firstgid="1" name="base" tilewidth="32" tileheight="32" tilecount="4" columns="4">
  <image source="../tilesets/base.png" width="128" height="32"/>
 </tileset>
 <layer id="1" name="ground" width="${w}" height="${h}">
  <data encoding="csv">
${data}
</data>
 </layer>
</map>
`;
}

const dir = join(process.cwd(), 'public/maps');
mkdirSync(dir, { recursive: true });

writeFileSync(
  join(dir, 'leafVillage.tmx'),
  tmx(24, 24, (x, y) => {
    if (x === 0 || y === 0 || x === 23 || y === 23) return 4;
    if (x === 12 || y === 12) return 2;
    return 1;
  }),
);

writeFileSync(
  join(dir, 'forest.tmx'),
  tmx(24, 24, (x, y) => {
    const dx = x - 12;
    const dy = y - 12;
    if (dx * dx + dy * dy < 16) return 3;
    if (x % 5 === 0 && y % 5 === 0) return 4;
    return 1;
  }),
);

writeFileSync(
  join(dir, 'academy.tmx'),
  tmx(20, 20, (x, y) => {
    if (x < 2 || y < 2 || x > 17 || y > 17) return 2;
    return 4;
  }),
);

console.log('wrote leafVillage.tmx, forest.tmx, academy.tmx');
