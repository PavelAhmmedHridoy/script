#!/usr/bin/env node
/**
 * generate-readme-reference.js — keep the CLI README's command reference in
 * step with `rexpo help`.
 *
 * The USAGE string in ./usage.js is the source of truth for the CLI's
 * commands, flags and examples. Hand-copying it into README.md lets the two
 * drift, so this splices it verbatim between markers:
 *
 *   <!-- BEGIN GENERATED: cli-usage -->
 *   ...the help text...
 *   <!-- END GENERATED: cli-usage -->
 *
 * Re-run after editing usage.js:
 *
 *   node script/cli/generate-readme-reference.js
 *
 * The write goes through io.writeIfChanged, so re-running on an up-to-date
 * README is a no-op. Exits 1 when the markers are missing, so a README
 * rewrite that dropped them is caught rather than silently skipped.
 */

const fs = require("fs");
const path = require("path");
const { USAGE } = require("./usage");
const { writeIfChanged } = require("../io");

const README_PATH = path.join(__dirname, "README.md");
const BEGIN = "<!-- BEGIN GENERATED: cli-usage -->";
const END = "<!-- END GENERATED: cli-usage -->";

/** The section exactly as it should appear between the markers. */
function renderSection() {
  return `${BEGIN}\n\n\`\`\`\n${USAGE}\n\`\`\`\n\n${END}`;
}

/**
 * Splice the current help text into README.md.
 * @returns {number} exit code
 */
function main() {
  const readme = fs.readFileSync(README_PATH, "utf-8");

  const beginAt = readme.indexOf(BEGIN);
  const endAt = readme.indexOf(END);

  if (beginAt === -1 || endAt === -1 || endAt < beginAt) {
    console.error(
      "[cli/readme] script/cli/README.md is missing its " +
        "<!-- BEGIN GENERATED: cli-usage --> / <!-- END GENERATED: cli-usage --> " +
        "markers — nothing to update. Re-add them and re-run."
    );
    return 1;
  }

  const updated =
    readme.slice(0, beginAt) + renderSection() + readme.slice(endAt + END.length);

  if (writeIfChanged(README_PATH, updated)) {
    console.log("[cli/readme] README command reference updated from usage.js.");
  } else {
    console.log("[cli/readme] README command reference already up to date.");
  }
  return 0;
}

module.exports = { main, renderSection, BEGIN, END };

if (require.main === module) {
  process.exitCode = main();
}
