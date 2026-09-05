const fs = require('fs');
const path = require('path');

const manifest = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'public', 'data', 'wonsr', 'maps', 'topdown-novos-manifest.json'), 'utf8'),
);
const tsPath = path.join(__dirname, '..', 'src', 'data', 'wonsr-rendered-maps.ts');
let ts = fs.readFileSync(tsPath, 'utf8');

function spawnsBlock(spawns) {
  return spawns.map((p) => `      { x: ${p.x}, y: ${p.y} },`).join('\n');
}

function formatEntry(m) {
  return `  [MAP_KEYS.${m.mapKey}]: narutoTopdownHunt(
    MAP_KEYS.${m.mapKey},
    '${m.slug}',
    { x: ${m.spawn.x}, y: ${m.spawn.y} },
    [
${spawnsBlock(m.enemySpawns)}
    ],
    { width: ${m.width}, height: ${m.height}, cacheTag: '${m.cacheTag}' },
  ),`;
}

const order = [
  'huntWonsrFlorestaDaMorte',
  'huntWonsrCampoTreinamento',
  'huntWonsrCavernaAkatsuki',
  'huntWonsrDesertoAreia',
  'huntWonsrEsconderijoOrochimaru',
  'huntWonsrPaisDoFerro',
  'huntWonsrPonteDaNevoa',
  'huntWonsrValeDasEstatuas',
  'huntWonsrClareiraEquipe7',
  'huntWonsrLaboratorioOrochimaru',
  'huntTdValeDoFim',
  'huntTdArenaExameChunin',
  'huntTdPonteDasOndas',
  'huntTdClareiraEquipe7',
  'huntTdCavernaAkatsuki',
  'huntTdCrateraKonoha',
  'huntTdLaboratorioOrochimaru',
  'huntTdArenaVilaAreia',
  'huntTdIlhaTartaruga',
  'huntTdMonteMyoboku',
  'huntTdUzushiogakure',
  'huntTdCampoUchiha',
  'huntTdHospitalKonoha',
];

const byKey = new Map(manifest.maps.map((m) => [m.mapKey, m]));

for (const mapKey of order) {
  const m = byKey.get(mapKey);
  if (!m) throw new Error(`manifest missing ${mapKey}`);
  const re = new RegExp(
    `\\[MAP_KEYS\\.${mapKey}\\]: narutoTopdownHunt\\([\\s\\S]*?\\),`,
    'm',
  );
  const next = formatEntry(m);
  if (!re.test(ts)) throw new Error(`block not found: ${mapKey}`);
  ts = ts.replace(re, next);
}

const outPath = process.argv[2] || tsPath;
fs.writeFileSync(outPath, ts);
console.log('patched', order.length, 'top-down entries →', outPath);
