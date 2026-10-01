/**
 * converter/warn.js — the converter's one warning.
 *
 * Both directions can be left holding something they could not convert: an
 * HTML tag with no React Native mapping on the native side, a native component
 * with no DOM equivalent on the web side. A DOM element surviving into React
 * Native is a runtime `View config` error, so the pass reports rather than
 * fails — naming the file it came from.
 *
 * The pass functions only ever see content, so the runner sets the current
 * source around each file (see `transform.js`) rather than threading a path
 * through every signature.
 */

const path = require("path");
const { PACKAGE_ROOT } = require("../support/paths");

/** Source file currently being converted, for warning messages. */
let currentConvertSrc = null;

/** Name the file the next transform calls are working on (or null). */
function setCurrentSource(src) {
  currentConvertSrc = src;
}

/**
 * Warn about names a pass could not convert, once per file.
 *
 * @param {Set<string>} unmapped
 * @param {string} what - e.g. "HTML tag(s) with no React Native mapping kept as-is"
 */
function warnUnmapped(unmapped, what) {
  if (!unmapped || unmapped.size === 0 || !currentConvertSrc) return;

  const rel = path.relative(PACKAGE_ROOT, currentConvertSrc);
  console.warn(`[converter] [warn] ${rel}: ${what}: ${[...unmapped].sort().join(", ")}`);
}

module.exports = { warnUnmapped, setCurrentSource };
