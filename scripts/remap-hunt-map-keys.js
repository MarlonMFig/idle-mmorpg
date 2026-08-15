/**
 * Remapeia mapKeys das caças reais (mantém hunts de teste vale).
 * node scripts/remap-hunt-map-keys.js
 */
const fs = require('fs');
const path = require('path');

const HUNTS_FILE = path.join(__dirname, '..', 'public', 'data', 'wonsr', 'hunts.json');

const HUNT_ARENA_KEYS = [
  'huntCampoTreinamento',
  'huntArenaExameChunin',
  'huntArenaExameChunnin',
  'huntPontePaisOnda',
  'huntValeDoFim',
  'huntPaisDoVento',
  'huntEsconderijoAkatsuki',
  'huntLabOrochimaru',
  'huntKonohaDestruida',
  'huntMonteMyoboku',
  'huntDistritoUchiha',
  'huntCampoGuerraNinja',
  'huntForestClearing',
  'huntNamekusei',
  'huntTorneioArtesMarciais',
  'huntSalaDoTempo',
  'huntDesertoSaiyajin',
];

function pickHuntMapKey(index, targets) {
  const id = `${targets[0]?.id || ''} ${targets[0]?.name || ''}`.toLowerCase();
  if (/gaara|vento|temari|kankuro/.test(id)) return 'huntPaisDoVento';
  if (/zabuza|onda|haku|ponte/.test(id)) return 'huntPontePaisOnda';
  if (/pain|pein|konan|nagato/.test(id)) return 'huntKonohaDestruida';
  if (/orochimaru|kabuto|lab/.test(id)) return 'huntLabOrochimaru';
  if (/kisame|deidara|sasori|hidan|kakuzu|akatsuki/.test(id)) {
    return 'huntEsconderijoAkatsuki';
  }
  if (/jiraiya|sennin|myoboku|fukasaku|shima|gama|sapo/.test(id)) {
    return 'huntMonteMyoboku';
  }
  if (/sasuke|itachi|obito|uchiha|shisui/.test(id)) return 'huntDistritoUchiha';
  if (/madara|hashirama|vale/.test(id)) return 'huntValeDoFim';
  if (/naruto/.test(id)) return 'huntValeDoFim';
  if (/neji|rock.?lee|guy|chouji|\bino\b|shikamaru|tenten|exame|chunin|chunnin/.test(id)) {
    return 'huntArenaExameChunin';
  }
  if (/sakura|hinata|kakashi|iruka|treino|konohamaru|tsunade/.test(id)) {
    return 'huntCampoTreinamento';
  }
  if (/kimimaro|jiroubou|jirobo|tayuya|sakon|kidomaru|otogakure/.test(id)) {
    return 'huntLabOrochimaru';
  }
  if (/kiba|shino|floresta|morte|death.?forest/.test(id)) return 'huntForestClearing';
  if (/guerra|war|shinobi.?war|danzo/.test(id)) return 'huntCampoGuerraNinja';
  if (/ferro|samurai|kenshin|himura/.test(id)) return 'huntArenaExameChunnin';
  if (/freeza|frieza|piccolo|namek/.test(id)) return 'huntNamekusei';
  if (/vegeta|saiyan|nappa|raditz|broly|deserto|cell|jogos|goku/.test(id)) {
    return 'huntDesertoSaiyajin';
  }
  if (/gotenks|torneio|tenkaichi/.test(id)) return 'huntTorneioArtesMarciais';
  if (/majin|boo|buu|sala/.test(id)) return 'huntSalaDoTempo';
  if (
    /asta|black.?clover|mereoleona|vanica|zenon|noelle|yuno|yami|julius|langris|gauche|zagred|dorothy|gordon|zora|luck|william|kaiser|fana|reve/.test(
      id,
    )
  ) {
    return 'huntCampoGuerraNinja';
  }
  if (/luffy|one.?piece|pirate/.test(id)) return 'huntPontePaisOnda';
  if (/gojo|itadori|yuji|agito|mahito|maki|sukuna|toji|jujutsu|zenin/.test(id)) {
    return 'huntForestClearing';
  }
  if (/hitsugaya|hinamori|bleach|ichigo/.test(id)) return 'huntArenaExameChunnin';
  return HUNT_ARENA_KEYS[index % HUNT_ARENA_KEYS.length];
}

const catalog = JSON.parse(fs.readFileSync(HUNTS_FILE, 'utf8'));

let realIndex = 0;
const changes = [];
for (const hunt of catalog.hunts) {
  if (hunt.id.startsWith('test-')) continue;
  const next = pickHuntMapKey(realIndex, hunt.targets);
  if (hunt.mapKey !== next) {
    changes.push(`${hunt.id}: ${hunt.mapKey} -> ${next} (${hunt.targets[0]?.name})`);
    hunt.mapKey = next;
  }
  realIndex += 1;
}

catalog.counts.hunts = catalog.hunts.length;
catalog.generatedAt = new Date().toISOString();
fs.writeFileSync(HUNTS_FILE, JSON.stringify(catalog, null, 2) + '\n');

const by = {};
for (const h of catalog.hunts) {
  by[h.mapKey] = (by[h.mapKey] || 0) + 1;
}
console.log('Remap changes', changes.length);
console.log(changes.join('\n'));
console.log('Counts', by);
