/**
 * checks/bundle.js — check 1: the root config sources are readable.
 *
 * Each target's `package.json` / `tsconfig.json` comes from either a per-target
 * file (`package.expo`, `tsconfig.react`, …) or the `react` / `expo` entry in
 * the shared root file. Both forms are valid; a file that is in neither shape is
 * not, because nothing can generate a template from it.
 *
 * Everything else depends on this: the sources are what the templates are
 * generated from, so if `package.json` yields no entries the run stops here.
 *
 * A bundle key that is not a target — and has no per-target file to speak for
 * it — is reported too: it looks like it does something, and it does not.
 */

const fs = require("fs");
const {
  readBundle,
  BUNDLES,
  TARGETS,
  targetConfigName,
  targetConfigPath,
} = require("../../connector/[config]");
const { readRootBundle } = require("../../deps");
const { ok, warn, fail } = require("../results");

/**
 * Bundle keys that are not split into a template (e.g. a stray `app`).
 *
 * Only a non-empty array of objects counts as an entry: an empty array such as
 * package.json's `keywords` is ordinary package metadata, not a target nobody
 * reads.
 */
function unusedBundleKeys(bundle) {
  const looksLikeEntry = (value) =>
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => item && typeof item === "object" && !Array.isArray(item));

  return Object.keys(bundle).filter((key) => !TARGETS.includes(key) && looksLikeEntry(bundle[key]));
}

/** Which targets have their own file for a bundle file name. */
function targetFilesFor(fileName, packageRoot) {
  return TARGETS.filter((template) =>
    fs.existsSync(targetConfigPath(fileName, template, packageRoot))
  );
}

/**
 * @param {string} packageRoot
 * @returns {{entries: Array, bundle: object|null}} `bundle` is null when no
 *   target's package.json can be resolved, which callers treat as fatal
 */
function checkBundles(packageRoot) {
  const entries = [];

  for (const fileName of BUNDLES) {
    const bundle = readBundle(fileName, packageRoot);
    const perTarget = targetFilesFor(fileName, packageRoot);

    if (!bundle && perTarget.length === 0) {
      entries.push(
        fail(
          fileName,
          `no target config found — expected ${targetConfigName(fileName, "react")} / ` +
            `${targetConfigName(fileName, "expo")}, or \`react\` and \`expo\` entries`
        )
      );
      continue;
    }

    if (bundle) {
      entries.push(ok(fileName, "bundle format"));

      const unused = unusedBundleKeys(bundle);
      if (unused.length > 0) {
        entries.push(
          warn(fileName, `unused bundle key(s): ${unused.join(", ")} — only react/expo are split`)
        );
      }
    } else {
      entries.push(ok(fileName, "per-target files only"));
    }

    for (const template of perTarget) {
      entries.push(
        ok(targetConfigName(fileName, template), `per-target config — wins over the \`${template}\` entry`)
      );
    }
  }

  // Downstream checks need the package.json entries (declared dependencies).
  return { entries, bundle: readRootBundle(packageRoot) };
}

module.exports = { checkBundles, unusedBundleKeys, targetFilesFor };
