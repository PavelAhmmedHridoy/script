/**
 * checks/bundle-files.js — check 2: every generated config still matches the
 * entry it was split from.
 *
 * A target's `package.json` / `tsconfig.json` comes from, in order:
 *
 *   package.expo / tsconfig.expo     a per-target file next to the shared one
 *   package.json / tsconfig.json     its `react` / `expo` bundle entry
 *
 * That source is where all the customisation lives, so the comparison here is
 * byte-for-byte against the very same serializer the writer uses
 * (`bundleEntryJson`) — and the report names which file won. A manifest whose
 * dependencies happen to line up while its scripts, devDependencies or compiler
 * options do not is still drift, and used to pass this check silently.
 *
 * Two failure modes it names: a template edited by hand (or replaced by a fresh
 * scaffold), and a source that changed without a sync afterwards.
 */

const fs = require("fs");
const path = require("path");
const { readTargetConfig, bundleEntryJson, BUNDLES } = require("../../connector/[config]");
const { ok, fail } = require("../results");

/** A short summary of what the generated file holds. */
function entryDetail(entry, fileName, source) {
  const deps = Object.keys(entry.dependencies ?? {}).length;
  const size = fileName === "package.json" && deps > 0 ? `${deps} dependencies` : "byte-identical";
  return `${size} — from ${source}`;
}

/**
 * Compare each bundle file's generated copy in one template.
 *
 * @param {string} packageRoot
 * @param {string} template - "react" | "expo"
 * @returns {{entries: Array, bail: boolean}} `bail` means the template's
 *   package.json is missing or unsourced, so the remaining checks for it are
 *   skipped
 */
function checkBundleFiles(packageRoot, template) {
  const entries = [];
  let bail = false;

  for (const fileName of BUNDLES) {
    const dest = path.join(packageRoot, "template", template, fileName);
    const label = `${fileName} matches bundle`;
    const resolved = readTargetConfig(fileName, template, packageRoot);

    // Neither a per-target file nor a bundle entry: reported by checks/bundle.js.
    if (!resolved) continue;

    if (!fs.existsSync(dest)) {
      entries.push(fail(fileName, "not generated — run `rexpo sync`"));
      if (fileName === "package.json") bail = true;
      continue;
    }

    let actual;
    try {
      actual = fs.readFileSync(dest, "utf-8");
      JSON.parse(actual);
    } catch (err) {
      entries.push(fail(label, `not valid JSON (${err.message})`));
      continue;
    }

    entries.push(
      actual === bundleEntryJson(resolved.entry)
        ? ok(label, entryDetail(resolved.entry, fileName, resolved.source))
        : fail(
            label,
            `differs from \`${resolved.source}\` — run \`rexpo sync\` to regenerate`
          )
    );
  }

  return { entries, bail };
}

module.exports = { checkBundleFiles, entryDetail };
