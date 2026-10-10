/**
 * watcher/index.js — nodemon-style live watcher: root files -> templates.
 *
 * Watches the root source folders (src/, app/, components/, pages/, assets/)
 * and mirrors every created or changed file into every enabled template
 * (template/react, template/expo), the way nodemon reacts to file changes.
 * Deleted root files are removed from the templates the same way.
 *
 * Why watch directories instead of globs:
 *   chokidar v4 removed glob support, so patterns like
 *   "src/**\/*.{ts,tsx}" silently match nothing. Watching real directories
 *   with an ignore filter picks up everything — including dynamic route
 *   files ([id].tsx, [...slug].tsx) whose brackets glob parsers used to
 *   swallow as character classes.
 *
 * Routing of a changed root file:
 *   - Special "@" convention files (src/@app.tsx, src/@layout.tsx,
 *     src/@components/*, src/@pages/*, src/@lib/*, ...) are routed by the
 *     connector system to their special template locations, e.g.
 *     src/@app.tsx -> template/react/src/App.tsx + template/expo/app/index.tsx.
 *   - Dynamic route files are routed the same way, e.g.
 *     src/@pages/[id].tsx -> template/expo/app/[id].tsx (expo-router dynamic
 *     segment) and template/react/src/pages/[id].tsx.
 *   - Everything else falls back to a raw 1:1 copy at the same relative
 *     path in every enabled template.
 */

const chokidar = require("chokidar");
const path = require("path");
const { loadConfig } = require("../support/config");
const { PACKAGE_ROOT } = require("../support/paths");
const { runPreflightChecks } = require("./check");
const {
  WATCHABLE_EXT,
  DYNAMIC_ROUTE_RE,
  WATCHABLE_DOT_NAMES,
  isDynamicRoute,
  isIgnored,
  createIgnoreFilter,
  enabledTemplateDirs,
  getWatchPaths,
} = require("./paths");
const { handleChangedFile, handleRemovedFile } = require("./mirror");
const { syncSpecialChange, removeSpecialChange } = require("../connector/config/special");

/**
 * Create a nodemon-style live watcher that mirrors root file changes into
 * whichever template(s) are enabled in config, via the connector system.
 * @param {object} config - rexpo.config.js
 * @param {object} options - Watch options ({ debounceMs })
 * @returns {FSWatcher}
 */
function createLiveWatcher(config, { debounceMs = 150 } = {}) {
  // Root-level special dot-files (.env, …) live in no watched directory, so
  // getWatchPaths points chokidar at each one that exists.
  const watchPaths = getWatchPaths(PACKAGE_ROOT, config);

  const watcher = chokidar.watch(watchPaths, {
    ignored: createIgnoreFilter(config),
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: debounceMs,
      pollInterval: 50,
    },
  });

  const debounceTimers = new Map();

  function handleChange(filePath) {
    // Debounce rapid changes per file
    clearTimeout(debounceTimers.get(filePath));
    debounceTimers.set(
      filePath,
      setTimeout(() => {
        debounceTimers.delete(filePath);
        // rexpo.config.js specialFiles first: a root .env is not a connector
        // route, and the raw fallback would 1:1-copy it into every template
        // instead of honouring the per-target `{ from, to }` mapping.
        if (syncSpecialChange(filePath, config, PACKAGE_ROOT)) return;
        handleChangedFile(filePath, config);
      }, debounceMs)
    );
  }

  function handleUnlink(filePath) {
    if (removeSpecialChange(filePath, config, PACKAGE_ROOT)) return;
    handleRemovedFile(filePath, config);
  }

  watcher.on("change", handleChange);
  watcher.on("add", handleChange);
  watcher.on("unlink", handleUnlink);
  watcher.on("error", (err) => {
    console.error(`[live] watch error: ${err.message}`);
  });

  console.log(
    `[live] Watching ${watchPaths
      .map((p) => path.relative(PACKAGE_ROOT, p) || ".")
      .join(", ")} -> syncing changes to enabled templates (like nodemon)...`
  );

  return watcher;
}

/** nodemon-flavored alias. */
const watchLive = createLiveWatcher;

/**
 * Start the live watcher based on config. Kept as an array return for
 * compatibility with callers that close all watchers on exit.
 * @param {object} config - rexpo.config.js
 * @returns {FSWatcher[]}
 */
function startLiveWatchers(config) {
  if (!config.deploy?.react && !config.deploy?.expo) return [];

  // Preflight before arming chokidar: a root whose templates are out of step
  // with their bundles would be mirrored anyway, just silently wrong.
  if (!runPreflightChecks(config, PACKAGE_ROOT)) {
    return [];
  }

  const debounceMs = config.monitor?.debounceMs ?? 150;
  return [createLiveWatcher(config, { debounceMs })];
}

/** `createWatcher` — the name script/runner/index.js calls. */
function createWatcher(config, options = {}) {
  return createLiveWatcher(config, options);
}

/** `startWatchers` — the name script/runner/index.js calls. */
function startWatchers(config) {
  return startLiveWatchers(config);
}

module.exports = {
  createWatcher,
  startWatchers,
  createLiveWatcher,
  startLiveWatchers,
  watchLive,
  // Re-exported from ./paths and ./mirror — single source of truth.
  isDynamicRoute,
  isIgnored,
  createIgnoreFilter,
  handleChangedFile,
  handleRemovedFile,
  DYNAMIC_ROUTE_RE,
  WATCHABLE_EXT,
  WATCHABLE_DOT_NAMES,
};

// Allow `node script/watcher/index.js` to run directly.
if (require.main === module) {
  console.log("[watcher] Starting file watchers...");
  const watchers = startWatchers(loadConfig());

  process.on("SIGINT", () => {
    console.log("\n[watcher] Stopping watchers...");
    watchers.forEach((w) => w.close());
    process.exit(0);
  });
}
