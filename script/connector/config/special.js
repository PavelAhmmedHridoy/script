/**
 * connector/config/special.js — files the user marks as template-specific.
 *
 * Some root files belong to exactly one template, and the plain copy table in
 * plain.js cannot know which: `metro.config.js` means nothing to Vite, and
 * `vite.config.ts` means nothing to Metro. Worse, a whole class of files never
 * reaches either template at all — dot-files like `.env` / `.env.local` are
 * filtered by the watchers as tooling noise and no connector claims them, so a
 * build that needed them failed with an unresolved variable instead of a
 * named cause.
 *
 * `rexpo.config.js` is where the user settles both, per target:
 *
 *   specialFiles: {
 *     react: {
 *       include: [".env", { from: ".env.staging", to: ".env" }],
 *       exclude: ["metro.config.js"],
 *     },
 *     expo: {
 *       include: [".env.local", "google-services.json"],
 *       exclude: ["vite.config.ts", "index.html"],
 *     },
 *   }
 *
 * An include is either a root file name or a `{ from, to }` pair for the case
 * where the target needs the file under a different name. Excludes name files
 * the plain copy table would otherwise send to that template — they subtract
 * from it rather than from the includes, so the two never fight.
 *
 * Defaults: the two `.env` files every template needs are included for both
 * targets without being asked for — but an explicit `include` replaces them,
 * and either list can say `"none"` to opt out entirely.
 *
 * Copies are verbatim through io.copyFileIfChanged — a build config file is
 * data, and the converter has nothing to say to a PNG or a dotenv file.
 */

const fs = require("fs");
const path = require("path");
const { copyFileIfChanged } = require("../../io");

/** Root files every template gets unless the user says otherwise. */
const DOT_ENV_DEFAULTS = [".env", ".env.local"];

/** Read one target's specialFiles block, tolerating a missing config. */
function targetBlock(config, template) {
  return config?.specialFiles?.[template] ?? {};
}

/**
 * The include list for a target: the user's entries, or the .env defaults
 * when they declared none. `"none"` opts out entirely.
 *
 * @param {object} config - rexpo.config.js
 * @param {"react"|"expo"} template
 * @returns {(string|{from:string,to:string})[]}
 */
function includesFor(config, template) {
  const declared = targetBlock(config, template).include;

  if (declared === "none") return [];
  if (Array.isArray(declared)) return declared;
  return [...DOT_ENV_DEFAULTS];
}

/**
 * The exclude list for a target: files that must NOT reach this template.
 * Subtracting from plain.js's copy table is the point — `exclude:
 * ["metro.config.js"]` on react is what stops a Metro config from landing in
 * the web template's root, where Vite would ignore it but `doctor` would not.
 *
 * @param {object} config - rexpo.config.js
 * @param {"react"|"expo"} template
 * @returns {string[]}
 */
function excludesFor(config, template) {
  const declared = targetBlock(config, template).exclude;
  return Array.isArray(declared) ? declared : [];
}

/**
 * True when a root file is excluded from a template, by name.
 * Accepts both `metro.config.js` and a template-relative path.
 *
 * @param {string} rootRel - root-relative file name or path
 * @param {string[]} excludes
 * @returns {boolean}
 */
function isExcluded(rootRel, excludes) {
  if (excludes.length === 0) return false;
  const name = path.basename(rootRel);
  return excludes.includes(name) || excludes.includes(rootRel);
}

/**
 * Resolve one include entry to a `{ from, to }` copy, relative to the root.
 * A bare string keeps its own name; `{ from, to }` renames it in the template.
 *
 * @param {string|{from:string,to:string}} entry
 * @returns {{from:string,to:string}|null}
 */
function resolveEntry(entry) {
  if (typeof entry === "string" && entry.trim()) return { from: entry, to: entry };
  if (entry && typeof entry === "object" && typeof entry.from === "string" && typeof entry.to === "string") {
    return { from: entry.from, to: entry.to };
  }
  return null;
}

/**
 * Copy one file into its template, verbatim. Missing sources are silent — a
 * file the user listed is often created only later, and warning once per sync
 * per template for a `.env` that may never exist is noise.
 *
 * @param {string} packageRoot - Project root
 * @param {string} template - "react" | "expo"
 * @param {{from:string,to:string}} entry - root-relative names
 * @returns {boolean} true when the file was written
 */
