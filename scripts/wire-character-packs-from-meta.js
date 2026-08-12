/**
 * Wire character-packs.ts sprite dims from public/sprites/player meta.json files.
 * Updates frameWidth/Height/Count + contentHeight (+ originX when present).
 * Preserves hitDelayMs/durationMs/frameRate/urls/keys unless meta has newer timing.
 *
 *   node scripts/wire-character-packs-from-meta.js
 *   node scripts/wire-character-packs-from-meta.js --write
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PACKS_TS = path.join(ROOT, 'src', 'data', 'character-packs.ts');
const PLAYER = path.join(ROOT, 'public', 'sprites', 'player');
const WRITE = process.argv.includes('--write');

function loadAllMeta() {
  /** @type {Map<string, any>} */
  const byKey = new Map();
  for (const id of fs.readdirSync(PLAYER)) {
    const metaPath = path.join(PLAYER, id, 'meta.json');
    if (!fs.existsSync(metaPath)) continue;
    let meta;
    try {
      meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    } catch {
      continue;
    }
    for (const [key, entry] of Object.entries(meta)) {
      if (entry && typeof entry.frameWidth === 'number') {
        byKey.set(key, entry);
      }
    }
  }
  return byKey;
}

function patchBlock(src, key, entry) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const keyRe = new RegExp(
    `(key:\\s*'${escaped}',)([\\s\\S]*?)(contentHeight:\\s*)(\\d+)`,
  );
  if (!keyRe.test(src)) return { src, changed: false, reason: 'key-not-found' };

  let changed = false;
  const next = src.replace(keyRe, (full, keyLine, mid, chLabel, oldCh) => {
    let body = mid;
    const replaceNum = (field, value) => {
      if (typeof value !== 'number' || !Number.isFinite(value)) return;
      const re = new RegExp(`(${field}:\\s*)(\\d+(?:\\.\\d+)?)`);
      if (re.test(body)) {
        const prev = body.match(re);
        if (prev && Number(prev[2]) !== value) {
          body = body.replace(re, `$1${value}`);
          changed = true;
        }
      }
    };
    replaceNum('frameWidth', entry.frameWidth);
    replaceNum('frameHeight', entry.frameHeight);
    replaceNum('frameCount', entry.frameCount);
    if (typeof entry.originX === 'number') {
      replaceNum('originX', Number(entry.originX.toFixed(3)));
    }
    replaceNum('durationMs', entry.durationMs);
    replaceNum('hitDelayMs', entry.hitDelayMs);
    replaceNum('frameRate', entry.frameRate);

    const newCh = entry.contentHeight;
    if (Number(oldCh) !== newCh) changed = true;
    return `${keyLine}${body}${chLabel}${newCh}`;
  });

  return { src: next, changed, reason: changed ? 'updated' : 'same' };
}

function main() {
  const meta = loadAllMeta();
  let src = fs.readFileSync(PACKS_TS, 'utf8');
  const report = [];
  let updates = 0;

  for (const [key, entry] of [...meta.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const r = patchBlock(src, key, entry);
    if (r.changed) {
      src = r.src;
      updates += 1;
      report.push(
        `UPD ${key} → ${entry.frameWidth}x${entry.frameHeight} n=${entry.frameCount} ch=${entry.contentHeight}`,
      );
    }
  }

  console.log(report.join('\n'));
  console.log(`\n${updates} sheet defs would update (${meta.size} meta keys)`);
  if (WRITE) {
    fs.writeFileSync(PACKS_TS, src);
    console.log(`Wrote ${PACKS_TS}`);
  } else {
    console.log('Re-run with --write to apply.');
  }
}

main();
