/**
 * deps/versions.js — target map and version resolution.
 *
 * A leaf module so both the reconciliation pass (deps/index.js) and the
 * explicit `rexpo install` path (deps/add.js) can use it without requiring
 * each other.
 */

const fs = require("fs");
const path = require("path");

/** Targets, and the platform each one generates for. */
const TARGETS = {
  react: "web",
  expo: "native",
};

/** Template folder names, in the order they are reported. */
const TEMPLATE_NAMES = Object.keys(TARGETS);

/** True when `name` is a known target. */
function isTarget(name) {
  return Object.prototype.hasOwnProperty.call(TARGETS, name);
}

/**
 * The version range prefix to write for a package.
 *
 * Expo SDK packages are versioned in lockstep with the SDK, so `~` is what
 * `expo install` writes and `^` would drift off the SDK. Everything else gets
 * the usual caret range.
 */
function rangePrefix(pkg) {
  if (pkg === "expo" || pkg.startsWith("expo-")) return "~";
  if (pkg === "react-native" || pkg.startsWith("react-native-")) return "~";
  return "^";
}

/**
 * Find a concrete version for `pkg`.
 *
 * 1. Whatever the other target already declares (keeps the two in step).
 * 2. An installed copy in either template, which reports the exact version on
 *    disk rather than a guess.
 *
 * @returns {string|null} a range like `^1.2.3`, or null when nothing is known.
 */
function resolveVersion(pkg, packageRoot, otherEntry) {
  const declared = otherEntry?.dependencies?.[pkg] || otherEntry?.devDependencies?.[pkg];
  if (declared) return declared;

  for (const template of TEMPLATE_NAMES) {
    const manifest = path.join(
      packageRoot,
      "template",
      template,
      "node_modules",
      pkg,
      "package.json"
    );
    if (!fs.existsSync(manifest)) continue;

    try {
      const { version } = JSON.parse(fs.readFileSync(manifest, "utf-8"));
      if (version) return `${rangePrefix(pkg)}${version}`;
    } catch {
      // Unreadable manifest — fall through to the next hint.
    }
  }

  return null;
}

module.exports = {
  TARGETS,
  TEMPLATE_NAMES,
  isTarget,
  rangePrefix,
  resolveVersion,
};
