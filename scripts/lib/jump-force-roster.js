const path = require('path');
const fs = require('fs');

const CHARS = path.join(
  process.env.USERPROFILE || '',
  'Downloads',
  'JUMP FORCE',
  'Jump Force Mugen V14',
  'chars',
);

const NUN5_CHARS = path.join(
  process.env.USERPROFILE || '',
  'Downloads',
  'Naruto Shippuden Ultimate Ninja 5 MUGEN',
  'Naruto Shippuden Ultimate Ninja 5 MUGEN',
  'chars',
);

const MUGEN_ACADEMY_CHARS = path.join(
  process.env.USERPROFILE || '',
  'Downloads',
  'MUGEN ACADEMY',
  'Mugen Academy V7 (IKEMEN)',
  'chars',
);

/** lookType 9073+ (9072 Kenshin curated). */
const JUMP_FORCE_ROSTER = [
  {
    id: 'ichigo',
    dir: 'Ichigo',
    name: 'Ichigo Kurosaki',
    lookType: 9073,
    sffRel: 'Ichigo.sff',
    airRel: 'Ichigo.air',
    comboActionIds: [200, 210, 300],
    specialIds: [1400, 1200, 1300, 1500],
    // Rip consistente: o idle mede 51px e a corrida curvada 44px, e a ação 210
    // tem um frame de salto de 80px. Igualar altura de corpo inflaria o walk em
    // 1,16× e encolheria o combo 2 para 0,64×.
    sameRipZoom: true,
    // Todo o VFX do Ichigo é desenhado com trans=A (additive) no MUGEN.
    fxAdditive: true,
    // O scan automático (specialId+1..99) pega paletas trocadas do mesmo
    // efeito (1550 azul + 1551 branco), então cada skill aponta o grupo SFF.
    specialFxIds: { 1400: [], 1200: [], 1300: [], 1500: [] },
    specialFxGroups: {
      1400: [420], // Getsuga Tenshou — arco crescente prateado
      1200: [{ group: 7357, to: 12 }], // Crescend Getsuga — lâmina de reiatsu azul
      1300: [{ group: 3010, to: 18 }], // Giratory Sword — rastros de corte (18+ é outra paleta)
      1500: [{ group: 1002, to: 16 }], // Reiatsu Explosion — esfera de reiatsu azul
    },
    hurtIds: [5000, 5001],
    deathIds: [5080, 5110],
  },
  {
    id: 'konohamaru',
    dir: 'konohamaru',
    name: 'Konohamaru Sarutobi',
    lookType: 9074,
    charRoot: NUN5_CHARS,
    // O par `konohamaru.sff/.air` é um helper monocromático. O DEF jogável
    // usa `blank.sff/.air`, que contém o corpo colorido completo.
    sffRel: 'blank.sff',
    airRel: 'blank.air',
    sameRipZoom: true,
    // Rip mínimo: só existem três golpes (200/210/230). Os jutsus reaproveitam
    // esses golpes com timings distintos porque não há mais nada no SFF.
    comboActionIds: [200, 210, 230],
    specialIds: [210, 230, 195, 100],
    hurtIds: [5000, 5010, 5030],
    deathIds: [5120, 5110, 5150],
  },
  {
    id: 'kiba-kid',
    dir: 'Kiba_Kid',
    name: 'Kiba Inuzuka (Kid)',
    lookType: 9075,
    charRoot: NUN5_CHARS,
    sffRel: 'gzkiba.sff',
    airRel: 'gzkiba.air',
    sameRipZoom: true,
    comboActionIds: [200, 210, 220],
    // Corpo: golpes do Kiba (não Akamaru). FX: Tsuuga / Getsuuga / Garouga / soco.
    specialIds: [210, 220, 300, 440],
    specialFxIds: { 210: [900], 220: [914], 300: [931], 440: [260] },
    hurtIds: [5000, 5010, 5030],
    deathIds: [5120, 5110, 5150],
  },
  {
    id: 'sasori-puppet',
    dir: 'Sasori Puppet',
    name: 'Sasori (Hiruko)',
    lookType: 9076,
    charRoot: NUN5_CHARS,
    sffRel: 'Sasori.sff',
    airRel: 'Sasori.air',
    sameRipZoom: true,
    idleActionId: 2000,
    walkActionIds: [2020, 2021],
    comboActionIds: [2200, 2210, 2220],
    specialIds: [2400, 2500, 2550, 2300],
    specialFxIds: { 2400: [305], 2500: [2505], 2550: [3100], 2300: [426] },
    // Hurt/death precisam continuar na forma Hiruko; a série 5000 é o corpo humano.
    hurtIds: [2010, 2012],
    deathIds: [2047, 2010],
  },
  {
    id: 'chiyo',
    dir: 'chiyo-son',
    name: 'Chiyo',
    lookType: 9077,
    charRoot: NUN5_CHARS,
    sffRel: 'chiyo.sff',
    airRel: 'chiyo.air',
    sameRipZoom: true,
    comboActionIds: [200, 240, 250],
    specialIds: [210, 220, 410, 420],
    specialFxIds: { 210: [984], 220: [978], 410: [998], 420: [990] },
    hurtIds: [5000, 5010, 5030],
    deathIds: [5120, 5110, 5150],
  },
  {
    id: 'haku',
    dir: 'G6_Haku',
    name: 'Haku',
    lookType: 9078,
    charRoot: NUN5_CHARS,
    sffRel: 'Haku.sff',
    airRel: 'Haku.air',
    sameRipZoom: true,
    comboActionIds: [200, 210, 220],
    specialIds: [1200, 1052, 1502, 1503],
    specialFxIds: { 1200: [1310, 1303], 1052: [1550], 1502: [3250], 1503: [1455] },
    hurtIds: [5000, 5010, 5030],
    deathIds: [5040, 5080, 5110],
  },
  {
    id: 'hiruzen',
    dir: 'G6_Hiruzen',
    name: 'Hiruzen Sarutobi',
    lookType: 9079,
    charRoot: NUN5_CHARS,
    sffRel: 'Hiruzen.sff',
    airRel: 'Hiruzen.air',
    sameRipZoom: true,
    comboActionIds: [200, 210, 220],
    specialIds: [1000, 1400, 1500, 3000],
    specialFxIds: { 1000: [1010, 1050], 1400: [1450], 1500: [3009], 3000: [3050] },
    hurtIds: [5000, 5010, 5030],
    deathIds: [5040, 5080, 5110],
  },
  {
    id: 'asuma',
    dir: 'G6_Asuma',
    name: 'Asuma Sarutobi',
    lookType: 9080,
    charRoot: NUN5_CHARS,
    sffRel: 'Asuma.sff',
    airRel: 'Asuma.air',
    sameRipZoom: true,
    comboActionIds: [200, 210, 400],
    specialIds: [1200, 1300, 1400, 1100],
    specialFxIds: { 1200: [1250], 1300: [1203], 1400: [1051, 1052], 1100: [1150] },
    hurtIds: [5000, 5010, 5030],
    deathIds: [5040, 5080, 5110],
  },
  {
    id: 'zabuza',
    dir: 'G6_Zabuza',
    name: 'Zabuza Momochi',
    lookType: 9081,
    charRoot: NUN5_CHARS,
    sffRel: 'Zabuza.sff',
    airRel: 'Zabuza.air',
    sameRipZoom: true,
    comboActionIds: [200, 210, 220],
    specialIds: [1100, 1200, 1400, 3100],
    specialFxIds: { 1100: [1050], 1200: [1260], 1400: [3051], 3100: [3250] },
    hurtIds: [5000, 5010, 5030],
    deathIds: [5040, 5080, 5110],
  },
  {
    id: 'sakon',
    dir: 'sakon',
    name: 'Sakon e Ukon',
    lookType: 9082,
    charRoot: NUN5_CHARS,
    sffRel: 'sakon.sff',
    airRel: 'sakon.air',
    sameRipZoom: true,
    comboActionIds: [200, 201, 202],
    // Rip quase não tem VFX separado — só o Rashomon (3001) é FX puro.
    // Os outros jutsus usam o próprio corpo animado (sem FX overlay).
    specialIds: [2001, 252, 3101, 220],
    specialFxIds: { 2001: [3001], 252: [], 3101: [], 220: [] },
    hurtIds: [5000, 5010, 5030],
    deathIds: [5040, 5080, 5110],
  },
  {
    id: 'gohan',
    dir: 'Gohan',
    name: 'Gohan (Adulto)',
    lookType: 9083,
    charRoot: MUGEN_ACADEMY_CHARS,
    srcRoot: 'assets/dragon-ball-source/academy',
    sffRel: '=/spr.sff',
    airRel: '=/anim.air',
    sameRipZoom: true,
    comboActionIds: [200, 201, 202],
    specialIds: [1100, 1200, 1401, 1500],
    specialFxIds: {
      1100: [1130, 1160],
      1200: [1215],
      1401: [1430, 1440, 1460],
      1500: [1515, 1520, 1521, 1522, 1530],
    },
    // O SFF guarda estes golpes em tons neutros; o MUGEN os colore via PalFX.
    specialFxPalFx: {
      1100: { color: 0, add: [-70, 20, 105] },
      1200: { color: 0, add: [-70, 20, 105] },
      1401: { color: 0, add: [-70, 20, 105] },
      1500: { color: 0, add: [-70, 20, 105] },
    },
    hurtIds: [5000, 5010, 5030],
    deathIds: [5040, 5080, 5110],
  },
  {
    id: 'bardock',
    dir: 'Bardock',
    name: 'Bardock',
    lookType: 9084,
    charRoot: MUGEN_ACADEMY_CHARS,
    srcRoot: 'assets/dragon-ball-source/academy',
    sffRel: '=/spr.sff',
    airRel: '=/anim.air',
    sameRipZoom: true,
    comboActionIds: [200, 201, 202],
    specialIds: [1000, 1200, 1300, 1500],
    specialFxIds: {
      1000: [1005, 1006, 1007, 1010],
      1200: [1205],
      1300: [1320, 1325],
      1500: [1502, 1503, 1504, 1505, 1507],
    },
    specialFxPalFx: {
      1000: { color: 0, add: [-55, 10, 80] },
      1200: { color: 0, add: [-55, 10, 80] },
      1300: { color: 0, add: [-55, 10, 80] },
      1500: { color: 0, add: [-55, 10, 80] },
    },
    hurtIds: [5000, 5010, 5030],
    deathIds: [5040, 5080, 5110],
  },
  {
    id: 'beerus',
    dir: 'Beerus',
    name: 'Beerus',
    lookType: 9085,
    charRoot: MUGEN_ACADEMY_CHARS,
    srcRoot: 'assets/dragon-ball-source/academy',
    sffRel: '=/spr.sff',
    airRel: '=/anim.air',
    sameRipZoom: true,
    comboActionIds: [200, 210, 240],
    specialIds: [1000, 1400, 1500, 1600],
    specialFxIds: {
      1000: [1016],
      1400: [1420, 1455, 1467],
      1500: [1520, 1555],
      1600: [1615, 1625],
    },
    hurtIds: [5000, 5010, 5030],
    deathIds: [5040, 5080, 5110],
  },
  {
    id: 'broly',
    dir: 'Broly',
    name: 'Broly',
    lookType: 9086,
    charRoot: MUGEN_ACADEMY_CHARS,
    srcRoot: 'assets/dragon-ball-source/academy',
    sffRel: '=/spr.sff',
    airRel: '=/anim.air',
    sameRipZoom: true,
    comboActionIds: [200, 210, 220],
    specialIds: [1000, 1100, 1200, 1400],
    specialFxIds: {
      1000: [1020],
      1100: [1120, 1125, 1130, 1150, 1160],
      1200: [1230, 1240],
      1400: [1430, 1440, 1441, 1445],
    },
    hurtIds: [5000, 5010, 5030],
    deathIds: [5040, 5080, 5110],
  },
  {
    id: 'pain',
    dir: 'Pain',
    name: 'Pain (Deva)',
    lookType: 9087,
    charRoot: MUGEN_ACADEMY_CHARS,
    srcRoot: 'assets/naruto-source/academy',
    sffRel: '=/spr.sff',
    airRel: '=/anim.air',
    sameRipZoom: true,
    matchWalkHeight: true,
    comboActionIds: [200, 210, 220],
    specialIds: [1000, 1400, 1550, 3000],
    specialFxIds: {
      1000: [1062, 1070],
      1400: [1450, 1460],
      1550: [1556, 1570],
      3000: [3050, 3060],
    },
    hurtIds: [5000, 5010, 5030],
    deathIds: [5040, 5080, 5110],
  },
  {
    id: 'choji-jf',
    dir: 'Choji',
    name: 'Akimichi Choji (Jump Force)',
    lookType: 9088,
    sffRel: 'Choji.sff',
    airRel: 'Choji.air',
    sameRipZoom: true,
    matchWalkHeight: true,
    comboActionIds: [200, 210, 300],
    specialIds: [1000, 1200, 1300, 1500],
    specialFxIds: {
      1000: [1050],
      1200: [1250],
      1300: [],
      1500: [315],
    },
    hurtIds: [5000, 5010, 5030],
    deathIds: [5110, 5120, 5150],
  },
  {
    id: 'haku-jf',
    dir: 'G6_Haku',
    name: 'Haku (Jump Force)',
    lookType: 9089,
    sffRel: 'Haku.sff',
    airRel: 'Haku.air',
    sameRipZoom: true,
    matchWalkHeight: true,
    comboActionIds: [200, 210, 220],
    specialIds: [1000, 1200, 3000, 1450],
    specialFxIds: {
      1000: [1160],
      1200: [],
      3000: [1310],
      1450: [1455],
    },
    hurtIds: [5000, 5010, 5030],
    deathIds: [5110, 5120, 5150],
  },
  {
    id: 'danzo',
    dir: 'G6_Danzo',
    name: 'Danzo Shimura',
    lookType: 9090,
    sffRel: 'Danzo.sff',
    airRel: 'Danzo.air',
    sameRipZoom: true,
    matchWalkHeight: true,
    comboActionIds: [200, 210, 220],
    specialIds: [1000, 1100, 1200, 1400],
    specialFxIds: {
      1000: [1050],
      1100: [1150, 1151],
      1200: [1260, 1270],
      1400: [1510],
    },
    hurtIds: [5000, 5010, 5030],
    deathIds: [5110, 5120, 5150],
  },
];

function resolveChar(row) {
  const charDir = path.join(row.charRoot || CHARS, row.dir);
  let sffRel = row.sffRel;
  let airRel = row.airRel;
  if (!sffRel || !airRel) {
    const files = fs.existsSync(charDir) ? fs.readdirSync(charDir) : [];
    sffRel = sffRel || files.find((f) => f.toLowerCase().endsWith('.sff'));
    airRel = airRel || files.find((f) => f.toLowerCase().endsWith('.air'));
  }
  return {
    ...row,
    charDir,
    sffRel,
    airRel,
    srcRoot:
      row.srcRoot ||
      (row.charRoot ? 'assets/naruto-source/nun5' : 'assets/jump-force-source'),
  };
}

module.exports = { JUMP_FORCE_ROSTER, CHARS, resolveChar };
