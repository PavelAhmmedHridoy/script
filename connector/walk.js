/**
 * connector/walk.js — the one recursive directory walk.
 *
 * Every pattern connector used to carry its own getAllFiles() copy, and none
 * of them filtered anything: a `.DS_Store` dragged into src/@components, a
 * `.git` directory created by a mistaken repo init, or a `.expo` cache folder
 * all came back from readdirSync and were routed into the templates like
 * authored files. The watchers ignore dot-entries, so the two directions also
 * disagreed — a full sync copied what a live edit would then refuse to touch.
 *
 * One walk, one set of rules:
 *
 *   - dot-directories are never authored tree (`.git`, `.expo`, `.cache`, …);
 *   - junk dot-files are dropped (`.DS_Store`, `Thumbs.db`, `.eslintcache`);
 *   - any other dot-file is kept by default — root-level `.env`-style files
 *     are app input, and whether they travel is rexpo.config.js's
 *     specialFiles decision, not the walker's;
 *   - a `keep(name)` predicate narrows further when a connector only wants
 *     some names.
 */

const fs = require("fs");
const path = require("path");

/** Dot-entries (and one Windows classic) that are tooling noise. */
const JUNK_DOT_NAMES = new Set([
  ".DS_Store",
  "Thumbs.db",
  ".gitignore",
  ".gitattributes",
  ".gitmodules",
  ".npmignore",
  ".eslintcache",
  ".DS_Store?", // appears when a macOS volume is copied through a FAT fs
]);

/** True when an entry name is tooling noise rather than an authored file. */
function isJunkName(name) {
  return JUNK_DOT_NAMES.has(name);
}

/**
 * Yield every file under `dir`, recursively, minus the noise.
 *
 * @param {string} dir - directory to walk (absolute)
 * @param {object} [options]
 * @param {(name: string) => boolean} [options.keep] - extra per-file filter
 * @param {string[]} [files] - accumulator (for the recursive calls)
 * @returns {string[]} absolute file paths
 */
function walkFiles(dir, options = {}, files = []) {
  const { keep = () => true } = options;

  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    console.warn(`[connector] could not read ${dir}: ${err.message}`);
    return files;
  }

  for (const entry of entries) {
    if (isJunkName(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Hidden directories are tooling territory, never authored tree.
      if (entry.name.startsWith(".")) continue;
      walkFiles(fullPath, options, files);
    } else if (keep(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

module.exports = { walkFiles, isJunkName, JUNK_DOT_NAMES };
