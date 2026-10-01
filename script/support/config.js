/**
 * config.js — the one place that reads rexpo.config.js.
 *
 * There used to be four copies of this loader (CLI, runner, watcher, per-runner
 * scripts) with three different fallbacks — including a default web port of
 * 7689 that contradicted the 7681 in rexpo.config.js. One loader, one default.
 */

const path = require("path");
const { PACKAGE_ROOT } = require("./paths");

/**
 * Used when rexpo.config.js is missing or unreadable, and merged under a
 * config that only sets some keys. Values mirror rexpo.config.js.
 */
const DEFAULT_CONFIG = {
  deploy: { react: true, expo: true },
  ports: { web: 7681, expo: 8081 },
  deps: {},
  monitor: { debounceMs: 150 },
};

/**
 * Read rexpo.config.js from `packageRoot`, merged over DEFAULT_CONFIG so call
 * sites can dereference `config.ports.web` without a second guess at defaults.
 *
 * @param {string} [packageRoot]
 * @returns {object}
 */
function loadConfig(packageRoot = PACKAGE_ROOT) {
  try {
    const loaded = require(path.join(packageRoot, "rexpo.config.js"));
    return { ...DEFAULT_CONFIG, ...(loaded ?? {}) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

module.exports = { loadConfig, DEFAULT_CONFIG };
