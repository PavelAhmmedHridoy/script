/**
 * checks/typecheck.js — check 5: `tsc --noEmit` per template.
 *
 * The two templates are typechecked with different projects: the web template
 * splits app and node configs, the Expo template is a single tsconfig. Running
 * the template's own local tsc keeps doctor off the network.
 */

const fs = require("fs");
const path = require("path");
const { run } = require("../exec");
const { ok, warn, fail } = require("../results");

/** How many lines of compiler output to keep. */
const MAX_LINES = 8;

/** The local typescript binary, if the template has one installed. */
function tscPath(templateDir) {
  const bin = path.join(templateDir, "node_modules", "typescript", "bin", "tsc");
  return fs.existsSync(bin) ? bin : null;
}

/** The arguments each template's tsc needs. */
function tscArgs(template) {
  return template === "react" ? ["--noEmit", "-p", "tsconfig.app.json"] : ["--noEmit"];
}

/**
 * @param {string} template - "react" | "expo"
 * @param {string} templateDir
 * @returns {Array} a single ok/warn/fail entry
 */
function checkTypecheck(template, templateDir) {
  const tsc = tscPath(templateDir);
  if (!tsc) return [warn("typecheck", "typescript not installed — skipping")];

  const { ok: passed, output } = run(process.execPath, [tsc, ...tscArgs(template)], templateDir);
  if (passed) return [ok("typecheck", "clean")];

  return [fail("typecheck", output.split("\n").slice(0, MAX_LINES).join("\n"))];
}

module.exports = { checkTypecheck, tscPath, tscArgs };
