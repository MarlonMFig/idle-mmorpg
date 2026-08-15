const path = require('path');
const fs = require('fs');

const CHARS = path.join(
  process.env.USERPROFILE || '',
  'Downloads',
  'JUMP FORCE',
  'Jump Force Mugen V14',
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
    srcRoot: 'assets/jump-force-source',
  };
}

module.exports = { JUMP_FORCE_ROSTER, CHARS, resolveChar };
