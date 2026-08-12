/**
 * Codemod: enable HQ native scale on strip/sheet process-*.js scripts
 * that still hardcode TARGET_BODY_H = 48 and scale = TARGET/contentH.
 *
 *   node scripts/codemod-strip-hq.js
 *   node scripts/codemod-strip-hq.js --write
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SCRIPTS = path.join(ROOT, 'scripts');
const WRITE = process.argv.includes('--write');

const SKIP = new Set([
  'process-chouji-idle.js',
  'process-chouji-walk.js',
  'process-chouji-combo.js',
  'process-chouji-jutsu.js',
  'process-freeza-all.js',
  'process-majin-boo-all.js',
  'process-piccolo-all.js',
  'process-gotenks-all.js',
  'process-goku-all.js',
  'process-batch-6-packs.js',
  'process-batch-6b-packs.js',
  'process-deidara-reslice.js',
  'codemod-strip-hq.js',
]);

const REQUIRE_LINE =
  "const { resolveHqScale, resolvePackContentHeight, NATIVE_PIXELS } = require('./lib/strip-hq-scale');\n";

function guessIdleKey(fileName, src) {
  const out = src.match(/player['"`),\s]+['"`]([a-z0-9-]+)['"`]/);
  if (out) return `${out[1]}-idle`;
  const m = fileName.match(/^process-([a-z0-9-]+)-(idle|walk|combo|jutsu|damage|hurt)/);
  if (m) return `${m[1]}-idle`;
  const m2 = fileName.match(/^process-([a-z0-9-]+)-all/);
  if (m2) return `${m2[1]}-idle`;
  return null;
}

function guessMode(fileName) {
  if (/-idle/.test(fileName)) return 'idle';
  return 'match';
}

function optsLiteral(mode, idleKey) {
  return mode === 'idle'
    ? `{ mode: 'idle' }`
    : `{ mode: 'match', metaPath: META_JSON, idleKey: '${idleKey}' }`;
}

function patchFile(fileName) {
  if (SKIP.has(fileName)) return { fileName, status: 'skip' };
  const filePath = path.join(SCRIPTS, fileName);
  let src = fs.readFileSync(filePath, 'utf8');
  if (!src.includes('TARGET_BODY_H')) return { fileName, status: 'no-target' };
  if (src.includes('strip-hq-scale') || src.includes('chouji-hq-scale')) {
    return { fileName, status: 'already' };
  }
  if (
    !/TARGET_BODY_H\s*\/\s*Math\.max\(\s*1\s*,\s*contentHeight\s*\)/.test(src) &&
    !/TARGET_BODY_H\s*\/\s*Math\.max\(\s*1\s*,\s*contentH0\s*\)/.test(src)
  ) {
    return { fileName, status: 'custom-scale' };
  }

  const idleKey = guessIdleKey(fileName, src);
  const mode = guessMode(fileName);
  if (!idleKey) return { fileName, status: 'no-idle-key' };
  const scaleOpts = optsLiteral(mode, idleKey);

  if (!src.includes("require('./lib/strip-hq-scale')")) {
    const insertAfter = src.match(
      /require\('\.\/lib\/[^']+'\);\n(?:const \{[^}]+\} = require\('\.\/lib\/[^']+'\);\n)*/,
    );
    if (insertAfter) {
      const idx = insertAfter.index + insertAfter[0].length;
      src = src.slice(0, idx) + REQUIRE_LINE + src.slice(idx);
    } else {
      src = src.replace(/(const sharp = require\('sharp'\);\n)/, `$1${REQUIRE_LINE}`);
    }
  }

  const replacement = `async function scaleFrames(frames, cellW, cellH, contentHeight, scaleOpts = ${scaleOpts}) {
  const scale = resolveHqScale(contentHeight, scaleOpts);
  const outW = Math.max(1, Math.round(cellW * scale));
  const outH = Math.max(1, Math.round(cellH * scale));
  const outContent = resolvePackContentHeight(contentHeight, scale, scaleOpts);
  if (NATIVE_PIXELS) {
    console.log(\`HQ scale=\${scale.toFixed(4)} contentH=\${outContent} cell \${cellW}x\${cellH} → \${outW}x\${outH}\`);
  }`;

  const patterns = [
    /async function scaleFrames\(frames, cellW, cellH, contentHeight\) \{\s*const scale = TARGET_BODY_H \/ Math\.max\(1, contentHeight\);\s*const outW = Math\.max\(1, Math\.round\(cellW \* scale\)\);\s*const outH = Math\.max\(1, Math\.round\(cellH \* scale\)\);\s*const outContent = Math\.max\(1, Math\.round\(contentHeight \* scale\)\);/,
    /async function scaleFrames\(frames, cellW, cellH, contentHeight\) \{\s*const scale = Math\.min\(1, TARGET_BODY_H \/ Math\.max\(1, contentHeight\)\);\s*const outW = Math\.max\(1, Math\.round\(cellW \* scale\)\);\s*const outH = Math\.max\(1, Math\.round\(cellH \* scale\)\);\s*const outContent = Math\.max\(1, Math\.round\(contentHeight \* scale\)\);/,
  ];

  let next = src;
  let matched = false;
  for (const re of patterns) {
    if (!re.test(next)) continue;
    next = next.replace(re, replacement);
    matched = true;
    break;
  }

  if (!matched) {
    const simple = next.replace(
      /const scale = (?:Math\.min\(1, )?TARGET_BODY_H \/ Math\.max\(1, contentHeight\)\);?/g,
      `const scale = resolveHqScale(contentHeight, ${scaleOpts});`,
    );
    if (simple !== next) {
      next = simple.replace(
        /const outContent = Math\.max\(1, Math\.round\(contentHeight \* scale\)\);/,
        `const outContent = resolvePackContentHeight(contentHeight, scale, ${scaleOpts});`,
      );
      next = next.replace(
        /async function scaleFrames\(frames, cellW, cellH, contentHeight\) \{/,
        `async function scaleFrames(frames, cellW, cellH, contentHeight, scaleOpts = ${scaleOpts}) {`,
      );
      matched = true;
    }
  }

  if (!matched) return { fileName, status: 'pattern-miss' };

  let out = next;
  if (!/\bTARGET_BODY_H\b/.test(out.replace(/const TARGET_BODY_H = 48;\n?/, ''))) {
    out = out.replace(/\n?const TARGET_BODY_H = 48;\n?/, '\n');
  }

  if (WRITE) fs.writeFileSync(filePath, out);
  return { fileName, status: WRITE ? 'patched' : 'would-patch', idleKey, mode };
}

function main() {
  const files = fs
    .readdirSync(SCRIPTS)
    .filter((f) => f.startsWith('process-') && f.endsWith('.js'));
  const results = files.map(patchFile);
  const by = {};
  for (const r of results) {
    by[r.status] = (by[r.status] || 0) + 1;
    if (['patched', 'would-patch', 'pattern-miss'].includes(r.status)) {
      console.log(
        `${r.status.padEnd(14)} ${r.fileName}${r.idleKey ? ` (${r.mode}→${r.idleKey})` : ''}`,
      );
    }
  }
  console.log('\nSummary', by);
  if (!WRITE) console.log('\nRe-run with --write to apply.');
}

main();
