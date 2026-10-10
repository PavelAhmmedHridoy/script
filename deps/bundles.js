/**
 * deps/bundles.js — read and persist each target's dependency config.
 *
 * A leaf module shared by the reconciliation pass and `rexpo install`, so both
 * write the same place.
 *
 * Which place: `package.react` / `package.expo` when such a file exists, and
 * otherwise the `react` / `expo` entry inside the root `package.json`. The
 * template is regenerated from whichever one wins, so a discovered dependency
 * has to be written there rather than into a template — where the next sync
 * would erase it.
 */

const fs = require("fs");
const path = require("path");
const {
  readBundle,
  readTargetConfig,
  targetConfigName,
  targetConfigPath,
  bundleEntryJson,
} = require("../connector/[config]");
const { TEMPLATE_NAMES } = require("./versions");
const { writeIfChanged } = require("../io");

/**
 * Load the root manifest and each target's entry.
 *
 * @returns {{rootPackage: object, entries: object, sources: object, file: string}|null}
 *   `sources[template]` names the file an entry came from (`package.expo` or
 *   `package.json`). null when there is nothing in either form.
 */
function readRootBundle(packageRoot) {
  const file = path.join(packageRoot, "package.json");

  if (!fs.existsSync(file)) return null;

  let rootPackage;
  try {
    rootPackage = JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch (err) {
    console.warn(`[deps] package.json is not valid JSON (${err.message}), skipping.`);
    return null;
  }

  const entries = {};
  const sources = {};

  for (const template of TEMPLATE_NAMES) {
    const resolved = readTargetConfig("package.json", template, packageRoot);
    if (!resolved) continue;
    entries[template] = resolved.entry;
    sources[template] = resolved.source;
  }

  // Neither per-target files nor bundle keys: nothing to reconcile.
  if (Object.keys(entries).length === 0) return null;

  return { rootPackage, entries, sources, file };
}

/**
 * Write mutated entries back to wherever each one came from: a per-target file
 * if it exists, else the bundle entry in the root package.json (touching only
 * the `react` / `expo` keys, so the rest of the manifest is left as it was).
 *
 * @returns {string[]} the paths written, relative to `packageRoot`
 */
function persistBundles(rootPackage, entries, packageRoot) {
  const written = [];
  let touchedBundle = false;

  for (const template of TEMPLATE_NAMES) {
    const entry = entries[template];
    if (!entry) continue;

    if (fs.existsSync(targetConfigPath("package.json", template, packageRoot))) {
      const targetFile = targetConfigName("package.json", template);
      if (writeIfChanged(path.join(packageRoot, targetFile), bundleEntryJson(entry))) {
        written.push(targetFile);
      }
      continue;
    }

    rootPackage[template] = [entry];
    touchedBundle = true;
  }

  if (
    touchedBundle &&
    writeIfChanged(path.join(packageRoot, "package.json"), `${JSON.stringify(rootPackage, null, 2)}\n`)
  ) {
    written.push("package.json");
  }

  return written;
}

/** True when the package is already declared in any dependency field. */
function isDeclared(entry, pkg) {
  return Boolean(
    entry?.dependencies?.[pkg] ||
      entry?.devDependencies?.[pkg] ||
      entry?.peerDependencies?.[pkg]
  );
}

/** Add `pkg` at `version` to the entry's dependencies. */
function declare(entry, pkg, version) {
  entry.dependencies = entry.dependencies ?? {};
  entry.dependencies[pkg] = version;
}

module.exports = {
  readRootBundle,
  persistBundles,
  isDeclared,
  declare,
};
