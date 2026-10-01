/**
 * exec.js — the one way doctor starts a subprocess.
 *
 * `status` is the only signal that matters to a check, and both stdout and
 * stderr end up in the detail text, so the wrapper returns one trimmed string.
 */

const { spawnSync } = require("child_process");

/**
 * Run a command, returning { ok, output }.
 *
 * @param {string} command
 * @param {string[]} args
 * @param {string} cwd
 * @returns {{ok: boolean, output: string}}
 */
function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: "utf-8" });
  return {
    ok: result.status === 0,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim(),
  };
}

module.exports = { run };
