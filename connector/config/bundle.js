/**
 * connector/config/bundle.js — reading the root's per-target bundle configs.
 *
 * `package.json` and `tsconfig.json` hold one entry per target under a `react`
 * / `expo` key, because the two targets need genuinely different dependency
 * sets and compiler options. These are *split*, not copied:
 *
 *   { "react": [{ ...web config... }], "expo": [{ ...native config... }] }
 *     -> template/react/package.json  = react[0]
 *     -> template/expo/package.json   = expo[0]
 *
 * Copying the bundle verbatim is what previously broke both templates: the
 * react template's tsconfig lost its `references` (so `tsc -b` resolved
 * nothing) and the expo one lost `extends: expo/tsconfig.base`.
 *
 * The read side is split from the write side (config/sync.js) so doctor can
 * compare a template against the entry without being able to write one.
 */

const fs = require("fs");
const path = require("path");

/** Targets a bundled config can carry an entry for. */
const TARGETS = ["react", "expo"];

/**
 * Root files that hold one entry per target and must be split.
 * Anything else that exists at the root is copied verbatim by MAPPINGS.
 */
const BUNDLES = ["tsconfig.json", "package.json"];

/**
 * Parse a bundled root config.
 * @returns {object|null} the parsed object, or null when the file is missing,
 *   unparseable, or not in bundle format (has no per-target array).
 */
function readBundle(fileName, packageRoot) {
  const abs = path.join(packageRoot, fileName);
  if (!fs.existsSync(abs)) return null;

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(abs, "utf-8"));
  } catch (err) {
    console.warn(`[connector/config] ${fileName} is not valid JSON (${err.message}).`);
    return null;
  }

  const isBundle = TARGETS.some((target) => Array.isArray(parsed[target]));
  return isBundle ? parsed : null;
}

/**
 * The per-target config file for a bundle file.
 *
 * `package.json` + `react` -> `package.react`; `tsconfig.json` + `expo` ->
 * `tsconfig.expo`. A file of that name holds one target's config on its own,
 * which is what lets a heavily customised target live in a file next to the
 * shared one instead of inside a nested array.
 *
 * @param {string} fileName - "package.json" | "tsconfig.json"
 * @param {string} template - "react" | "expo"
 * @returns {string}
 */
function targetConfigName(fileName, template) {
  return `${fileName.replace(/\.json$/, "")}.${template}`;
}

/** Absolute path of a per-target config file. */
function targetConfigPath(fileName, template, packageRoot) {
  return path.join(packageRoot, targetConfigName(fileName, template));
}

/**
 * Read one target's config: its own file first, then the bundle entry.
 *
 * The per-target file wins when both exist, so it is the place to customise a
 * single target without touching the other. A malformed one is reported and
 * ignored rather than silently emptying a template.
 *
 * @param {string} fileName
 * @param {string} template
 * @param {string} packageRoot
 * @returns {{entry: object, source: string}|null} `source` is which file the
 *   entry came from, for the log line and for doctor
 */
function readTargetConfig(fileName, template, packageRoot) {
  const targetFile = targetConfigName(fileName, template);
  const abs = targetConfigPath(fileName, template, packageRoot);

  if (fs.existsSync(abs)) {
    try {
      return { entry: JSON.parse(fs.readFileSync(abs, "utf-8")), source: targetFile };
    } catch (err) {
      console.warn(
        `[connector/config] ${targetFile} is not valid JSON (${err.message}), falling back to the bundle.`
      );
    }
  }

  const bundle = readBundle(fileName, packageRoot);
  const entry = Array.isArray(bundle?.[template]) ? bundle[template][0] : null;

  return entry ? { entry, source: fileName } : null;
}

/**
 * The exact bytes a bundle entry becomes in a template.
 *
 * The single source of truth for the bundle -> template connection: the writer
 * uses it, and `rexpo doctor` compares each generated file against it, so a
 * customised root bundle cannot drift from its templates unnoticed.
 *
 * @param {object} entry - one element of the bundle's `react` / `expo` array
 * @returns {string}
 */
function bundleEntryJson(entry) {
  return `${JSON.stringify(entry, null, 2)}\n`;
}

module.exports = {
  TARGETS,
  BUNDLES,
  readBundle,
  readTargetConfig,
  targetConfigName,
  targetConfigPath,
  bundleEntryJson,
};
