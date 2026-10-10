/**
 * watcher/check.js — preflight checks for the live watcher.
 *
 * The watcher mirrors root edits into the templates in real time, so it must
 * refuse to start on a root that would produce silently-wrong output. Three
 * checks run before chokidar is armed (the same order `rexpo doctor` uses):
 *
 *   1. src/ exists — nothing is routable without it, and the first thing a
 *      broken project loses is its routes ([app], [pages], ...).
 *   2. rexpo.config.js `source` mode — the AST transformers pick their pass
 *      from `source.react` / `source.expo`; neither flag set means a `<div>`
 *      reaches Metro untransformed. Missing config falls back to the defaults
 *      (both true) and is a warning, not an error.
 *   3. The expo target's package.json / tsconfig.json are still generated from
 *      the root bundle — byte-identical to what [config].js would write from
 *      `package.expo` / `tsconfig.expo` (or the `expo` array entry). A file
 *      hand-edited or replaced by a fresh scaffold is out of step with the
 *      root, and the watcher would then overwrite it with stale output.
 *
 * The third check is dynamic: it re-derives the expected bytes from the root
 * manifest at startup, so customising package.expo / tsconfig.expo is picked
 * up without touching this file. It is the same comparison doctor's
 * checks/bundle-files.js performs, run at watcher startup instead.
 *
 * Errors print in red (ANSI), warnings in yellow. Output is left plain when
 * stdout is not a TTY or NO_COLOR is set, so logs stay machine-readable.
 */

const fs = require("fs");
const path = require("path");
const {
  readTargetConfig,
  bundleEntryJson,
  BUNDLES,
} = require("../connector/[config]");
const { ok, warn, fail } = require("../doctor/results");

/** Root folder every route connector reads from. */
const SOURCE_DIR = "src";

/** ANSI styles; disabled when not writing to a TTY, NO_COLOR is set, or
 *  FORCE_COLOR is explicitly 0 (respecting the de-facto CLI conventions). */
const supportsColor =
  process.stdout.isTTY && !process.env.NO_COLOR && process.env.FORCE_COLOR !== "0";

const RED = supportsColor ? "\x1b[31m" : "";
const YELLOW = supportsColor ? "\x1b[33m" : "";
const GREEN = supportsColor ? "\x1b[32m" : "";
const RESET = supportsColor ? "\x1b[0m" : "";

/** Red console.error — the failure channel for every check below. */
function errorRed(message) {
  console.error(`${RED}${message}${RESET}`);
}

/** Yellow console.log — for problems the watcher can still run through. */
function warnYellow(message) {
  console.log(`${YELLOW}${message}${RESET}`);
}

/** Green console.log — for the per-check pass lines. */
function okGreen(message) {
  console.log(`${GREEN}${message}${RESET}`);
}

/**
 * Check 1: src/ exists and holds at least one source file.
 * @param {string} packageRoot
 * @returns {boolean} true when the check passed
 */
function checkSourceDir(packageRoot) {
  const srcDir = path.join(packageRoot, SOURCE_DIR);

  if (!fs.existsSync(srcDir)) {
    errorRed(
      `[watcher/check] FAIL: ${SOURCE_DIR}/ was not found at ${srcDir}\n` +
        `  The watcher routes every connector (${SOURCE_DIR}/@app.tsx, ${SOURCE_DIR}/@pages/*, ...) out of ${SOURCE_DIR}/.\n` +
        `  Create ${SOURCE_DIR}/@app.tsx (the app entry) to get started.`
    );
    return false;
  }

  let entries;
  try {
    entries = fs.readdirSync(srcDir);
  } catch (err) {
    errorRed(`[watcher/check] FAIL: ${SOURCE_DIR}/ is not readable (${err.message}).`);
    return false;
  }

  if (entries.length === 0) {
    warnYellow(
      `[watcher/check] WARN: ${SOURCE_DIR}/ is empty — nothing to watch yet.\n` +
        `  Add ${SOURCE_DIR}/@app.tsx to define the app entry.`
    );
  }

  okGreen(`[watcher/check] ok: ${SOURCE_DIR}/ exists (${entries.length} entr${entries.length === 1 ? "y" : "ies"})`);
  return true;
}

/**
 * Check 2: rexpo.config.js declares a source mode.
 *
 * The converter's transform passes key off `source.react` / `source.expo`:
 * with neither set, no HTML->RN rewrite runs and native builds break at
 * runtime, not at compile time — the worst kind of failure to catch late.
 *
 * @param {object} config - merged rexpo.config.js
 * @param {string} packageRoot
 * @returns {boolean} true when a usable source mode is configured
 */
