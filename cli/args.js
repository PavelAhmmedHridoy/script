/**
 * args.js — argv parsing for the rexpo CLI.
 *
 * Pure string work, no filesystem or config: everything here can be tested by
 * calling it with an array.
 */

/** Every command the CLI knows, used to filter positionals out of installs. */
const COMMANDS = new Set(["install", "dev", "start", "all", "deps", "sync", "doctor", "help"]);

/**
 * Split argv into a flag set and positionals.
 *
 * @param {string[]} argv
 * @returns {{flags: Set<string>, positionals: string[]}}
 */
function parse(argv) {
  const flags = new Set();
  const positionals = [];

  for (const arg of argv) {
    if (arg.startsWith("-")) flags.add(arg.replace(/^--?/, "").toLowerCase());
    else positionals.push(arg);
  }

  return { flags, positionals };
}

/**
 * `pkg@1.2.3` -> { pkg, version }, leaving `@scope/pkg` alone.
 *
 * @param {string} spec
 * @returns {{pkg: string, version: string|undefined}}
 */
function splitPin(spec) {
  const at = spec.lastIndexOf("@");
  if (at <= 0) return { pkg: spec, version: undefined };
  return { pkg: spec.slice(0, at), version: spec.slice(at + 1) };
}

module.exports = { COMMANDS, parse, splitPin };
