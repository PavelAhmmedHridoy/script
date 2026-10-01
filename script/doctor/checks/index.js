/**
 * checks/index.js — run every check, in order, and collect the results.
 *
 * Order is deliberate: the bundle format is a precondition for everything else
 * (and stops the run when package.json is unusable), the per-template checks
 * come next because that is where a stalled bundle usually comes from, and the
 * two project-wide checks (Expo SDK compatibility, leaked generator references)
 * close the run.
 */

const { TEMPLATE_NAMES } = require("../../deps/versions");
const { warn } = require("../results");
const { checkBundles } = require("./bundle");
const { checkTemplate } = require("./template");
const { checkExpoSdk } = require("./expo-sdk");
const { checkGeneratedFiles } = require("./generated-files");

/**
 * @param {object} config - rexpo.config.js
 * @param {string} packageRoot
 * @returns {Array} every check entry, in report order
 */
function runChecks(config, packageRoot) {
  const { entries, bundle } = checkBundles(packageRoot);

  const results = [...entries];

  // Nothing below can be evaluated without the root bundle.
  if (!bundle) return results;

  const enabled = TEMPLATE_NAMES.filter((template) => config?.deploy?.[template]);
  if (enabled.length === 0) {
    results.push(warn("targets", "no target is enabled in rexpo.config.js"));
  }

  for (const template of enabled) {
    results.push(...checkTemplate({ config, packageRoot, bundle }, template));
  }

  results.push(...checkExpoSdk(config, packageRoot));
  results.push(...checkGeneratedFiles(packageRoot, enabled));

  return results;
}

module.exports = { runChecks };
