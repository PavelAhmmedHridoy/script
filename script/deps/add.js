/**
 * deps/add.js — add a package to the target(s) that need it.
 *
 * Backs `rexpo install <package>`. When no target flag is given the target is
 * auto-detected, in order of how trustworthy the signal is:
 *
 *   1. Where the package is actually imported. Scans src/ the same way the
 *      converter does — per platform, post-macros — so a package used only
 *      inside a `useWeb` block is web-only. This covers the usual flow of
 *      writing the import first and installing afterwards.
 *   2. `packageMappings`. A mapped *value* (`moti`) is native; a mapped *key*
 *      (`framer-motion`) is the web original and needs both, since the native
 *      side gets the mapped equivalent.
 *   3. Name heuristics — `expo-*`, `react-native*`, `@expo/*` are native;
 *      `react-dom`, `vite`, `tailwindcss`, `next` are web.
 *   4. Unknown packages go into both, because this is one codebase targeting
 *      two platforms and a missing dependency is worse than an extra one.
 *
 * The root bundle is updated and the affected template manifests are rewritten
 * immediately, so the two never sit out of step waiting for the next sync.
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { detectPackageManager } = require("../install");
const { writeBundleEntry } = require("../connector/[config]");
const { collectPackages } = require("./scan");
const { TARGETS, TEMPLATE_NAMES, isTarget, resolveVersion } = require("./versions");
const { readRootBundle, persistBundles, isDeclared, declare } = require("./bundles");

const PACKAGE_ROOT = path.resolve(__dirname, "..", "..");

/** CLI flag -> target. `--next` is the web target, `--expo` the native one. */
const TARGET_FLAGS = {
  react: "react",
  web: "react",
  next: "react",
  expo: "expo",
  native: "expo",
  app: "expo",
  mobile: "expo",
};

/** Packages that only make sense on native. */
const NATIVE_HINTS = [
  /^expo(?:-|$)/,
  /^react-native(?:-|$)/,
  /^@react-native(?:-|\/)/,
  /^@expo\//,
  /^@react-navigation\//,
  /^@shopify\/react-native/,
  /^nativewind$/,
  /^react-native-css-interop$/,
];

/** Packages that only make sense on web. */
const WEB_HINTS = [
  /^react-dom$/,
  /^next$/,
  /^vite$/,
  /^@vitejs\//,
  /^@tailwindcss\//,
  /^tailwindcss$/,
  /^postcss$/,
  /^autoprefixer$/,
  /^framer-motion$/,
  /^lucide-react$/,
  /^react-router(?:-dom)?$/,
];

/**
 * Map CLI flags to targets.
 * @param {Iterable<string>} flags - e.g. ["expo"], with or without `--`
 * @returns {string[]} target names, deduped
 */
function targetsFromFlags(flags = []) {
  const targets = new Set();

  for (const flag of flags) {
    const key = String(flag).toLowerCase().replace(/^--/, "");
    if (TARGET_FLAGS[key]) targets.add(TARGET_FLAGS[key]);
  }

  return [...targets];
}

/**
 * Which targets should this package be installed into?
 * @param {string} pkg
 * @param {object} config - rexpo.config.js
 * @param {string} [packageRoot]
 * @returns {string[]}
 */
function detectTargets(pkg, config = {}, packageRoot = PACKAGE_ROOT) {
  const mappings = config.packageMappings ?? {};
  const scanDirs = config.deps?.scanDirs ?? ["src"];

  // 1. Where is it imported?
  const usedIn = TEMPLATE_NAMES.filter((template) =>
    collectPackages(packageRoot, scanDirs, TARGETS[template], mappings).has(pkg)
  );

  if (usedIn.length > 0) {
    // The native side imports the mapped name, so a web original needs both.
    if (mappings[pkg] && !usedIn.includes("expo")) return ["react", "expo"];
    return usedIn;
  }

  // 2. The mapping table knows which side a package belongs to.
  if (Object.prototype.hasOwnProperty.call(mappings, pkg)) return ["react", "expo"];
  if (Object.values(mappings).includes(pkg)) return ["expo"];

  // 3. Name heuristics.
  if (NATIVE_HINTS.some((re) => re.test(pkg))) return ["expo"];
  if (WEB_HINTS.some((re) => re.test(pkg))) return ["react"];

  // 4. Unknown — install into both.
  return ["react", "expo"];
}

