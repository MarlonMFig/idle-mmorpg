/**
 * Naruto clássico (kid) body — G6_Naruto_Kid MUGEN (NUN5).
 * Preserva jutsus atuais (rasengan / kyuubi / henge) — só idle/walk/combo/hurt/death.
 *
 * Idle: Action 0 (Stand Nueva, 6f)
 * Walk: Action 100 (Correr, group 20)
 * Combo: 200 / 210 / 220
 *
 * Uso: node scripts/process-naruto-classic-g6-body.js
 */
const path = require('path');
const fs = require('fs');
const { packMugenCharacter } = require('./lib/mugen-hq-char');

const ROOT = path.resolve(__dirname, '..');
const CHAR_DIR = path.join(
  process.env.USERPROFILE || '',
  'Downloads',
  'Naruto Shippuden Ultimate Ninja 5 MUGEN',
  'Naruto Shippuden Ultimate Ninja 5 MUGEN',
  'chars',
  'G6_Naruto_Kid',
);

async function main() {
  if (!fs.existsSync(path.join(CHAR_DIR, 'Naruto.sff'))) {
    throw new Error(`G6_Naruto_Kid não encontrado: ${CHAR_DIR}`);
  }

  const wire = await packMugenCharacter({
    id: 'naruto',
    name: 'Uzumaki Naruto (Kid / G6)',
    lookType: 9011,
    charDir: CHAR_DIR,
    sffRel: 'Naruto.sff',
    airRel: 'Naruto.air',
    srcRoot: 'assets/naruto-source/nun5',
    sameRipZoom: true,
    matchWalkHeight: true,
    idleActionId: 0,
    walkActionIds: [100, 20],
    comboActionIds: [200, 210, 220],
    // Dummy — não regenerar jutsus (rasengan/kyuubi/henge ficam).
    specialIds: [99999],
    hurtIds: [5000, 5010, 5030],
    deathIds: [5080, 5110, 5150],
  });

  console.log('DONE naruto G6 body', JSON.stringify(wire, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
