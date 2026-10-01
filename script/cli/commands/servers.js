/**
 * commands/servers.js — `rexpo dev` / `rexpo start` / `rexpo all`.
 *
 * All three are the same pipeline (`runner/index.js` syncs the target
 * template(s), starts the matching dev server, and watches for edits); they
 * differ only in which target they scope to.
 */

const { runAll } = require("../../runner");

/** Target each server command scopes the pipeline to. */
const TARGETS = {
  dev: "react",
  start: "expo",
  all: "all",
};

/**
 * Start the dev server(s) for a server command.
 *
 * @param {"dev"|"start"|"all"} command
 * @returns {number} exit code (always 0 — the runner reports its own failures)
 */
function runServers(command) {
  runAll({ target: TARGETS[command] ?? "all" });
  return 0;
}

module.exports = { runServers, TARGETS };
