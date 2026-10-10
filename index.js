/**
 * script/index.js — main script entry point.
 * Imports the installer from script/install and runs it.
 *
 * Usage:
 *   node script/index.js        # sync + start all enabled templates
 *   node script/index.js dev    # start only the react (web) dev server
 *   node script/index.js start  # start only the expo (mobile) server
 */

const { runInstall } = require("./install");
const { runAll, resolveTarget } = require("./runner");

const installOk = runInstall();

console.log(installOk ? "done" : "done (with install errors)");

runAll({ target: resolveTarget() });
console.log("runner done");