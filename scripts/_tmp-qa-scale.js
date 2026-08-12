/** Temporary: attach HQ-relative QA budgets to already-HQ-wired scaleFrames scripts. */
const fs = require('fs');
const path = require('path');

const WRITE = process.argv.includes('--write');
const files = process.argv.slice(2).filter((a) => a !== '--write');

for (const file of files) {
  const p = path.join(__dirname, file);
  let src = fs.readFileSync(p, 'utf8');
  const notes = [];

  const qaRe = /(\n(\s+)minOpaquePerFrame: \d+,\n)/g;
  const footRe = /(\w+)\.footSpread > (\d+)\)/g;
  const qaCount = (src.match(qaRe) || []).length;
  const footCount = (src.match(footRe) || []).length;

  if (src.includes('areaScale')) {
    console.log(`skip(already)      ${file}`);
    continue;
  }

  src = src.replace(qaRe, (all, whole, indent) => `${whole}${indent}areaScale,\n`);
  src = src.replace(footRe, (all, v, n) => `${v}.footSpread > Math.round(${n} * linear))`);

  const consts =
    (footCount ? '  const linear = hqLinearScale(scaled.contentHeight);\n' : '') +
    (qaCount ? '  const areaScale = hqAreaScale(scaled.contentHeight);\n' : '');
  const scaledRe = /(const scaled = await scaleFrames\([\s\S]*?\n  \);\n)/;
  if (!scaledRe.test(src)) {
    console.log(`FAIL(no scaled)    ${file}`);
    continue;
  }
  src = src.replace(scaledRe, `$1${consts}`);

  const imports = [footCount ? 'hqLinearScale' : null, qaCount ? 'hqAreaScale' : null]
    .filter(Boolean)
    .join(', ');
  const impRe = /\} = require\('\.\/lib\/alpha-frame-pack'\);\n/;
  if (!impRe.test(src)) {
    console.log(`FAIL(no import)    ${file}`);
    continue;
  }
  src = src.replace(
    impRe,
    `} = require('./lib/alpha-frame-pack');\nconst { ${imports} } = require('./lib/strip-hq-scale');\n`,
  );

  notes.push(`qa x${qaCount}`, `foot x${footCount}`);
  if (WRITE) fs.writeFileSync(p, src);
  console.log(`${(WRITE ? 'patched' : 'dry').padEnd(18)} ${file.padEnd(32)} ${notes.join(' ')}`);
}
