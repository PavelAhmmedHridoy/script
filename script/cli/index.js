#!/usr/bin/env node
/**
 * cli/index.js — the `rexpo` command.
 *
 *   rexpo install                        auto-detect what src/ imports, reconcile
 *                                        the bundles, then install in each template
 *   rexpo install <pkg>                  auto-detect the target(s) and add the package
 *   rexpo install <pkg> --next           web target only
 *   rexpo install <pkg> --expo           native target only
 *   rexpo install <pkg> --next --expo    both targets
 *   rexpo install <pkg>@1.2.3            pin a version
 *   rexpo install <pkg> --no-install     edit the manifests only
 *
 *   rexpo dev                            start the web target (Vite)
 *   rexpo start                          start the native target (Metro)
 *   rexpo all                            start both
 *   rexpo deps                           dependency reconciliation only
 *   rexpo sync                           regenerate both templates, no servers
 *
 * `--next` is the web target and `--expo` is the native one (aliases: `--web`,
 * `--react` and `--native`, `--app`).
 *
 * This file only dispatches. The parser is ./args.js, the text is ./usage.js,
 * and each command is a module under ./commands/.
 */

const { parse, splitPin } = require("./args");
const { USAGE } = require("./usage");
const { cmdInstall, refreshManifests } = require("./commands/install");
const { runServers } = require("./commands/servers");
const { cmdDeps, cmdSync } = require("./commands/maintenance");
const { cmdDoctor } = require("./commands/doctor");
const { PACKAGE_ROOT, scopeDeploy } = require("./config");

/**
 * Dispatch argv to a command.
 *
 * @param {string[]} [argv] - defaults to the process arguments
 * @returns {number} exit code
 */
function main(argv = process.argv.slice(2)) {
  const { positionals } = parse(argv);
  const command = positionals[0];

  if (!command || command === "help" || argv.includes("--help") || argv.includes("-h")) {
    console.log(USAGE);
    return 0;
  }

  switch (command) {
    case "install":
      return cmdInstall(argv.slice(1));

    case "dev":
    case "start":
    case "all":
      return runServers(command);

    case "deps":
      return cmdDeps();

    case "sync":
      return cmdSync(argv.slice(1));

    case "doctor":
      return cmdDoctor();

    default:
      console.error(`[rexpo] Unknown command: ${command}`);
      console.log(USAGE);
      return 1;
  }
}

module.exports = {
  main,
  cmdInstall,
  refreshManifests,
  parse,
  splitPin,
  scopeDeploy,
  PACKAGE_ROOT,
  USAGE,
};

if (require.main === module) {
  process.exitCode = main();
}
