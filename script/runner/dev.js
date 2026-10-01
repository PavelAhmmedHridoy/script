/**
 * dev.js — runs `dev` inside template/react using the detected package manager.
 */

const { loadConfig } = require("../support/config");
const { detectPackageManager } = require("../support/package-manager");
const { runTemplateScript } = require("./run-template-script");

const PREFIX = "[runner/dev]";

/**
 * Run `<pm> dev` inside template/react.
 *
 * @param {object} [options]
 * @param {string|null} [options.packageManager]
 * @returns {import("child_process").ChildProcess|false} false when the target
 *   is disabled or the template is not runnable
 */
function runDev({ packageManager = detectPackageManager() } = {}) {
  const config = loadConfig();

  if (!config.deploy?.react) {
    console.warn(`${PREFIX} react deploy is disabled in rexpo.config.js, skipping.`);
    return false;
  }

  const port = config.ports?.web ?? 7681;
  const command = config.scripts?.react?.dev ?? "dev";

  return runTemplateScript({
    prefix: PREFIX,
    template: "react",
    script: command,
    // Vite: `--host` so the device/LAN address serves the app too.
    args: ["--port", String(port), "--host"],
    url: `http://localhost:${port}`,
    packageManager,
  });
}

module.exports = { runDev, detectPackageManager };

// Allow `node script/runner/dev.js` to run directly.
if (require.main === module) {
  const ok = runDev();
  process.exitCode = ok ? 0 : 1;
}
