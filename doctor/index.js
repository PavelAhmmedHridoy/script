/**
 * doctor/index.js — terminal-side preflight for `rexpo doctor`.
 *
 * The point is to catch in the terminal what would otherwise surface as a
 * stalled or half-finished bundle on a device or emulator. Metro reporting
 * "99% (1745/1746)" and never finishing is the failure mode this exists to
 * replace with a named, actionable error.
 *
 * Checks, all offline:
 *
 *   1. Each target's config has a source: a per-target file   checks/bundle.js
 *      (`package.expo`, `tsconfig.react`, …) or the `react` /
 *      `expo` bundle entry in the shared root file — and no
 *      bundle key no target reads.
 *   2. Each template's generated configs still match that        checks/bundle-files.js
 *      source byte for byte (a template edited by hand,
 *      replaced by a fresh scaffold, or a sync that never ran).
 *   3. Every dependency a template declares is actually         checks/dependencies.js
 *      installed, and the installed version satisfies the
 *      declared range.
 *   4. The Expo SDK's own compatibility check.                  checks/expo-sdk.js
 *   5. TypeScript, per template.                                checks/typecheck.js
 *   6. No build-time macro or generator path leaked into a      checks/generated-files.js
 *      generated file.
 *
 * Exit code is 0 when clean, 1 when any check failed. Warnings do not fail.
 */

const { runChecks } = require("./checks");
const { summarise, report } = require("./report");
const { satisfies, parseRange } = require("./ranges");
const { effectivePackageManager, probePackageManager } = require("./package-manager");

/**
 * Run every check and collect the results.
 *
 * @param {object} config - rexpo.config.js
 * @param {string} packageRoot
 * @returns {{results: Array, failed: number, warned: number}}
 */
function diagnose(config, packageRoot) {
  return summarise(runChecks(config, packageRoot));
}

/**
 * Run the checks and print the report.
 *
 * @returns {number} process exit code
 */
function runDoctor(config, packageRoot) {
  return report(diagnose(config, packageRoot));
}

module.exports = {
  runDoctor,
  diagnose,
  report,
  satisfies,
  parseRange,
  effectivePackageManager,
  probePackageManager,
};

// Allow `node script/doctor/index.js` to run the checks directly.
if (require.main === module) {
  const { PACKAGE_ROOT } = require("../support/paths");
  const { loadConfig } = require("../support/config");
  process.exitCode = runDoctor(loadConfig(), PACKAGE_ROOT);
}
