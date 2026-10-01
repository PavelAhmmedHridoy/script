/**
 * package-manager.js — which package manager launched this process.
 *
 * npm/pnpm/yarn/bun all publish `npm_config_user_agent`, which is the only
 * signal that survives being invoked through a script alias. The logic was
 * copy-pasted into the installer and both runners before this.
 */

/**
 * Detect the package manager that launched this process.
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {"pnpm"|"yarn"|"bun"|"npm"|null} null when launched by hand
 *   (`node script/...`), where the caller decides the fallback.
 */
function detectPackageManager(env = process.env) {
  const userAgent = env.npm_config_user_agent || "";
  if (userAgent.startsWith("pnpm")) return "pnpm";
  if (userAgent.startsWith("yarn")) return "yarn";
  if (userAgent.startsWith("bun")) return "bun";
  if (userAgent.startsWith("npm")) return "npm";
  return null;
}

module.exports = { detectPackageManager };
