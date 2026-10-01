/**
 * commands/install.js — `rexpo install [package]`.
 *
 * Two modes, both ending in the same place (the root bundles are the source of
 * truth, the template manifests are regenerated from them):
 *
 *   rexpo install            scan src/, reconcile the bundles, regenerate the
 *                            manifests, then run the package manager
 *   rexpo install <pkg> ...  resolve each package's target(s), add it to the
 *                            bundle, and optionally install
 */

const {
  addPackage,
  syncDependencies,
  targetsFromFlags,
  detectTargets,
  readRootBundle,
} = require("../../deps");
const { TEMPLATE_NAMES } = require("../../deps/versions");
const { writeBundleEntry } = require("../../connector/[config]");
const { installInto } = require("../../deps/add");
const { COMMANDS, parse, splitPin } = require("../args");
const { PACKAGE_ROOT, loadConfig, scopeDeploy } = require("../config");

/** Write the enabled templates' manifests from the (possibly updated) bundle. */
function refreshManifests(deploy, packageRoot = PACKAGE_ROOT) {
  const bundle = readRootBundle(packageRoot);
  if (!bundle) return;

  for (const template of TEMPLATE_NAMES) {
    if (!deploy?.[template]) continue;
    if (bundle.entries[template]) {
      writeBundleEntry(template, bundle.entries[template], packageRoot);
    }
  }
}

/** Count every entry of a `{ target: [...] }` result from the deps pass. */
function countEntries(byTarget) {
  return Object.values(byTarget).reduce((total, list) => total + list.length, 0);
}

/** Reconcile from src/: scan, write the bundles, refresh manifests, install. */
function reconcileAndInstall(config, requested, runPackageManager) {
  const deploy = scopeDeploy(config, requested);

  const { added, unresolved } = syncDependencies({ ...config, deploy }, PACKAGE_ROOT);
  refreshManifests(deploy);

  const addedCount = countEntries(added);
  const unresolvedCount = countEntries(unresolved);

  console.log(
    `[rexpo] detected ${addedCount} new dependenc${addedCount === 1 ? "y" : "ies"}, ` +
      `${unresolvedCount} unresolved.`
  );

  if (!runPackageManager) {
    console.log("[rexpo] --no-install given: manifests updated, packages not installed.");
    return 0;
  }

  const templates = TEMPLATE_NAMES.filter((template) => deploy?.[template]);
  if (templates.length === 0) {
    console.log("[rexpo] No targets enabled, nothing to install.");
    return 0;
  }

  const results = installInto(templates, PACKAGE_ROOT);
  const failed = results.filter((result) => !result.ok);

  if (failed.length > 0) {
    console.error(
      `[rexpo] Install failed in ${failed.map((f) => `template/${f.template}`).join(", ")}.`
    );
    return 1;
  }

  console.log("[rexpo] Done.");
  return 0;
}

/** Add each named package to its target bundle(s), then report. */
function installNamedPackages(packages, requested, config, runPackageManager) {
  let failed = false;

  for (const spec of packages) {
    const { pkg, version } = splitPin(spec);

    let targets = requested.length ? requested : undefined;
    if (!targets) {
      targets = detectTargets(pkg, config, PACKAGE_ROOT);
      console.log(`[rexpo] ${pkg}: auto-detected target(s): ${targets.join(", ")}`);
    }

    try {
      const result = addPackage(pkg, {
        targets,
        config,
        packageRoot: PACKAGE_ROOT,
        version,
        install: runPackageManager,
      });

      for (const item of result.added) {
        console.log(`[rexpo] ${item.target}: added ${item.name}@${item.version}`);
      }
      for (const item of result.alreadyPresent) {
        console.log(`[rexpo] ${item.target}: ${item.name} already present`);
      }
      if (result.added.length === 0 && result.alreadyPresent.length === 0) {
        console.log(`[rexpo] ${pkg}: nothing to do (target not enabled?)`);
      }

      if (result.installed?.some((run) => !run.ok)) failed = true;
    } catch (err) {
      console.error(`[rexpo] ${pkg}: ${err.message}`);
      failed = true;
    }
  }

  return failed ? 1 : 0;
}

/**
 * `rexpo install [package] [...]`
 *
 * @param {string[]} argv - arguments after the `install` command
 * @returns {number} exit code
 */
function cmdInstall(argv) {
  const { flags, positionals } = parse(argv);
  const config = loadConfig();
  const requested = targetsFromFlags(flags);
  const runPackageManager = !flags.has("no-install");
  const packages = positionals.filter((arg) => !COMMANDS.has(arg));

  if (packages.length === 0) {
    return reconcileAndInstall(config, requested, runPackageManager);
  }

  return installNamedPackages(packages, requested, config, runPackageManager);
}

module.exports = { cmdInstall, refreshManifests };
