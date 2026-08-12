/**
 * Chouji HQ native-pixel scale (same strategy as Piccolo / Freeza / Majin Boo).
 *
 * - Idle: absoluteScale = 1 (no art downscale → max quality)
 * - Walk / combo / jutsu: scale so body density matches idle contentHeight
 * - World size stays via contentHeight + optional displayScale (no resample)
 */
const fs = require('fs');

const NATIVE_PIXELS = true;
const LEGACY_TARGET_BODY_H = 48;

function readIdleContentHeight(metaPath) {
  if (!metaPath || !fs.existsSync(metaPath)) return null;
  try {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    const h = meta['chouji-idle']?.contentHeight;
    return typeof h === 'number' && h > 0 ? h : null;
  } catch {
    return null;
  }
}

/**
 * @param {number} sourceBodyH measured standing/body height before scale
 * @param {{ metaPath?: string, matchIdle?: boolean, matchMaxBodyH?: number|null }} [opts]
 *   matchMaxBodyH: when set (combo), scale so this max body H → idle ruler
 */
function resolveHqScale(sourceBodyH, opts = {}) {
  const { metaPath, matchIdle = false, matchMaxBodyH = null } = opts;
  if (!NATIVE_PIXELS) {
    return LEGACY_TARGET_BODY_H / Math.max(1, sourceBodyH);
  }
  if (matchIdle || matchMaxBodyH != null) {
    const idleH = readIdleContentHeight(metaPath);
    if (idleH == null) {
      throw new Error(
        'Chouji HQ: run npm run chouji:idle first (need chouji-idle.contentHeight in meta.json)',
      );
    }
    const ref = matchMaxBodyH != null ? matchMaxBodyH : sourceBodyH;
    return idleH / Math.max(1, ref);
  }
  return 1;
}

/**
 * Pack contentHeight ruler — idle native height when matching; else scaled source.
 */
function resolvePackContentHeight(sourceBodyH, scale, opts = {}) {
  if (NATIVE_PIXELS && (opts.matchIdle || opts.matchMaxBodyH != null)) {
    const idleH = readIdleContentHeight(opts.metaPath);
    if (idleH == null) {
      throw new Error(
        'Chouji HQ: run npm run chouji:idle first (need chouji-idle.contentHeight in meta.json)',
      );
    }
    return idleH;
  }
  return Math.max(1, Math.round(sourceBodyH * scale));
}

module.exports = {
  NATIVE_PIXELS,
  LEGACY_TARGET_BODY_H,
  readIdleContentHeight,
  resolveHqScale,
  resolvePackContentHeight,
};
