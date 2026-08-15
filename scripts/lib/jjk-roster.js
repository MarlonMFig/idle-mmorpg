const path = require('path');
const fs = require('fs');

const CHARS = path.join(
  process.env.USERPROFILE || '',
  'Downloads',
  'juegosdemugen.com JUJUTSU KAISEN BATTLE OF CURSES MUGEN (DirectX)',
  'JUJUTSU KAISEN BATTLE OF CURSES MUGEN (DirectX)',
  'chars',
);

/** lookType 9065+ (9064 Asta Classic). */
const JJK_ROSTER = [
  {
    id: 'gojo',
    dir: 'Gojo',
    name: 'Gojo Satoru',
    lookType: 9065,
    sffRel: 'Satoru.sff',
    airRel: 'Satoru.air',
    comboActionIds: [210, 300, 400],
    specialIds: [1111, 410, 580, 1680],
    specialFxIds: { 1111: [1153] },
    hurtIds: [5001],
    deathIds: [5080],
  },
  {
    id: 'itadori',
    dir: 'itadori',
    name: 'Yuji Itadori',
    lookType: 9066,
    sffRel: 'Itadori.sff',
    airRel: 'Itadori.air',
    comboActionIds: [200, 210, 230],
    specialIds: [1000, 1200, 1300, 1400],
    omitSkillIndexes: [0, 1],
    // AIR aponta grupos 1005/7081/etc. que não estão no SFF; 7000/7005 são o VFX nativo.
    specialFxGroups: {
      1000: [7000],
      1200: [7005],
      1300: [7000],
      1400: [7005],
    },
    deathIds: [5080],
  },
  {
    id: 'agito',
    dir: 'Agito',
    name: 'Agito',
    lookType: 9067,
    sffRel: 'sff.sff',
    airRel: 'air.air',
    comboActionIds: [200, 210, 220],
    specialIds: [1000, 1100, 1300, 1301],
    specialFxIds: { 1000: [1050], 1100: [1150], 1300: [1350], 1301: [1060] },
    deathIds: [5080],
  },
  {
    id: 'mahito',
    dir: 'Mahito',
    name: 'Mahito',
    lookType: 9068,
    sffRel: 'Mahito.sff',
    airRel: 'Mahito.air',
    comboActionIds: [200, 210, 230],
    specialIds: [400, 410, 1200, 3000],
    specialFxIds: { 400: [], 410: [], 1200: [], 3000: [] },
    specialFxGroups: {
      400: [7000],
      410: [7002],
      1200: [7005],
      3000: [3012],
    },
    hurtIds: [5000, 5001],
    deathIds: [5080],
  },
  {
    id: 'maki',
    dir: 'Maki',
    name: 'Maki Zenin',
    lookType: 9069,
    sffRel: 'Maki.sff',
    airRel: 'Maki.air',
    comboActionIds: [230, 240, 250],
    specialIds: [1000, 1500, 2000, 3000],
    specialFxIds: { 1000: [], 1500: [], 2000: [], 3000: [] },
    specialFxGroups: {
      1000: [6400],
      1500: [6200],
      2000: [6500],
      3000: [6250],
    },
    hurtIds: [5000, 5001],
    deathIds: [5110, 5080],
  },
  {
    id: 'sukuna',
    dir: 'Sukuna',
    name: 'Ryomen Sukuna',
    lookType: 9070,
    sffRel: path.join('=', 'spr.sff'),
    airRel: path.join('=', 'anim.air'),
    comboActionIds: [200, 300, 400],
    specialIds: [1000, 1100, 1200, 1400],
    specialFxIds: { 1000: [1090], 1100: [1120], 1200: [1211], 1400: [1090] },
    hurtIds: [5000, 5001],
    deathIds: [5080],
  },
  {
    id: 'toji',
    dir: 'Toji Fushiguro',
    name: 'Toji Fushiguro',
    lookType: 9071,
    sffRel: 'Toji Fushiguro.sff',
    airRel: 'Toji Fushiguro.air',
    comboActionIds: [200, 210, 220],
    specialIds: [1000, 1100, 1400, 1500],
    omitSkillIndexes: [1],
    specialFxIds: { 1000: [], 1100: [], 1400: [], 1500: [] },
    specialFxGroups: {
      1000: [1007, 1053],
      1100: [1010],
      1400: [1400],
      1500: [7005],
    },
    // Combo hits usam o hit-spark global (SkillVfx), não AfterFX do Mugen.
    hurtIds: [5001, 5000],
    deathIds: [5110, 5080],
  },
];

function resolveChar(row) {
  const charDir = path.join(CHARS, row.dir);
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
    srcRoot: 'assets/jujutsu-kaisen-source',
  };
}

module.exports = { JJK_ROSTER, CHARS, resolveChar };
