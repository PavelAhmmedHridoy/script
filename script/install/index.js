/**
 * install/index.js — installs dependencies inside the bundled templates
 * (template/react and template/expo) using the same package manager that was
 * used to run this tool (npm, pnpm, yarn or bun).
 *
 * Both templates declare their own dependencies, so both are installed
 * separately; a template that does not exist yet is skipped rather than
 * treated as a failure, because the connectors create it on the next sync.
 */

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { PACKAGE_ROOT } = require("../support/paths");
const { detectPackageManager } = require("../support/package-manager");

/** Template folders the installer triggers in. */
const TEMPLATE_DIRS = ["template/react", "template/expo"];

/**
 * Run `<pm> install` inside every template folder.
 *
 * @param {object} [options]
 * @param {string} [options.cwd] - project root holding template/*
 * @param {string|null} [options.packageManager]
 * @returns {boolean} true when every existing template installed successfully
 */
function installInTemplates({
  cwd = PACKAGE_ROOT,
  packageManager = detectPackageManager(),
} = {}) {
  let pm = packageManager;

  if (!pm) {
    console.warn(
      "[install] No package manager detected (run via npm/pnpm/yarn/bun). Falling back to npm."
    );
    pm = "npm";
  }

  let allOk = true;

  for (const relDir of TEMPLATE_DIRS) {
    const dir = path.resolve(cwd, relDir);

    if (!fs.existsSync(dir)) {
      console.warn(`[install] Skipping ${relDir} (folder not found).`);
      continue;
    }
    if (!fs.existsSync(path.join(dir, "package.json"))) {
      console.warn(`[install] Skipping ${relDir} (no package.json).`);
      continue;
    }

    console.log(`[install] Running "${pm} install" in ${relDir} ...`);
    const result = spawnSync(pm, ["install"], {
      cwd: dir,
      stdio: "inherit",
      shell: process.platform === "win32",
    });

    if (result.status !== 0) {
      console.error(`[install] "${pm} install" failed in ${relDir}.`);
      allOk = false;
    }
  }

  return allOk;
}

/** Kept as a named alias: script/index.js reads `runInstall()`. */
function runInstall(options) {
  return installInTemplates(options);
}

module.exports = { runInstall, detectPackageManager, installInTemplates, TEMPLATE_DIRS };

// Allow `node script/install/index.js` to run the installer directly.
if (require.main === module) {
  process.exitCode = runInstall() ? 0 : 1;
}