function checkSourceMode(config, packageRoot) {
  const configPath = path.join(packageRoot, "rexpo.config.js");

  if (!fs.existsSync(configPath)) {
    warnYellow(
      "[watcher/check] WARN: rexpo.config.js not found — using built-in defaults.\n" +
        "  Expected at the project root; defaults enable source.react."
    );
    // Defaults keep the tool usable; not worth failing over.
    return true;
  }

  const source = config?.source;
  if (!source || typeof source !== "object") {
    errorRed(
      "[watcher/check] FAIL: rexpo.config.js is missing the `source` block.\n" +
        '  Expected e.g. `source: { react: true, expo: false }` — the converters\n' +
        "  choose their AST pass from these flags."
    );
    return false;
  }

  if (source.react !== true && source.expo !== true) {
    errorRed(
      "[watcher/check] FAIL: no source mode enabled in rexpo.config.js.\n" +
        "  Set `source.react: true` (standard React/DOM authoring) or\n" +
        "  `source.expo: true` (strict React Native primitives authoring).\n" +
        "  With neither, `<div>` and friends would reach Metro untransformed."
    );
    return false;
  }

  const mode = source.expo ? "expo (strict RN primitives)" : "react (DOM authoring)";
  okGreen(`[watcher/check] ok: source mode = ${mode}`);
  return true;
}

/**
 * Check 3: each generated manifest in the target template still matches the
 * root bundle entry it is generated from — derived at runtime, so a customised
 * package.expo / tsconfig.expo is honoured without changes here.
 *
 * @param {string} template - "react" | "expo"
 * @param {string} packageRoot
 * @returns {boolean} true when every bundle file is in step
 */
function checkBundleFiles(template, packageRoot) {
  let allOk = true;

  for (const fileName of BUNDLES) {
    const dest = path.join(packageRoot, "template", template, fileName);
    const resolved = readTargetConfig(fileName, template, packageRoot);

    // No source at all: reported by doctor / [config].js, not duplicated here.
    if (!resolved) continue;

    const expected = bundleEntryJson(resolved.entry);

    if (!fs.existsSync(dest)) {
      errorRed(
        `[watcher/check] FAIL: template/${template}/${fileName} does not exist.\n` +
          `  It is generated from \`${resolved.source}\` — run \`rexpo sync\` once to create it.`
      );
      allOk = false;
      continue;
    }

    let actual;
    try {
      actual = fs.readFileSync(dest, "utf-8");
    } catch (err) {
      errorRed(
        `[watcher/check] FAIL: template/${template}/${fileName} is not readable (${err.message}).`
      );
      allOk = false;
      continue;
    }

    if (actual !== expected) {
      errorRed(
        `[watcher/check] FAIL: template/${template}/${fileName} is not generated from the root bundle — ` +
          `it differs from \`${resolved.source}\`.\n` +
          "  The watcher overwrites it from the root on every change, so a hand-edit\n" +
          "  or a replaced scaffold would be silently reverted. Run `rexpo sync` to\n" +
          "  regenerate it from the root, or move the customisation into the root bundle."
      );
      allOk = false;
      continue;
    }

    okGreen(
      `[watcher/check] ok: template/${template}/${fileName} matches \`${resolved.source}\``
    );
  }

  return allOk;
}

/**
 * Run all preflight checks for the watcher.
 *
 * @param {object} config - merged rexpo.config.js (from loadConfig())
 * @param {string} [packageRoot]
 * @returns {boolean} true when the watcher may start
 */
function runPreflightChecks(config, packageRoot) {
  const root = packageRoot || require("../support/paths").PACKAGE_ROOT;

  let okToStart = true;

  okToStart = checkSourceDir(root) && okToStart;
  okToStart = checkSourceMode(config, root) && okToStart;

  // Only check the templates that are actually enabled.
  for (const template of ["react", "expo"]) {
    if (!config?.deploy?.[template]) continue;
    okToStart = checkBundleFiles(template, root) && okToStart;
  }

  if (!okToStart) {
    errorRed("[watcher/check] Preflight failed — the watcher did not start. Fix the errors above and re-run.");
  }

  return okToStart;
}

module.exports = {
  runPreflightChecks,
  checkSourceDir,
  checkSourceMode,
  checkBundleFiles,
  errorRed,
  warnYellow,
  okGreen,
  SOURCE_DIR,
};