/**
 * Run the detected package manager inside the given templates.
 * @returns {Array<{template: string, ok: boolean}>}
 */
function installInto(templates, packageRoot) {
  const pm = detectPackageManager() ?? "npm";
  const results = [];

  for (const template of templates) {
    const dir = path.join(packageRoot, "template", template);
    if (!fs.existsSync(path.join(dir, "package.json"))) continue;

    console.log(`[deps] running "${pm} install" in template/${template} ...`);
    const result = spawnSync(pm, ["install"], {
      cwd: dir,
      stdio: "inherit",
      shell: process.platform === "win32",
    });

    results.push({ template, ok: result.status === 0 });
  }

  return results;
}

/**
 * Add a package to the bundle(s) that need it.
 *
 * @param {string} pkg - Package name
 * @param {object} [options]
 * @param {string[]} [options.targets] - Explicit targets; inferred when omitted
 * @param {object} [options.config] - rexpo.config.js
 * @param {string} [options.packageRoot]
 * @param {string} [options.version] - Pin a version instead of resolving one
 * @param {boolean} [options.install=false] - Run the package manager afterwards
 * @returns {{pkg:string, targets:string[], added:Array, alreadyPresent:Array, installed:Array|null}}
 */
function addPackage(pkg, options = {}) {
  const {
    targets,
    config = {},
    packageRoot = PACKAGE_ROOT,
    version,
    install = false,
  } = options;

  if (!pkg) throw new Error("addPackage requires a package name");

  const bundle = readRootBundle(packageRoot);
  if (!bundle) {
    throw new Error(
      "package.json is missing or not in bundle format — expected `react` and `expo` entries."
    );
  }

  const requested = targets && targets.length ? targets : detectTargets(pkg, config, packageRoot);
  const unknown = requested.filter((target) => !isTarget(target));
  if (unknown.length > 0) throw new Error(`Unknown target: ${unknown.join(", ")}`);

  const wanted = [...new Set(requested)];
  const mappings = config.packageMappings ?? {};
  const added = [];
  const alreadyPresent = [];

  for (const template of wanted) {
    const entry = bundle.entries[template];
    if (!entry) continue;

    const platform = TARGETS[template];
    // A native target takes the mapped equivalent of a web original.
    const name = platform === "native" && mappings[pkg] ? mappings[pkg] : pkg;

    if (isDeclared(entry, name)) {
      alreadyPresent.push({ target: template, name });
      continue;
    }

    const other = TEMPLATE_NAMES.find((t) => t !== template);
    const resolved =
      version ??
      resolveVersion(name, packageRoot, other ? bundle.entries[other] : null) ??
      "latest";

    declare(entry, name, resolved);
    added.push({ target: template, name, version: resolved });
  }

  if (added.length > 0) {
    persistBundles(bundle.rootPackage, bundle.entries, packageRoot);

    // Refresh the template manifests straight away.
    for (const template of wanted) {
      if (bundle.entries[template]) {
        writeBundleEntry(template, bundle.entries[template], packageRoot);
      }
    }
  }

  const installed =
    install && added.length > 0
      ? installInto([...new Set(added.map((item) => item.target))], packageRoot)
      : null;

  return { pkg, targets: wanted, added, alreadyPresent, installed };
}

module.exports = {
  addPackage,
  detectTargets,
  targetsFromFlags,
  installInto,
  TARGET_FLAGS,
  NATIVE_HINTS,
  WEB_HINTS,
};
