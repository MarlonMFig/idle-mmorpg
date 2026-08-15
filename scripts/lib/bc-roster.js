const path = require('path');

const CHARS = path.join(
  process.env.USERPROFILE || '',
  'Downloads',
  'Black Clover Mugen V8 (DirectX)',
  'Black Clover Mugen V8 (DirectX)',
  'chars',
);

/** lookType 9039+ (9037 Asta Time Skip, 9038 Luffy already taken). */
const BC_ROSTER = [
  {
    id: 'mereoleona',
    dir: 'Mereoleona',
    name: 'Mereoleona',
    lookType: 9039,
    // Só skill 1–2 (fogo à distância). Skill 2 Explods fora do heuristic specialId+100.
    omitSkillIndexes: [2, 3],
    specialFxIds: { 2000: [7800, 7017, 3220] },
  },
  { id: 'vanica', dir: 'Vanica', name: 'Vanica', lookType: 9040 },
  {
    id: 'zenon',
    dir: 'Zenon',
    name: 'Zenon',
    lookType: 9041,
    sffRel: path.join('.src', 'spr.sff'),
    airRel: path.join('.src', 'anim.air'),
  },
  { id: 'reve', dir: 'Reve', name: 'Reve', lookType: 9042 },
  { id: 'yuno-spirit-dive', dir: 'Yuno Spirit Dive', name: 'Yuno Spirit Dive', lookType: 9044 },
  {
    id: 'yuno-royal-knight',
    dir: 'Yuno_Royal_Knight',
    name: 'Yuno Royal Knight',
    lookType: 9045,
    omitSkillIndexes: [0, 2],
  },
  {
    id: 'yuno-spirit-sword',
    dir: 'Yuno (Spirit Dive) sword',
    name: 'Yuno Spirit Sword',
    lookType: 9046,
    sffRel: 'alt.sff',
    airRel: 'Yuno_Black_Clover.air',
  },
  { id: 'gordon', dir: 'Gordon', name: 'Gordon', lookType: 9047 },
  { id: 'rakugeki-yuno', dir: 'Rakugeki Yuno', name: 'Rakugeki Yuno', lookType: 9048 },
  { id: 'black-asta', dir: 'Black Asta', name: 'Black Asta', lookType: 9049 },
  { id: 'zora', dir: 'Zora', name: 'Zora', lookType: 9050 },
  {
    id: 'zagred',
    dir: 'Zagred',
    name: 'Zagred',
    lookType: 9051,
    sffRel: 'Sprite.sff',
    airRel: 'Anim.air',
  },
  {
    id: 'yami',
    dir: 'Yami Sukehiro',
    name: 'Yami Sukehiro',
    lookType: 9052,
    sffRel: 'Yami.sff',
    airRel: 'Yami.air',
  },
  { id: 'william', dir: 'William Vangeance', name: 'William Vangeance', lookType: 9053 },
  { id: 'luck', dir: 'Luck Voltia', name: 'Luck Voltia', lookType: 9054 },
  {
    id: 'langris',
    dir: 'Langris Vaude',
    name: 'Langris Vaude',
    lookType: 9055,
    sffRel: 'Langris.sff',
    airRel: 'Langris.air',
  },
  { id: 'kaiser', dir: 'Kaiser', name: 'Kaiser', lookType: 9056 },
  { id: 'julius', dir: 'Julius Novachrono', name: 'Julius Novachrono', lookType: 9057 },
  { id: 'gauche', dir: 'Gauche', name: 'Gauche', lookType: 9058 },
  { id: 'fana', dir: 'Fana', name: 'Fana', lookType: 9059 },
  {
    id: 'noelle-e99',
    dir: 'E99_Noelle',
    name: 'Noelle (Valkyrie)',
    lookType: 9060,
    sffRel: 'Noelle.sff',
    airRel: 'Noelle.air',
    omitSkillIndexes: [0, 1],
  },
  { id: 'dorothy', dir: 'Dorothy', name: 'Dorothy', lookType: 9061 },
  {
    id: 'asta-demon',
    dir: 'Asta Demon',
    name: 'Asta Demon',
    lookType: 9063,
    omitSkillIndexes: [0, 3],
  },
  { id: 'asta-base', dir: 'Asta', name: 'Asta Classic', lookType: 9064 },
];

function resolveChar(row) {
  const charDir = path.join(CHARS, row.dir);
  let sffRel = row.sffRel;
  let airRel = row.airRel;
  if (!sffRel || !airRel) {
    const files = fsExists(charDir) ? require('fs').readdirSync(charDir) : [];
    sffRel = sffRel || files.find((f) => f.toLowerCase().endsWith('.sff'));
    airRel = airRel || files.find((f) => f.toLowerCase().endsWith('.air'));
  }
  return { ...row, charDir, sffRel, airRel };
}

function fsExists(p) {
  try {
    return require('fs').existsSync(p);
  } catch {
    return false;
  }
}

module.exports = { BC_ROSTER, CHARS, resolveChar };
