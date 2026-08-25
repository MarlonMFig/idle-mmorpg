const fs = require('fs');
const path = require('path');

function patch(rel, from, to) {
  const file = path.join(__dirname, '..', rel);
  const text = fs.readFileSync(file, 'utf8');
  if (!text.includes(from)) {
    console.log('MISS', rel);
    return;
  }
  fs.writeFileSync(file, text.replace(from, to));
  console.log('OK', rel);
}

patch(
  'src/game/scenes/game-scene.ts',
  'else if (!isCharacterLabSession()) this.idleAi?.update();\n    if (!isCharacterLabSession()) this.teamCompanions?.update(time);',
  'else if (!isLabBlockingHuntGameplay()) this.idleAi?.update();\n    if (!isLabBlockingHuntGameplay()) this.teamCompanions?.update(time);',
);
patch(
  'src/systems/idle-ai-system.ts',
  "import { isCharacterLabSession } from '@/stores/character-lab-store';",
  "import { isLabBlockingHuntGameplay } from '@/stores/character-lab-store';",
);
patch(
  'src/constants/combat.ts',
  'xp: stats?.xp ?? target.xp,',
  'xp: target.xp,',
);
