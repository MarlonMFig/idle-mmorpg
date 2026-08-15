/** HQ scale helpers — native pixels keep scale 1. */
function resolveHqTargetBodyH(contentHeight) {
  return Math.max(1, contentHeight);
}

function snapNativeScale(scale) {
  return scale;
}

function preferNativeScale(scale) {
  return scale;
}

module.exports = {
  resolveHqTargetBodyH,
  snapNativeScale,
  preferNativeScale,
};
