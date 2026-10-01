/**
 * checks/expo-sdk.js — check 4: the Expo SDK's own compatibility check.
 *
 * `expo install --check` is the "common problem" Expo prints at startup and
 * then refuses to expand. Doctor runs it and keeps the lines that name the
 * expected version, so the output is a command away from a fix.
 */

const fs = require("fs");
const path = require("path");
const { run } = require("../exec");
const { ok, warn, fail } = require("../results");

/** How many output lines to keep when the failure mode is unrecognised. */
const MAX_LINES = 6;

/** Which lines of `expo install --check` name a stale package. */
function outdatedLines(output) {
  return output
    .split("\n")
    .filter((line) => line.trim().startsWith("expo") && line.includes("expected version"))
    .map((line) => line.trim());
}

/**
 * @param {object} config - rexpo.config.js
 * @param {string} packageRoot
 * @returns {Array} zero or one entry (the check only applies to the expo target)
 */
function checkExpoSdk(config, packageRoot) {
  if (!config?.deploy?.expo) return [];

  const expoDir = path.join(packageRoot, "template", "expo");
  const expoBin = path.join(expoDir, "node_modules", ".bin", "expo");

  if (!fs.existsSync(expoBin)) {
    return [warn("expo: SDK compatibility", "expo CLI not installed — run `rexpo install`")];
  }

  const { ok: passed, output } = run(expoBin, ["install", "--check"], expoDir);
  if (passed) {
    return [ok("expo: SDK compatibility", "all packages match the installed SDK")];
  }

  const outdated = outdatedLines(output);

  return [
    fail(
      "expo: SDK compatibility",
      outdated.length > 0
        ? `${outdated.length} package(s) behind the SDK — run:\n      cd template/expo && ./node_modules/.bin/expo install --fix\n${outdated
            .map((line) => `      ${line}`)
            .join("\n")}`
        : output.split("\n").slice(0, MAX_LINES).join("\n")
    ),
  ];
}

module.exports = { checkExpoSdk, outdatedLines };
