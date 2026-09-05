/**
 * Duplica as caças da aba Naruto World para a aba NARUTO TOP DOWN
 * com os 13 mapas MAPAS NOVOS.
 * node scripts/add-naruto-topdown-tab-hunts.js
 */
const fs = require('fs');
const path = require('path');

const HUNTS_FILE = path.join(__dirname, '..', 'public', 'data', 'wonsr', 'hunts.json');

const LATERAL_TO_TD = {
  huntValeDoFim: 'huntTdValeDoFim',
  huntValeDoFimLateral: 'huntTdValeDoFim',
  huntValeLoop: 'huntTdValeDoFim',
  huntArenaExameChunin: 'huntTdArenaExameChunin',
  huntArenaExameChunnin: 'huntTdArenaExameChunin',
  huntPontePaisOnda: 'huntTdPonteDasOndas',
  huntForestClearing: 'huntTdClareiraEquipe7',
  huntCampoTreinamento: 'huntTdClareiraEquipe7',
  huntEsconderijoAkatsuki: 'huntTdCavernaAkatsuki',
  huntKonohaDestruida: 'huntTdCrateraKonoha',
  huntCampoGuerraNinja: 'huntTdCrateraKonoha',
  huntLabOrochimaru: 'huntTdLaboratorioOrochimaru',
  huntPaisDoVento: 'huntTdArenaVilaAreia',
  huntMonteMyoboku: 'huntTdMonteMyoboku',
  huntDistritoUchiha: 'huntTdCampoUchiha',
};

/** 13 mapas top-down distintos do MAPAS NOVOS. */
const ALL_TD = [
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

function pickTdMap(mapKey, index, targets) {
  if (LATERAL_TO_TD[mapKey]) return LATERAL_TO_TD[mapKey];
  const blob = `${targets[0]?.id || ''} ${targets[0]?.name || ''}`.toLowerCase();
  if (/gaara|areia|temari|kankuro|sasori/.test(blob)) return 'huntTdArenaVilaAreia';
  if (/zabuza|onda|haku|ponte/.test(blob)) return 'huntTdPonteDasOndas';
  if (/orochimaru|kabuto|lab|kimimaro/.test(blob)) return 'huntTdLaboratorioOrochimaru';
  if (/kisame|akatsuki|pain|konan|deidara/.test(blob)) return 'huntTdCavernaAkatsuki';
  if (/myoboku|gamabunta|jiraiya|sennin/.test(blob)) return 'huntTdMonteMyoboku';
  if (/uzushio|kushina|minato/.test(blob)) return 'huntTdUzushiogakure';
  if (/hospital|shizune|tsunade|sakura/.test(blob)) return 'huntTdHospitalKonoha';
  if (/ilha|tartaruga|bee|killer|gyuki/.test(blob)) return 'huntTdIlhaTartaruga';
  if (/uchiha|sasuke|itachi|shisui|danzo/.test(blob)) return 'huntTdCampoUchiha';
  if (/vale|hashirama|tobirama|madara/.test(blob)) return 'huntTdValeDoFim';
  if (/neji|lee|guy|exame|chunin|tenten/.test(blob)) return 'huntTdArenaExameChunin';
  if (/kakashi|equipe|naruto|konoha/.test(blob)) return 'huntTdClareiraEquipe7';
  return ALL_TD[index % ALL_TD.length];
}

const catalog = JSON.parse(fs.readFileSync(HUNTS_FILE, 'utf8'));
catalog.hunts = catalog.hunts.filter((hunt) => hunt.tab !== 'naruto-topdown');

const sources = catalog.hunts.filter((hunt) => {
  if (hunt.tab === 'bosses' || hunt.tab === 'wonsr' || hunt.tab === 'naruto-topdown') return false;
  if (hunt.id.startsWith('test-') || hunt.id.startsWith('hunt-teste')) return false;
  return true;
});

const clones = sources.map((hunt, index) => ({
  ...JSON.parse(JSON.stringify(hunt)),
  id: hunt.id.startsWith('wonsr-hunt-')
    ? hunt.id.replace(/^wonsr-hunt-/, 'hunt-td-')
    : `hunt-td-${hunt.id}`,
  tab: 'naruto-topdown',
  mapKey: pickTdMap(hunt.mapKey, index, hunt.targets),
  description: `${hunt.description || 'Caça Naruto.'} (top-down)`,
}));

catalog.hunts.push(...clones);
catalog.counts.hunts = catalog.hunts.length;
catalog.generatedAt = new Date().toISOString();
fs.writeFileSync(HUNTS_FILE, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`Naruto sources ${sources.length} → top-down clones ${clones.length}; total ${catalog.hunts.length}`);
