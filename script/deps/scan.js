/**
 * deps/scan.js — find the external packages an authoring tree actually uses.
 *
 * Two things make this more than a regex sweep over `src/`:
 *
 * 1. Each target is scanned from the content that will *actually* be generated
 *    for it, with the platform macros already resolved. A package imported
 *    inside a `useWeb(...)` block is therefore not demanded by the native
 *    target, and the authoring-only macro import is already gone by then.
 *
 * 2. Internal specifiers are shielded: relative paths, path aliases, node
 *    built-ins, and anything under `script/` (the generator's own source tree)
 *    can never be reported as a package, so they can never be written into a
 *    template's package.json as if they were an npm dependency.
 */

const fs = require("fs");
const path = require("path");
const { builtinModules } = require("module");
const { applyPlatformBlocks } = require("../converter/platform-blocks");
const { packageNameOf } = require("../converter/imports");
const { rewriteModuleSpecifiers } = require("../converter/modules");
const { buildForwardMappingTable } = require("../converter/react-to-expo/modules");

/** Extensions scanned inside the authoring folders. */
const SOURCE_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

/** Everything Node itself provides — never a dependency to install. */
const BUILTINS = new Set([
  ...builtinModules,
  ...builtinModules.map((name) => `node:${name}`),
]);

/** Path aliases that point inside the project. */
const INTERNAL_ALIAS_PREFIXES = ["@/", "~/", "#"];

/** URL-ish specifiers that no package manager can resolve. */
const URL_PREFIXES = ["http:", "https:", "data:", "file:"];

/**
 * Is this specifier internal to the project, i.e. something that must never be
 * written into package.json?
 *
 * @param {string} spec - Raw import specifier
 * @returns {boolean}
 */
function isInternalSpecifier(spec) {
  if (!spec) return true;

  // Relative or absolute path
  if (spec.startsWith(".") || spec.startsWith("/")) return true;

  // Path alias into the template root
  if (INTERNAL_ALIAS_PREFIXES.some((prefix) => spec.startsWith(prefix))) return true;

  // Provided by the runtime
  if (spec.startsWith("node:") || BUILTINS.has(spec)) return true;

  // Not something a registry can serve
  if (URL_PREFIXES.some((prefix) => spec.startsWith(prefix))) return true;

  // The generator's own tooling tree. `script/authoring/platform` lands here,
  // which is what keeps the macro shim out of every template's dependencies.
  if (spec === "script" || spec.startsWith("script/")) return true;
  if (spec.startsWith("@script/")) return true; // the same tree, aliased
  if (/(?:^|\/)authoring\/platform$/.test(spec)) return true;

  return false;
}

/** Patterns that pull a specifier out of source text. */
const SPECIFIER_PATTERNS = [
  // `import x from "y"`, `export { x } from "y"` (also catches `import type`)
  /\bfrom\s*["']([^"']+)["']/g,
  // `import("y")`
  /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  // `require("y")`
  /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
  // Side-effect import: `import "y"`
  /^[ \t]*import\s*["']([^"']+)["']/gm,
];

/**
 * Extract every module specifier mentioned in `content`.
 * @returns {Set<string>}
 */
function extractSpecifiers(content) {
  const specs = new Set();

  for (const pattern of SPECIFIER_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(content))) specs.add(match[1]);
  }

  return specs;
}

/** Yield every source file under `dir`. */
function* walkSourceFiles(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;

    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkSourceFiles(full);
    } else if (SOURCE_EXT.has(path.extname(entry.name).toLowerCase())) {
      yield full;
    }
  }
}

/**
 * Native-only specifiers the web transform eliminates, and the package the
 * web target receives in expo-router's place. Mirrors the converter's web
 * pass, so the scan reports what each platform actually ships.
 */
const WEB_NATIVE_ONLY_RE = /^react-native(\/.*)?$/;
const WEB_ROUTER_MAP = { "expo-router": "react-router-dom" };

/**
 * Collect the external packages used by an authoring tree, for one platform.
 *
 * @param {string} packageRoot - Project root
 * @param {string[]} dirs - Folders to scan, relative to the root
 * @param {"web"|"native"} platform - Platform whose output is being scanned
 * @param {object} [packageMappings] - so native reports the mapped name
 *   (`moti`) rather than the web original (`framer-motion`), matching what the
 *   converter actually emits
 * @returns {Set<string>} package names, e.g. `{"react", "@expo/vector-icons"}`
 */
function collectPackages(packageRoot, dirs, platform, packageMappings) {
  const packages = new Set();
  const mappings = platform === "native" ? buildForwardMappingTable(packageMappings) : null;

  for (const dir of dirs) {
    const abs = path.join(packageRoot, dir);
    if (!fs.existsSync(abs)) continue;

    for (const file of walkSourceFiles(abs)) {
      let content;
      try {
        content = fs.readFileSync(file, "utf-8");
      } catch {
        continue;
      }

      // Scan what this platform will actually receive: platform macros first,
      // then the module auto-detection the converter applies to native.
      let effective = applyPlatformBlocks(content, platform, () => {});
      if (mappings) effective = rewriteModuleSpecifiers(effective, mappings);

      for (const spec of extractSpecifiers(effective)) {
        if (isInternalSpecifier(spec)) continue;

        if (platform === "web") {
          // The web pass prunes native-only imports outright.
          if (WEB_NATIVE_ONLY_RE.test(spec)) continue;
          // expo-router's web equivalent comes from the reverse mapping.
          const pkg = packageNameOf(spec);
          if (WEB_ROUTER_MAP[pkg]) {
            packages.add(WEB_ROUTER_MAP[pkg]);
            continue;
          }
        }

        packages.add(packageNameOf(spec));
      }
    }
  }

  return packages;
}

module.exports = {
  collectPackages,
  extractSpecifiers,
  isInternalSpecifier,
  packageNameOf,
  walkSourceFiles,
  BUILTINS,
  SOURCE_EXT,
};
