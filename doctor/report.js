/**
 * report.js — turn check results into terminal output and an exit code.
 */

/** Icon per level, padded so the labels line up. */
const ICON = { ok: "ok  ", warn: "warn", fail: "FAIL" };

/**
 * Fold results into totals.
 *
 * @param {Array} results
 * @returns {{results: Array, failed: number, warned: number}}
 */
function summarise(results) {
  const failed = results.filter((result) => result.level === "fail").length;
  const warned = results.filter((result) => result.level === "warn").length;
  return { results, failed, warned };
}

/**
 * Print a report.
 *
 * @param {{results: Array, failed: number, warned: number}} summary
 * @returns {number} 1 when any check failed, 0 otherwise (warnings do not fail)
 */
function report({ results, failed, warned }) {
  console.log("rexpo doctor\n");

  for (const { level, check, detail } of results) {
    console.log(`  [${ICON[level]}] ${check}`);
    if (detail) {
      for (const line of String(detail).split("\n")) console.log(`         ${line}`);
    }
  }

  console.log(
    `\n  ${results.length - failed - warned} passed, ${warned} warning(s), ${failed} failure(s)`
  );

  if (failed > 0) {
    console.log(
      "\n  Fix the failures above before bundling — these are the errors Metro\n" +
        "  shows as a stalled progress bar instead of a message."
    );
  }

  return failed > 0 ? 1 : 0;
}

module.exports = { summarise, report };
