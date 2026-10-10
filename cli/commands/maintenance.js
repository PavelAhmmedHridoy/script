/**
 * commands/maintenance.js — `rexpo deps` and `rexpo sync`.
 *
 * `deps` reconciles the root bundles from what src/ imports. `sync` regenerates
 * the templates from those bundles without starting a server — and, with
 * `--from-template`, runs the same routes backwards and copies a template's
 * files back into the root.
 */

const { syncDependencies, targetsFromFlags } = require("../../deps");
const { TEMPLATE_NAMES } = require("../../deps/versions");
const { syncConnectors } = require("../../connector");
const { pullTemplates } = require("../../connector/pull");
const { parse } = require("../args");
const { PACKAGE_ROOT, loadConfig, scopeDeploy } = require("../config");

/** `rexpo deps` — reconcile the dependency bundles only. */
function cmdDeps() {
  const { added, unresolved } = syncDependencies(loadConfig(), PACKAGE_ROOT);
  const addedCount = Object.values(added).reduce((total, list) => total + list.length, 0);
  const unresolvedCount = Object.values(unresolved).reduce((total, list) => total + list.length, 0);

  console.log(
    `[rexpo] ${addedCount} added, ${unresolvedCount} unresolved, ` +
      `${addedCount === 0 ? "already in sync" : "bundles written"}.`
  );
  return 0;
}

/**
 * `rexpo sync [--next|--expo] [--from-template]`
 *
 * Forward (default): regenerate the requested targets — or every enabled one —
 * from the root, converted. Inverse (`--from-template`): copy that template's
 * files back into the root, verbatim, so a broken root file can be recovered
 * from the last generated copy.
 *
 * @param {string[]} argv - arguments after the `sync` command
 * @returns {number} exit code
 */
function cmdSync(argv = []) {
  const { flags } = parse(argv);
  const targets = targetsFromFlags(flags);
  const config = loadConfig();

  if (flags.has("from-template") || flags.has("pull")) {
    const templates = targets.length
      ? targets
      : TEMPLATE_NAMES.filter((template) => config.deploy?.[template]);

    if (templates.length === 0) {
      console.log("[rexpo] No target enabled, nothing to pull.");
      return 0;
    }

    pullTemplates(templates, PACKAGE_ROOT);
    return 0;
  }

  syncConnectors({ ...config, deploy: scopeDeploy(config, targets) });
  return 0;
}

module.exports = { cmdDeps, cmdSync };
