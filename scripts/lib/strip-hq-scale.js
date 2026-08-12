/**
 * Shared strip/sheet HQ scale (Chouji / Hinata / Itachi / …).
 *
 * Idle: scale=1 (native pixels). Other anims: match idle contentHeight.
 */
const fs = require('fs');

const NATIVE_PIXELS = true;
const LEGACY_TARGET_BODY_H = 48;

function readIdleContentHeight(metaPath, idleKey) {
  if (!metaPath || !fs.existsSync(metaPath) || !idleKey) return null;
  try {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    const h = meta[idleKey]?.contentHeight;
    return typeof h === 'number' && h > 0 ? h : null;
  } catch {
    return null;
  }
}

/**
 * @param {number} sourceBodyH
 * @param {{
 *   metaPath?: string,
 *   idleKey?: string,
 *   mode?: 'idle' | 'match',
 *   matchMaxBodyH?: number|null,
 * }} [opts]
 */
function resolveHqScale(sourceBodyH, opts = {}) {
  const { metaPath, idleKey, mode = 'idle', matchMaxBodyH = null } = opts;
  if (!NATIVE_PIXELS) {
    return LEGACY_TARGET_BODY_H / Math.max(1, sourceBodyH);
  }
  if (mode === 'idle') return 1;
  const idleH = readIdleContentHeight(metaPath, idleKey);
  if (idleH == null) {
    throw new Error(
      `HQ strip: run idle first (need ${idleKey || '*-idle'}.contentHeight in meta)`,
    );
  }
  const ref = matchMaxBodyH != null ? matchMaxBodyH : sourceBodyH;
  return idleH / Math.max(1, ref);
}

function resolvePackContentHeight(sourceBodyH, scale, opts = {}) {
  const { metaPath, idleKey, mode = 'idle' } = opts;
  if (!NATIVE_PIXELS) {
    return Math.max(1, Math.round(sourceBodyH * scale));
  }
  if (mode === 'idle') {
    return Math.max(1, Math.round(sourceBodyH * scale));
  }
  const idleH = readIdleContentHeight(metaPath, idleKey);
  if (idleH == null) {
    throw new Error(
      `HQ strip: run idle first (need ${idleKey || '*-idle'}.contentHeight in meta)`,
    );
  }
  return idleH;
}

/**
 * Dynamic body ruler for alpha-frame-pack pipelines, where the pack derives its
 * own scale from `targetBodyH`. Swapping the hardcoded 48 for this keeps every
 * existing scale/cap rule intact while going native.
 *
 * @param {number} maxContentH tallest source frame body, pre-scale
 * @param {{ metaPath?: string, idleKey?: string, mode?: 'idle'|'match' }} [opts]
 */
function resolveHqTargetBodyH(maxContentH, opts = {}) {
  const { metaPath, idleKey, mode = 'idle' } = opts;
  if (!NATIVE_PIXELS) return LEGACY_TARGET_BODY_H;
  if (mode === 'idle') return Math.max(1, Math.round(maxContentH));
  const idleH = readIdleContentHeight(metaPath, idleKey);
  if (idleH == null) {
    throw new Error(
      `HQ pack: run the ruler anim first (need ${idleKey || '*-idle'}.contentHeight in meta)`,
    );
  }
  return idleH;
}

/**
 * Multiplier for QA budgets expressed in pixel distance (foot jitter, gash run
 * length). They were tuned against the legacy 48px body; a native-pixel pack
 * draws the same silhouette at `contentHeight/48` times the linear resolution.
 */
function hqLinearScale(contentHeight) {
  if (!NATIVE_PIXELS) return 1;
  const h =
    typeof contentHeight === 'number' && contentHeight > 0
      ? contentHeight
      : LEGACY_TARGET_BODY_H;
  return h / LEGACY_TARGET_BODY_H;
}

/** Same idea as `hqLinearScale`, for budgets measured in pixel *area*. */
function hqAreaScale(contentHeight) {
  return hqLinearScale(contentHeight) ** 2;
}

/**
 * Native-pixel guard: when matching the ruler moves the body by less than a
 * pixel, resampling only costs quality — keep the source pixels untouched.
 */
function snapNativeScale(scale, refH) {
  if (!NATIVE_PIXELS) return scale;
  return Math.abs(refH * scale - refH) < 1.5 ? 1 : scale;
}

/** Ratio below which matching the ruler is not worth a resample. */
const NATIVE_SCALE_TOLERANCE = 0.08;

/**
 * Same-rip guard for anims that already share the ruler's pixel density (idle
 * vs walk of one export): the tiny body delta is exactly what the pack shows
 * today, so keep native pixels and let the ruler `contentHeight` normalize the
 * on-screen size. Rips at a genuinely different zoom (combo / jutsu sheets)
 * fall outside the tolerance and still get resampled to the ruler.
 */
function preferNativeScale(scale, { tolerance = NATIVE_SCALE_TOLERANCE } = {}) {
  if (!NATIVE_PIXELS) return scale;
  return Math.abs(scale - 1) <= tolerance ? 1 : scale;
}

/**
 * FX sheets are drawn with `playPackFx(player.scale * ~1.15)`. When the body
 * pack went HQ (contentHeight ≫ 48), a leftover TARGET_MAX_SIDE≈40–56 FX looks
 * tiny. Scale the legacy max-side by idle/48 so the FX∶body ratio stays.
 *
 * @param {string|null|undefined} metaPath
 * @param {string} idleKey
 * @param {number} [legacyMaxSide=56]
 */
function resolveHqFxTargetMaxSide(metaPath, idleKey, legacyMaxSide = 56) {
  if (!NATIVE_PIXELS) return legacyMaxSide;
  const idleH = readIdleContentHeight(metaPath, idleKey);
  if (idleH == null) return legacyMaxSide;
  return Math.max(1, Math.round(legacyMaxSide * hqLinearScale(idleH)));
}

module.exports = {
  NATIVE_PIXELS,
  LEGACY_TARGET_BODY_H,
  NATIVE_SCALE_TOLERANCE,
  hqLinearScale,
  hqAreaScale,
  readIdleContentHeight,
  resolveHqScale,
  resolvePackContentHeight,
  resolveHqTargetBodyH,
  snapNativeScale,
  preferNativeScale,
  resolveHqFxTargetMaxSide,
};
