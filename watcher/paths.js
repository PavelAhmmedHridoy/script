/**
 * watcher/paths.js — what to watch, and what to leave alone.
 *
 * Why watch directories instead of globs: chokidar v4 removed glob support, so
 * patterns like "src/**\/*.{ts,tsx}" silently match nothing. Watching real
 * directories with an ignore filter picks up everything — including dynamic
 * route files ([id].tsx, [...slug].tsx) whose brackets glob parsers used to
 * swallow as character classes.
 *
 * Dot-files are the one deliberate exception to the "hidden means tooling"
 * rule: `.env` / `.env.local` (and whatever else rexpo.config.js's
 * specialFiles includes) are authored app input that the templates need, so
 * they are watchable even though every dot-directory stays ignored. The set is
 * config-aware: createIgnoreFilter(config) lets through exactly the dot-files
 * specialFiles includes, while isIgnored — the config-less default — uses the
 * built-in .env pair, matching what the config connector copies by default.
 */

const fs = require("fs");
const path = require("path");
const { PACKAGE_ROOT } = require("../support/paths");
const { watchableDotNames, DOT_ENV_DEFAULTS } = require("../connector/config/special");

/** Root source folders that are live-synced into templates. */
const SOURCE_DIRS = ["src", "app", "components", "pages", "assets"];

/** File extensions that trigger a template sync ("like nodemon"). */
const WATCHABLE_EXT =
  /\.(js|jsx|ts|tsx|css|scss|json|png|jpe?g|gif|svg|webp|ico|mp4|woff2?|ttf|otf)$/i;

/** Dynamic route files: [id].tsx, [slug]/index.tsx, [...catchAll].tsx */
const DYNAMIC_ROUTE_RE = /\[[^\]]+\]/;

/** Dot-files that are app input, not tooling noise — watchable by default. */
const WATCHABLE_DOT_NAMES = new Set(DOT_ENV_DEFAULTS);

/** Directories the watcher never descends into (defensive; also covers the
 *  case where the whole project root ends up being watched). */
const IGNORED_DIR_NAMES = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  "template", // our own output — syncing it back would loop
  "script", // tooling
  ".rexpo",
  ".expo",
  ".next",
  ".vite",
  ".cache",
  ".turbo",
  "types",
]);

/** True when a path contains a dynamic route segment like [id] or [...slug]. */
function isDynamicRoute(absPath) {
  return DYNAMIC_ROUTE_RE.test(absPath);
}

/**
 * Build the chokidar `ignored` filter for a run.
 *
 * Directory rules come first and are absolute: any dot-segment means a hidden
 * directory (or the tooling files inside one) and is out. A *file* at the root
 * gets one exception — a name in the specialFiles include set (`env` files,
 * by default, plus whatever the user added) is app input the templates need.
 *
 * @param {object} [config] - rexpo.config.js
 * @returns {(absPath: string, stats?: object) => boolean}
 */
function createIgnoreFilter(config) {
  const dotNames = watchableDotNames(config);

  return function isIgnoredForConfig(absPath, stats) {
    const rel = path.relative(PACKAGE_ROOT, absPath);
    if (!rel || rel.startsWith("..")) return true;

    const segments = rel.split(path.sep);
    const name = segments[segments.length - 1];

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      if (IGNORED_DIR_NAMES.has(segment)) return true;

      // Hidden directories are out entirely; a hidden *file* is only out when
      // it is not one the user includes — and only the root-level ones can be
      // included, since includes are root-relative names.
      if (!segment.startsWith(".")) continue;
      const isRootFile = i === segments.length - 1 && segments.length === 1;
      if (isRootFile && dotNames.has(segment)) break;
      return true;
    }

    if (stats && stats.isDirectory()) return false;
    if (!stats) return false; // unknown (no stats yet) — let chokidar resolve it
    return !WATCHABLE_EXT.test(rel);
  };
}

/**
 * The config-less default filter — the same rules with the built-in .env
 * allowlist. Kept for callers (and exports) that predate the config-aware
 * variant; createLiveWatcher uses createIgnoreFilter(config).
 */
const isIgnored = createIgnoreFilter({});

/** Absolute template dirs enabled in config. */
function enabledTemplateDirs(config) {
  const dirs = [];
  if (config.deploy?.react) dirs.push(path.join(PACKAGE_ROOT, "template", "react"));
  if (config.deploy?.expo) dirs.push(path.join(PACKAGE_ROOT, "template", "expo"));
  return dirs;
}

/**
 * Root folders to watch (only the ones that exist), plus the root-level
 * special dot-files the config includes. The dot-files must be watched by
 * name: they live in the project root itself, which is otherwise never a
 * watch root, and chokidar's ignore filter alone would not surface them.
 *
 * @param {string} [packageRoot]
 * @param {object} [config] - rexpo.config.js
 */
function getWatchPaths(packageRoot = PACKAGE_ROOT, config) {
  const paths = [];
  for (const dir of SOURCE_DIRS) {
    const abs = path.join(packageRoot, dir);
    if (fs.existsSync(abs)) paths.push(abs);
  }

  // The special-files includes, verbatim from the config: a `.env` the user
  // lists is watched even though the root directory itself is not.
  if (config) {
    for (const name of watchableDotNames(config)) {
      const abs = path.join(packageRoot, name);
      if (fs.existsSync(abs)) paths.push(abs);
    }
  }

  // Fallback: if no source folder exists yet, watch the whole project root.
  if (paths.length === 0) paths.push(packageRoot);
  return paths;
}

module.exports = {
  SOURCE_DIRS,
  WATCHABLE_EXT,
  DYNAMIC_ROUTE_RE,
  IGNORED_DIR_NAMES,
  WATCHABLE_DOT_NAMES,
  isDynamicRoute,
  isIgnored,
  createIgnoreFilter,
  enabledTemplateDirs,
  getWatchPaths,
};
