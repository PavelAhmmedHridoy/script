/**
 * converter/modules.js — the shared module-rewriting engine.
 *
 * A web-only package cannot be imported on native, and a native-only one has
 * no business on the web, so `rexpo.config.js` declares the pairs:
 *
 *   packageMappings: { 'framer-motion': 'moti', 'lucide-react': 'lucide-react-native' }
 *
 * Declaring them is not enough — something has to rewrite the import. That is
 * this pass, in the direction a target needs:
 *
 *   react-to-expo   `import { motion } from "framer-motion"`  ->  `from "moti"`
 *   expo-to-react   `import { View } from "react-native"`     ->  (react-native-web)
 *
 * The two mapping tables live with their directions — forward in
 * `react-to-expo/modules.js`, reverse in `expo-to-react/modules.js`; this
 * module is what both of them run: the specifier patterns, the code mask and
 * the edit application. Only module specifiers are touched. `maskCode` rules
 * out a match inside a string or a comment, so prose mentioning a package name
 * is left alone, and the pass is idempotent: a specifier that has already been
 * mapped is not a key in the table, so a second run is a no-op.
 */

const path = require("path");
const { applyEdits, maskCode, packageNameOf } = require("./imports");

/** Web-only entry points with a known native equivalent, always applied. */
const BUILT_IN_MAPPINGS = {
  "react-dom": "react-native",
  "react-dom/client": "react-native",
};

/**
 * Specifier patterns, each capturing the leading code as group 1, the quote as
 * group 2 and the module path as group 3. The specifier always starts at
 * `match.index + group1.length + 1`.
 *
 * The patterns are deliberately distinct — `from "x"` cannot match the
 * side-effect form and vice versa — so no specifier is captured twice.
 */
const SPECIFIER_PATTERNS = [
  /(\bfrom\s*)(["'])([^"']+)\2/g,
  /(\bimport\s*\(\s*)(["'])([^"']+)\2/g,
  /(\brequire\s*\(\s*)(["'])([^"']+)\2/g,
  /(^[ \t]*import\s*)(["'])([^"']+)\2/gm,
];

const PACKAGE_ROOT = path.resolve(__dirname, "..", "..");

/** Cached rexpo.config.js — the module is loaded once per process. */
let cachedConfig;

/** Load rexpo.config.js, falling back to an empty config. */
function loadConfig(packageRoot = PACKAGE_ROOT) {
  if (cachedConfig !== undefined) return cachedConfig;

  try {
    cachedConfig = require(path.join(packageRoot, "rexpo.config.js")) || {};
  } catch {
    cachedConfig = {};
  }

  return cachedConfig;
}

/** Test seam: forget the cached rexpo.config.js. */
function resetConfigCache() {
  cachedConfig = undefined;
}

/**
 * The mapped equivalent of a specifier, or null when it should stay as-is.
 * A subpath is preserved: `lucide-react/icons/x` -> `lucide-react-native/icons/x`.
 */
function resolveMappedSpecifier(spec, table) {
  if (!spec) return null;
  if (table[spec]) return table[spec];

  const pkg = packageNameOf(spec);
  if (pkg !== spec && table[pkg]) return table[pkg] + spec.slice(pkg.length);

  return null;
}

/**
 * Rewrite every module specifier in `content` that has a native equivalent.
 *
 * @param {string} content
 * @param {object} table - specifier -> specifier
 * @param {(from: string, to: string) => void} [onRewrite] - report sink
 * @returns {string}
 */
function rewriteModuleSpecifiers(content, table, onRewrite) {
  if (!table || Object.keys(table).length === 0) return content;

  const mask = maskCode(content);
  const edits = [];

  for (const pattern of SPECIFIER_PATTERNS) {
    pattern.lastIndex = 0;
    let match;

    while ((match = pattern.exec(content))) {
      // Inside a comment or a string literal — not a real import.
      if (!mask[match.index]) continue;

      const spec = match[3];
      const mapped = resolveMappedSpecifier(spec, table);
      if (!mapped || mapped === spec) continue;

      const start = match.index + match[1].length + 1;
      edits.push({ start, end: start + spec.length, text: mapped });
      if (onRewrite) onRewrite(spec, mapped);
    }
  }

  if (edits.length === 0) return content;

  // A specifier can only be captured once, but guard anyway.
  const seen = new Set();
  const unique = edits.filter((edit) => {
    if (seen.has(edit.start)) return false;
    seen.add(edit.start);
    return true;
  });

  return applyEdits(content, unique);
}

module.exports = {
  rewriteModuleSpecifiers,
  resolveMappedSpecifier,
  loadConfig,
  resetConfigCache,
  BUILT_IN_MAPPINGS,
  SPECIFIER_PATTERNS,
};
