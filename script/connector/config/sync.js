/**
 * connector/config/sync.js — writing configs out, and the per-target sweep.
 *
 * Two callers write a template config: this connector, and the dependency pass
 * the moment it changes the root bundle. Both go through writeBundleEntry so a
 * template's manifest is refreshed immediately rather than sitting out of step
 * until the next full sync.
 */

const path = require("path");
const { writeIfChanged } = require("../../io");
const {
  TARGETS,
  BUNDLES,
  readTargetConfig,
  targetConfigName,
  bundleEntryJson,
} = require("./bundle");
const { MAPPINGS, copyFile } = require("./plain");
const { excludesFor, isExcluded, syncSpecialFiles } = require("./special");

/**
 * Write a bundle entry out as the target's own config file, only when its
 * content changed.
 *
 * Unchanged content must not be rewritten: metro.config.js and babel.config.js
 * live here, and a needless write makes Metro announce "Detected a change in
 * metro.config.js. Restart the server", drop its transform cache, and restart a
 * bundle that was already in flight.
 */
function writeJson(dest, value, label) {
  try {
    const wrote = writeIfChanged(dest, bundleEntryJson(value));
    if (wrote) console.log(`[connector/config] ${label}`);
  } catch (err) {
    console.error(`[connector/config] Failed to write ${label}: ${err.message}`);
  }
}

/**
 * Write one bundle entry out as that target's own config file.
 *
 * Exported so the dependency pass can refresh a template's package.json the
 * moment it changes the root bundle, instead of leaving the two out of step
 * until the next full sync.
 *
 * @param {string} template - "react" or "expo"
 * @param {object} entry - the bundle entry for that target
 * @param {string} packageRoot - Project root
 * @param {string} [fileName] - defaults to package.json
 */
function writeBundleEntry(template, entry, packageRoot, fileName = "package.json") {
  const relDest = path.join("template", template, fileName);
  writeJson(
    path.join(packageRoot, relDest),
    entry,
    `${fileName} (${template}) -> ${relDest}`
  );
}

/**
 * Sync config files into every enabled template.
 *
 * Bundles first — the template needs a manifest before anything can install
 * into it — then the plain copies that template owns, minus the files the
 * user excluded for that target, then the user's own special files.
 *
 * @param {object} config - rexpo.config.js
 * @param {string} packageRoot - Project root
 */
function sync(config, packageRoot) {
  for (const template of TARGETS) {
    if (!config.deploy?.[template]) continue;

    const excludes = excludesFor(config, template);

    for (const fileName of BUNDLES) {
      const resolved = readTargetConfig(fileName, template, packageRoot);

      if (!resolved) {
        console.warn(
          `[connector/config] no "${template}" entry for ${fileName} ` +
            `(looked for ${targetConfigName(fileName, template)}, then the bundle), skipping.`
        );
        continue;
      }

      writeBundleEntry(template, resolved.entry, packageRoot, fileName);
    }

    for (const mapping of MAPPINGS[template] ?? []) {
      // The user's exclude list wins over the built-in copy table: excluding
      // "vite.config.ts" for expo is how a template stops receiving a file
      // it has no use for.
      if (isExcluded(mapping.from, excludes)) continue;
      copyFile(packageRoot, mapping);
    }

    syncSpecialFiles(config, template, packageRoot);
  }
}

module.exports = { sync, writeBundleEntry, writeJson };
