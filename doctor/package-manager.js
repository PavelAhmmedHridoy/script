/**
 * package-manager.js — which package manager a template expects, and whether
 * it can actually be executed.
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

/** Lockfiles that tell us which package manager a template expects. */
const LOCKFILE_MANAGERS = [
  ["pnpm-lock.yaml", "pnpm"],
  ["package-lock.json", "npm"],
  ["yarn.lock", "yarn"],
  ["bun.lockb", "bun"],
  ["bun.lock", "bun"],
];

/**
 * Which package manager a template expects: its own lockfile first, then
 * rexpo.config.js's `package.support`.
 *
 * @param {string} templateDir
 * @param {object} config - rexpo.config.js
 * @returns {{pm: string, why: string}}
 */
function effectivePackageManager(templateDir, config) {
  for (const [lockfile, pm] of LOCKFILE_MANAGERS) {
    if (fs.existsSync(path.join(templateDir, lockfile))) return { pm, why: lockfile };
  }

  const declared = config?.package?.support;
  return declared ? { pm: declared, why: "package.support" } : { pm: "npm", why: "default" };
}

/**
 * Probe whether a package manager can actually be executed.
 *
 * A binary can sit on PATH, be flagged executable, and still fail: the kernel
 * resolves its shebang, which is often `#!/usr/bin/env node`. On Termux that
 * path does not exist, so `spawn("pnpm")` fails with ENOENT and the error
 * surfaces far from here as `Error: spawn pnpm ENOENT` inside another tool.
 *
 * @param {string} pm
 * @returns {{ok: boolean, version?: string, detail?: string}}
 */
function probePackageManager(pm) {
  const result = spawnSync(pm, ["--version"], { encoding: "utf-8" });

  if (result.error) {
    const detail =
      result.error.code === "ENOENT"
        ? "`" + pm + "` is on PATH but cannot be executed (ENOENT). On Termux this " +
          "usually means its shebang points at /usr/bin/env, which does not exist. " +
          "Fix it with `termux-fix-shebang $(command -v " + pm + ")`, or remove this " +
          "template's lockfile so npm is used instead."
        : result.error.message;
    return { ok: false, detail };
  }

  if (result.status !== 0) {
    const line = (result.stderr || result.stdout || "").trim().split("\n")[0];
    return { ok: false, detail: line || `\`${pm} --version\` exited ${result.status}` };
  }

  return { ok: true, version: (result.stdout || "").trim() };
}

module.exports = { effectivePackageManager, probePackageManager, LOCKFILE_MANAGERS };
