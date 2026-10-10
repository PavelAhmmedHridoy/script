/**
 * paths.js — where the project root is.
 *
 * Every folder under script/ used to compute its own root with
 * `path.resolve(__dirname, "..", "..")`, and only the CLI honoured
 * `REXPO_ROOT`. Both facts live here now, so a fixture project can be driven
 * with `REXPO_ROOT=<dir>` and nothing has to guess how deep it sits.
 */

const path = require("path");

/** The checkout this tool ships in: two levels up from script/support. */
const PACKAGE_ROOT = path.resolve(__dirname, "..", "..");

/**
 * Root the current invocation should operate on. `REXPO_ROOT` wins, which is
 * what lets the CLI be pointed at another checkout (fixtures, tests).
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string}
 */
function resolvePackageRoot(env = process.env) {
  return env.REXPO_ROOT ? path.resolve(env.REXPO_ROOT) : PACKAGE_ROOT;
}

module.exports = { PACKAGE_ROOT, resolvePackageRoot };
