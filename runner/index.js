/**
 * index.js — entry point for the runner folder.
 *
 * Imports the dev runner from ./dev and the start runner from ./start
 * so script/index.js can simply `require("./runner")`.
 *
 * Target scoping: `dev` runs only the react (web) dev server and `start`
 * runs only the expo (mobile) server — pass the mode through
 * runAll({ target }) so the two templates never start at the same time.
 */

const { runDev } = require("./dev");
const { runStart } = require("./start");
const { startWatchers } = require("../watcher");
const { syncConnectors } = require("../connector");
const { syncDependencies } = require("../deps");
const { loadConfig } = require("../support/config");

/**
 * Map a CLI mode to a template target:
 *   dev   -> react (web)
 *   start -> expo (mobile)
 *   (nothing / anything else) -> all
 *
 * @param {string[]} [argv]
 * @returns {"react"|"expo"|"all"}
 */
function resolveTarget(argv = process.argv.slice(2)) {
  const args = argv.map((a) => a.replace(/^--/, "").toLowerCase());
  if (args.includes("dev")) return "react";
  if (args.includes("start")) return "expo";
  return "all";
}

/**
 * Deploy-scoped copy of config for a target, so connectors, servers and
 * watchers only touch the requested template(s). Still respects the deploy
 * flags from rexpo.config.js (e.g. `dev` won't start react if
 * deploy.react is false).
 *
 * @param {object} config - rexpo.config.js
 * @param {"react"|"expo"|"all"} target
 * @returns {object}
 */
function scopedConfig(config, target) {
  const wantReact = target === "react" || target === "all";
  const wantExpo = target === "expo" || target === "all";

  return {
    ...config,
    deploy: {
      react: wantReact && !!config.deploy?.react,
      expo: wantExpo && !!config.deploy?.expo,
    },
  };
}

/**
 * Run the full pipeline for a target template:
 *   - reconcile each target's dependencies with the packages src/ imports, so
 *     adding a library in an authoring file is enough to get it installed
 *   - sync root files into the target template(s) via the route-aware
 *     connectors (src/@app -> App.tsx / app/index.tsx, src/@components ->
 *     components/*, src/@pages -> pages/* or expo-router routes, etc.)
 *   - start only the target's dev server (`dev` -> react, `start` -> expo)
 *   - start file watchers for live reload, scoped to the target template
 *
 * Order matters: the dependency pass updates the root package.json bundles, and
 * the config connector regenerates each template's package.json from them.
 * Running them the other way round would erase every discovered dependency.
 *
 * @param {object} options - { target: "react" | "expo" | "all" }
 */
function runAll({ target = "all" } = {}) {
  const config = loadConfig();
  const scoped = scopedConfig(config, target);

  syncDependencies(scoped);

  syncConnectors(scoped);

  // Start only the target's dev server (non-blocking)
  if (scoped.deploy?.react) runDev();
  if (scoped.deploy?.expo) runStart();

  // Start file watchers for live reload
  startWatchers(scoped);

  const label = target === "all" ? "all templates" : `template/${target}`;
  console.log(`[runner] Started ${label} servers and watchers.`);
}

module.exports = {
  runDev,
  runStart,
  startWatchers,
  runAll,
  resolveTarget,
  scopedConfig,
  syncDependencies,
};

// Allow `node script/runner/index.js` to run directly.
if (require.main === module) {
  runAll({ target: resolveTarget() });
}
