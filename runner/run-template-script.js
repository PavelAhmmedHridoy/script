/**
 * run-template-script.js — spawn `<pm> <script>` inside a template folder.
 *
 * dev.js (Vite) and start.js (Metro) differ only in their port, args and
 * environment; the package-manager fallback, the template existence checks and
 * the exit reporting are the same for both and live here once.
 *
 * `stdio: "inherit"` is deliberate: a dev server owns the terminal, so its
 * output (and its Ctrl-C) must pass straight through.
 */

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const { PACKAGE_ROOT } = require("../support/paths");
const { detectPackageManager } = require("../support/package-manager");

// npm only lets you invoke these four script names bare (`npm start`,
// `npm test`, ...) — anything else needs the explicit `npm run <script>`
// form, or npm reports "Unknown command". pnpm/yarn/bun don't have this
// restriction, so this only affects the npm branch below.
const NPM_BARE_COMMANDS = new Set(["start", "stop", "test", "restart"]);

/**
 * Build the argv to hand to `spawn(pm, ...)` for running `script` with
 * `args` inside a template.
 *
 * - Strips an accidentally-doubled "run " prefix from `script` (e.g. a
 *   config value of "run dev" instead of "dev"), so a misconfigured
 *   rexpo.config.js script name doesn't turn into "npm run run dev" —
 *   or worse, get passed to npm as one single unrecognized argument.
 * - Uses `run <script>` for npm unless the script is one of the few names
 *   npm runs bare; pnpm/yarn/bun can always run a script name directly.
 * - Always inserts `--` before extra args. Without it, npm treats flags
 *   like `--port` as its own (unrecognized) CLI options and drops them —
 *   which is why `expo start` was seeing a bare positional "8081" instead
 *   of `--port 8081`.
 *
 * @param {string} pm
 * @param {string} script
 * @param {string[]} args
 * @returns {string[]}
 */
function buildArgv(pm, script, args) {
  const cleanScript = script.replace(/^run\s+/, "").trim();

  const base =
    pm === "npm" && !NPM_BARE_COMMANDS.has(cleanScript)
      ? ["run", cleanScript]
      : [cleanScript];

  return args.length ? [...base, "--", ...args] : base;
}

/**
 * @param {object} options
 * @param {string} options.prefix - log prefix, e.g. "[runner/dev]"
 * @param {string} options.template - "react" | "expo"
 * @param {string} options.script - the template script to run
 * @param {string[]} [options.args] - extra argv for the script
 * @param {string} [options.url] - appended to the "Running" line
 * @param {object} [options.env] - environment for the child (defaults to ours)
 * @param {string|null} [options.packageManager]
 * @returns {import("child_process").ChildProcess|false} false when the
 *   template is not runnable, so the caller can report a skipped target
 */
function runTemplateScript({
  prefix,
  template,
  script,
  args = [],
  url,
  env = process.env,
  packageManager = detectPackageManager(),
}) {
  let pm = packageManager;

  if (!pm) {
    console.warn(`${prefix} No package manager detected. Falling back to npm.`);
    pm = "npm";
  }

  const templateDir = path.join(PACKAGE_ROOT, "template", template);

  if (!fs.existsSync(templateDir)) {
    console.warn(`${prefix} template/${template} folder not found, skipping.`);
    return false;
  }
  if (!fs.existsSync(path.join(templateDir, "package.json"))) {
    console.warn(`${prefix} template/${template} has no package.json, skipping.`);
    return false;
  }

  const argv = buildArgv(pm, script, args);
  const commandLabel = `${pm} ${argv.join(" ")}`;

  console.log(`${prefix} Running "${commandLabel}"${url ? ` on ${url}` : ""} ...`);

  const child = spawn(pm, argv, {
    cwd: templateDir,
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  child.on("error", (err) => {
    console.error(`${prefix} Failed to start: ${err.message}`);
  });

  child.on("close", (code) => {
    if (code !== 0) {
      console.error(`${prefix} "${commandLabel}" exited with code ${code}.`);
    }
  });

  return child;
}

module.exports = { runTemplateScript, buildArgv };
