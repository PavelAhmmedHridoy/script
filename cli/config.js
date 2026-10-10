/**
 * config.js — CLI-side view of the project: root, config, target scoping.
 */

const { PACKAGE_ROOT: REPO_ROOT, resolvePackageRoot } = require("../support/paths");
const { loadConfig: readConfig } = require("../support/config");

/**
 * Project root. Defaults to the repository this CLI lives in; `REXPO_ROOT`
 * overrides it, which lets the CLI be pointed at another checkout (and gives
 * the tests a project to work on without touching this one).
 */
const PACKAGE_ROOT = resolvePackageRoot();

/** Load rexpo.config.js for the CLI's project root. */
function loadConfig() {
  return readConfig(PACKAGE_ROOT);
}

/**
 * Narrow config.deploy to the requested targets, so an install flag also
 * scopes which template manifests get touched.
 *
 * @param {object} config - rexpo.config.js
 * @param {string[]} requested - target names, empty for "all enabled"
 * @returns {{react: boolean, expo: boolean}}
 */
function scopeDeploy(config, requested) {
  if (requested.length === 0) return config.deploy ?? { react: true, expo: true };

  return {
    react: requested.includes("react"),
    expo: requested.includes("expo"),
  };
}

module.exports = { PACKAGE_ROOT, REPO_ROOT, loadConfig, scopeDeploy };
