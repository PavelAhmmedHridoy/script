/**
 * ranges.js — offline comparison of a declared range against an installed
 * version.
 *
 * Deliberately approximate: doctor runs before bundling, often with no network
 * and no dependency on a semver library, and a false "drift" warning is worse
 * than a missed one. Anything unparseable, opaque (`*`, `latest`) or a
 * workspace/file/link specifier is treated as satisfied.
 */

/** Ranges we cannot evaluate offline. */
const OPAQUE_RANGES = new Set(["*", "latest", ""]);

/**
 * Parse `^1.2.3` / `~1.2` / `1.2.3` into { prefix, parts }.
 *
 * @param {string} range
 * @returns {{prefix: string, parts: Array<number|null>}|null}
 */
function parseRange(range) {
  const match = /^(\^|~|>=|<=|=)?\s*v?(\d+)\.?(\d+)?\.?(\d+)?/.exec(range ?? "");
  if (!match) return null;

  return {
    prefix: match[1] || "=",
    parts: [match[2], match[3], match[4]].map((part) => (part === undefined ? null : Number(part))),
  };
}

/**
 * Does `installed` satisfy `range`?
 *
 * @param {string} range - the declared range
 * @param {string} installed - the version found on disk
 * @returns {boolean}
 */
function satisfies(range, installed) {
  if (OPAQUE_RANGES.has(range) || !range) return true;
  if (/^(workspace|file|link|portal):/.test(range)) return true;

  const want = parseRange(range);
  const got = parseRange(installed);
  if (!want || !got) return true; // Unparseable — do not cry wolf.

  const [wMajor, wMinor] = want.parts;
  const [gMajor, gMinor] = got.parts;

  if (want.prefix === "=" || want.prefix === ">=" || want.prefix === "<=") {
    return wMajor === gMajor && (wMinor === null || wMinor === gMinor);
  }
  if (want.prefix === "^") {
    // ^0.x is the minor-locked case.
    if (wMajor !== gMajor) return false;
    return wMajor === 0 ? wMinor === gMinor : true;
  }
  if (want.prefix === "~") {
    return wMajor === gMajor && (wMinor === null || wMinor === gMinor);
  }
  return true;
}

module.exports = { satisfies, parseRange, OPAQUE_RANGES };