function copySpecialFile(packageRoot, template, entry) {
  const from = path.join(packageRoot, entry.from);
  const to = path.join(packageRoot, "template", template, entry.to);

  if (!fs.existsSync(from)) return false;
  return copyFileIfChanged(from, to);
}

/**
 * Sync a target's special files. Logged one line per written file, like the
 * other config copies.
 *
 * @param {object} config - rexpo.config.js
 * @param {"react"|"expo"} template
 * @param {string} packageRoot - Project root
 * @returns {string[]} root-relative names actually written
 */
function syncSpecialFiles(config, template, packageRoot) {
  const written = [];

  for (const entry of includesFor(config, template)) {
    const resolved = resolveEntry(entry);
    if (!resolved) {
      console.warn(`[connector/config] [${template}] ignoring malformed specialFiles entry:`, entry);
      continue;
    }

    if (copySpecialFile(packageRoot, template, resolved)) {
      console.log(`[connector/config] [${template}] ${resolved.from} -> template/${template}/${resolved.to}`);
      written.push(resolved.from);
    }
  }

  return written;
}

/**
 * Dot-file names the watcher must let through for this config: every dot-named
 * include across the enabled targets. The defaults come along through
 * includesFor, so an explicit list replaces them and `"none"` yields nothing.
 *
 * @param {object} [config] - rexpo.config.js
 * @returns {Set<string>}
 */
function watchableDotNames(config) {
  const names = new Set();
  for (const template of ["react", "expo"]) {
    if (config?.deploy?.[template] === false) continue;

    for (const entry of includesFor(config, template)) {
      const resolved = resolveEntry(entry);
      if (!resolved) continue;

      const base = path.basename(resolved.from);
      if (base.startsWith(".")) names.add(base);
    }
  }
  return names;
}

/**
 * Live counterpart of syncSpecialFiles for one changed root file: copy it into
 * every enabled target that includes it, under that target's configured name.
 * Runs before the connectors in the watcher, because their raw fallback would
 * copy the file 1:1 into every template instead of honouring `{ from, to }`.
 *
 * @param {string} absPath - the changed root file (absolute)
 * @param {object} config - rexpo.config.js
 * @param {string} packageRoot - Project root
 * @returns {boolean} true when the file is a special include somewhere
 */
function syncSpecialChange(absPath, config, packageRoot) {
  const rootRel = path.relative(packageRoot, absPath).split(path.sep).join("/");
  if (!rootRel || rootRel.startsWith("..")) return false;

  let handled = false;
  for (const template of ["react", "expo"]) {
    if (config?.deploy?.[template] === false) continue;

    for (const entry of includesFor(config, template)) {
      const resolved = resolveEntry(entry);
      if (!resolved || resolved.from !== rootRel) continue;

      if (copySpecialFile(packageRoot, template, resolved)) {
        console.log(`[live/special] [${template}] ${resolved.from} -> template/${template}/${resolved.to}`);
      }
      handled = true;
    }
  }
  return handled;
}

/**
 * Live counterpart for a deleted root file: remove the copies it had in the
 * templates, mirroring syncSpecialChange's routing.
 *
 * @param {string} absPath - the deleted root file (absolute)
 * @param {object} config - rexpo.config.js
 * @param {string} packageRoot - Project root
 * @returns {boolean} true when the file was a special include somewhere
 */
function removeSpecialChange(absPath, config, packageRoot) {
  const rootRel = path.relative(packageRoot, absPath).split(path.sep).join("/");
  if (!rootRel || rootRel.startsWith("..")) return false;

  let handled = false;
  for (const template of ["react", "expo"]) {
    if (config?.deploy?.[template] === false) continue;

    for (const entry of includesFor(config, template)) {
      const resolved = resolveEntry(entry);
      if (!resolved || resolved.from !== rootRel) continue;

      const dest = path.join(packageRoot, "template", template, resolved.to);
      try {
        if (fs.existsSync(dest)) {
          fs.unlinkSync(dest);
          console.log(`[live/special] [${template}] removed template/${template}/${resolved.to}`);
        }
      } catch (err) {
        console.error(`[live/special] failed to remove template/${template}/${resolved.to}: ${err.message}`);
      }
      handled = true;
    }
  }
  return handled;
}

module.exports = {
  DOT_ENV_DEFAULTS,
  targetBlock,
  includesFor,
  excludesFor,
  isExcluded,
  resolveEntry,
  copySpecialFile,
  syncSpecialFiles,
  watchableDotNames,
  syncSpecialChange,
  removeSpecialChange,
};
