/**
 * connector/resolver/roots.js — central target root calculation.
 *
 * Every subsystem must use these roots instead of hardcoding paths.
 * This is the single source of truth for where each template's files live.
 *
 * Key architectural decision:
 *   - React root: template/react/src  (has a src/ directory)
 *   - Expo root: template/expo       (NO src/ directory — ordinary files
 *     must never become template/expo/src/...)
 *
 * This is why Expo ordinary files go directly under template/expo/components,
 * template/expo/hooks, etc. — not under a non-existent src/.
 */

const path = require("path");

/**
 * The React target root — where ordinary React files land.
 * Example: src/@components/Button.tsx -> template/react/src/components/Button.tsx
 */
const REACT_ROOT = "template/react/src";

/**
 * The Expo target root — where ordinary Expo files land.
 * NO src/ subdirectory — Expo Router reads from the template root.
 * Example: src/@components/Button.tsx -> template/expo/components/Button.tsx
 */
const EXPO_ROOT = "template/expo";

/**
 * Absolute path of the React target root.
 */
function reactRootPath(packageRoot) {
  return path.join(packageRoot, REACT_ROOT);
}

/**
 * Absolute path of the Expo target root.
 */
function expoRootPath(packageRoot) {
  return path.join(packageRoot, EXPO_ROOT);
}

/**
 * Get the target root for a template, as a relative path from packageRoot.
 */
function targetRoot(template) {
  return template === "react" ? REACT_ROOT : EXPO_ROOT;
}

/**
 * Get the absolute target root for a template.
 */
function targetRootPath(packageRoot, template) {
  return template === "react" ? reactRootPath(packageRoot) : expoRootPath(packageRoot);
}

/**
 * Deep relative path from a target root.
 * Used when computing depth for alias rewriting.
 */
function destRelativeToRoot(packageRoot, template, absoluteDest) {
  const root = targetRootPath(packageRoot, template);
  return path.relative(root, absoluteDest);
}

/**
 * Compute how many levels deep a destination is below its target root.
 * This determines the `../` prefix needed for alias rewriting.
 *
 * React:  template/react/src/components/Button.tsx is 1 level deep (components/)
 * Expo:   template/expo/components/Button.tsx is 0 levels deep (root is template/expo)
 */
function destDepth(packageRoot, template, absoluteDest) {
  const rel = destRelativeToRoot(packageRoot, template, absoluteDest);
  const parts = rel.split(path.sep).filter(Boolean);
  return parts.length > 0 ? parts.length - 1 : 0;
}

module.exports = {
  REACT_ROOT,
  EXPO_ROOT,
  reactRootPath,
  expoRootPath,
  targetRoot,
  targetRootPath,
  destRelativeToRoot,
  destDepth,
};
