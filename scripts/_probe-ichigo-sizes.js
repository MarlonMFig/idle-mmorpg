const fs = require('fs');
const path = require('path');
const { openAnySff } = require('./lib/sff-open');

const dir = path.join(
  process.env.USERPROFILE || '',
  'Downloads',
  'JUMP FORCE',
  'Jump Force Mugen V14',
  'chars',
  'Ichigo',
);

async function main() {
  const sff = openAnySff(path.join(dir, 'Ichigo.sff'));
  const groups = [0, 20, 200, 5000, 5040, 1260, 3010, 1550, 1551, 1552, 1002, 300, 7054, 7200, 7357, 7006, 412, 402, 420, 405, 1056, 1059];
  for (const g of groups) {
    const rows = [];
    for (let n = 0; n < 8; n += 1) {
      const spr = await sff.tryGet(g, n);
      if (!spr) continue;
      rows.push(`${g},${n} ${spr.width}x${spr.height} ax=${spr.axisX ?? '?'} ay=${spr.axisY ?? '?'}`);
    }
    console.log(rows.length ? rows.join(' | ') : `group ${g}: none`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
