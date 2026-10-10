/**
 * commands/doctor.js — `rexpo doctor`.
 *
 * A thin wrapper: the checks and the report live in script/doctor/.
 */

const { runDoctor } = require("../../doctor");
const { PACKAGE_ROOT, loadConfig } = require("../config");

/**
 * Run the preflight checks and print the report.
 *
 * @returns {number} 1 when any check failed, so it drops into CI as-is
 */
function cmdDoctor() {
  return runDoctor(loadConfig(), PACKAGE_ROOT);
}

module.exports = { cmdDoctor };
