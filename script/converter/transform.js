/**
 * converter/transform.js — the pipeline, and which direction a target runs.
 *
 * `transform()` is the whole pipeline for a single file, in the one order that
 * works:
 *
 * 1. Platform macros (converter/platform-blocks.js) — resolves `useWeb` /
 *    `useApp` / `classWeb` / `classApp` for the target being generated. Runs
 *    for BOTH targets, because a web build has to drop native-only blocks too.
 *    See that file for the full contract.
 *
 * 2. The direction pass — the one thing that differs per target, and the whole
 *    reason this tool exists. Each direction is a folder of its own:
 *
 *      converter/react-to-expo/   web packages + HTML tags -> native
 *                                 (`applyReactNativeTransform`)
 *      converter/expo-to-react/   native packages + components -> web
 *                                 (`applyWebTransform`)
 *
 *    Which of them runs — if either — is the *direction*: the dialect `source`
 *    declares compared with the template being generated. See
 *    converter/direction.js for that decision; the connectors resolve it from
 *    `rexpo.config.js` and hand it in through the options below.
 *
 * 3. The same-dialect fallback — a target whose dialect already matches the
 *    source converts nothing, but the authoring folders still have to become
 *    the template's (`../@components/Card` -> `../components/Card`) at this
 *    destination's depth: that rewrite belongs to no direction in particular.
 *
 * Reading and writing the file is converter/run.js's job; this module is pure
 * content in, content out, which is what makes a pass testable on its own.
 */

const path = require("path");
const { applyPlatformBlocks } = require("./platform-blocks");
const { rewriteAuthoringImports } = require("./aliases");
const { applyReactNativeTransform } = require("./react-to-expo/transform");
const { applyWebTransform } = require("./expo-to-react/transform");
const { setCurrentSource } = require("./warn");

/** JavaScript / TypeScript source extensions. */
const JS_EXT = new Set([".tsx", ".ts", ".jsx", ".js", ".mjs", ".cjs"]);

/**
 * Transform file content based on its type.
 *
 * @param {string} content - File content
 * @param {string} srcPath - Source file path (used for the extension)
 * @param {object} options
 * @param {"web"|"native"} [options.platform] - Target platform; defaults to
 *   "native" when applyRNTransform is set, "web" otherwise.
 * @param {boolean} [options.applyRNTransform=true] - Apply the RN transform
 * @param {boolean} [options.useWebTransform] - Force the native->web pass on
 *   (`true`) or off (`false`); omitted keeps the content heuristic below
 * @param {object} [options.packageMappings] - Override rexpo.config.js's
 *   mappings for this conversion.
 * @param {function} [options.transform] - Connector hook run last
 * @param {string} [options.dest] - Destination path, passed to the hook
 * @returns {string} Transformed content
 */
function transform(content, srcPath, options = {}) {
  const {
    applyRNTransform = true,
    useWebTransform,
    transform: hook,
    dest,
    depth = 0,
  } = options;
  const platform = options.platform || (applyRNTransform ? "native" : "web");
  const ext = path.extname(srcPath).toLowerCase();
  let out = content;

  if (JS_EXT.has(ext)) {
    // Both targets need this: web drops useApp blocks just as native drops
    // useWeb blocks. It also removes the authoring-only macro import.
    out = applyPlatformBlocks(out, platform);
  }

  if (JS_EXT.has(ext) && applyRNTransform) {
    // react -> expo (the direction folder decides how the conversion runs).
    out = applyReactNativeTransform(out, options.packageMappings, depth);
  } else if (JS_EXT.has(ext) && needsWebTransform(out, useWebTransform)) {
    // expo -> react: web target carrying native-authored code, re-tagged to
    // DOM so it runs in a browser instead of dying on the react-native import.
    out = applyWebTransform(out, options.packageMappings, depth);
  } else if (JS_EXT.has(ext)) {
    // Same dialect on both sides: tags and modules are already valid for this
    // target, but the authoring folders still have to become the template's
    // (`../@components/Card` -> `../components/Card`) at this destination's
    // depth — that rewrite belongs to no direction in particular.
    out = rewriteAuthoringImports(out, depth);
  }

  if (ext === ".css" && platform === "web") {
    // Tailwind v4 is CSS-first: the v3 `@tailwind` directives are not valid.
    out = out.replace(/@tailwind\s+(?:base|components|utilities|variants)\s*;?\r?\n?/g, "");
    out = out.replace(/\n{3,}/g, "\n\n");
  }

  return hook ? hook(out, { src: srcPath, dest, applyRNTransform, platform, ext }) : out;
}

/**
 * Decide whether the web pass must run. `forced` is tri-state: the connectors
 * resolve the direction from `source` and pass `true` (convert) or `false`
 * (do not) for a declared source mode, while an undeclared/ambiguous one
 * leaves it undefined and the content itself decides — native-authored means
 * a quoted react-native / expo-router specifier (maskCode makes
 * rewriteModuleSpecifiers ignore prose hits, so a false positive is
 * harmless). After the pass runs the specifiers are gone, so the heuristic is
 * also what makes a second run a no-op.
 *
 * @param {string} content
 * @param {boolean} [forced]
 * @returns {boolean}
 */
function needsWebTransform(content, forced) {
  if (forced === true) return true;
  if (forced === false) return false;
  return /["'](react-native|expo-router)["']/.test(content);
}

module.exports = {
  transform,
  needsWebTransform,
  applyReactNativeTransform,
  applyWebTransform,
  setCurrentSource,
  JS_EXT,
};
