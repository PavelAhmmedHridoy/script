/**
 * deps/index.js — package self-healing.
 *
 * Reconciles the root package.json bundles with the packages the authoring tree
 * actually imports, so adding a library in `src/` is enough to get it into both
 * targets.
 *
 * ## Why it writes the root bundle, not the templates
 *
 * [config].js regenerates each template's package.json from the root `react` /
 * `expo` bundle entries on every sync. Writing a discovered dependency straight
 * into a template would therefore be erased by the next run. The bundle is the
 * source of truth, so that is what gets updated — and the templates pick the
 * change up when the connectors run immediately afterwards.
 *
 * ## Platform mapping
 *
 * `packageMappings` in rexpo.config.js is applied per target, so importing
 * `lucide-react` adds `lucide-react` to the web bundle and
 * `lucide-react-native` to the native one. The scan reads what each platform
 * will actually receive, so native reports the mapped name the converter emits.
 *
 * ## Safety
 *
 * - Only `dependencies` are ever added; existing entries are never rewritten or
 *   removed, and no other key in the file is touched.
 * - Internal specifiers (relative paths, aliases, node built-ins, and anything
 *   under `script/`) are shielded in deps/scan.js and cannot become a package.
 * - A version is only guessed from something concrete: the other target's
 *   declaration, or an installed copy on disk. Failing both, the entry is
 *   reported instead of being written blind, unless `allowUnknownVersions` is
 *   set.
 * - The whole pass is idempotent: a second run finds nothing missing.
 *
 * Explicitly installing a package (`rexpo install <pkg>`) is a different,
 * narrower path — see deps/add.js.
 */

const path = require("path");
const { collectPackages } = require("./scan");
const { TARGETS, TEMPLATE_NAMES, rangePrefix, resolveVersion } = require("./versions");
const { readRootBundle, persistBundles, isDeclared, declare } = require("./bundles");
const { targetConfigName } = require("../connector/[config]");

const PACKAGE_ROOT = path.resolve(__dirname, "..", "..");

const DEFAULT_SETTINGS = {
  /** Reconcile the bundles at all. */
  autoAdd: true,
  /** Folders to scan, relative to the project root. */
  scanDirs: ["src"],
  /** Write an entry with the `latest` tag when no version can be determined. */
  allowUnknownVersions: false,
};

/** Merge user settings over the defaults. */
function resolveSettings(config) {
  return { ...DEFAULT_SETTINGS, ...(config?.deps ?? {}) };
}

/**
 * Reconcile one target's bundle entry with the packages its platform uses.
 *
 * @returns {{added: Array<{pkg:string, version:string}>, unresolved: Array<{pkg:string, importedAs:string}>}}
 */
function syncTarget({ template, entry, otherEntry, config, settings, packageRoot }) {
  const platform = TARGETS[template];
  const mappings = config?.packageMappings ?? {};

  const imported = collectPackages(packageRoot, settings.scanDirs, platform, mappings);
  const added = [];
  const unresolved = [];

  for (const pkg of [...imported].sort()) {
    // Web imports its package as-is; native swaps in the mapped equivalent.
    const target = platform === "native" ? mappings[pkg] ?? pkg : pkg;

    if (isDeclared(entry, target)) continue;

    const version = resolveVersion(target, packageRoot, otherEntry);

    if (!version && !settings.allowUnknownVersions) {
      unresolved.push({ pkg: target, importedAs: pkg });
      continue;
    }

    declare(entry, target, version ?? "latest");
    added.push({ pkg: target, version: version ?? "latest" });
  }

  return { added, unresolved };
}

/**
 * Reconcile every enabled template's bundle with the authoring imports.
 *
 * Must run BEFORE the connectors, which regenerate each template's
 * package.json from the bundles this function updates.
 *
 * @param {object} config - rexpo.config.js
 * @param {string} [packageRoot] - Project root
 * @returns {{added: object, unresolved: object}}
 */
function syncDependencies(config, packageRoot = PACKAGE_ROOT) {
  const settings = resolveSettings(config);
  const result = { added: {}, unresolved: {} };

  if (!settings.autoAdd) return result;

  const bundle = readRootBundle(packageRoot);
  if (!bundle) {
    // A plain package.json (no per-target entries) is not something to heal.
    return result;
  }

  const entries = {};
  for (const template of TEMPLATE_NAMES) {
    if (!config.deploy?.[template]) continue;
    if (bundle.entries[template]) entries[template] = bundle.entries[template];
  }

  let changed = false;

  for (const template of Object.keys(entries)) {
    const otherTemplate = Object.keys(entries).find((t) => t !== template);
    const { added, unresolved } = syncTarget({
      template,
      entry: entries[template],
      otherEntry: otherTemplate ? entries[otherTemplate] : null,
      config,
      settings,
      packageRoot,
    });

    if (added.length > 0) {
      changed = true;
      result.added[template] = added;
      for (const { pkg, version } of added) {
        console.log(`[deps] ${template}: added ${pkg}@${version}`);
      }
    }

    if (unresolved.length > 0) {
      result.unresolved[template] = unresolved;
      for (const { pkg, importedAs } of unresolved) {
        console.warn(
          `[deps] ${template}: "${pkg}" is imported` +
            (importedAs === pkg ? "" : ` (as "${importedAs}")`) +
            ` but no version could be determined — add it to \`${targetConfigName("package.json", template)}\`` +
            ` (or the package.json "${template}" entry) by hand, or run: rexpo install ${importedAs}`
        );
      }
    }
  }

  if (changed) {
    const written = persistBundles(bundle.rootPackage, entries, packageRoot);
    if (written.length > 0) console.log(`[deps] wrote ${written.join(", ")}.`);
  }

  return result;
}

module.exports = {
  syncDependencies,
  resolveSettings,
  resolveVersion,
  rangePrefix,
  DEFAULT_SETTINGS,
  TARGETS,
  TEMPLATE_NAMES,
  readRootBundle,
  persistBundles,
  isDeclared,
  ...require("./add"),
};

// Allow `node script/deps/index.js` to run the pass directly.
if (require.main === module) {
  const configPath = path.join(PACKAGE_ROOT, "rexpo.config.js");
  let config;
  try {
    config = require(configPath);
  } catch {
    config = { deploy: { react: true, expo: true }, deps: {} };
  }

  const { added, unresolved } = syncDependencies(config);
  const totalAdded = Object.values(added).reduce((n, list) => n + list.length, 0);
  const totalUnresolved = Object.values(unresolved).reduce((n, list) => n + list.length, 0);

  console.log(
    `[deps] ${totalAdded} added, ${totalUnresolved} unresolved, ${totalAdded === 0 ? "already in sync" : "bundles written"}.`
  );
}
