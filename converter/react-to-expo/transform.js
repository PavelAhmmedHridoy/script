/**
 * converter/react-to-expo/transform.js — the react → expo direction.
 *
 * The native-only passes, in the one order that works, for a target generated
 * from source authored in React (DOM elements and web packages):
 *
 * 1. Module rewriting (`./modules.js`) — web specifiers become their
 *    `packageMappings` equivalents, so later passes only ever see specifiers
 *    that are valid for this platform.
 * 2. Authoring imports (`../aliases.js`) — `../@components/Card` becomes the
 *    per-target specifier at this destination's depth.
 * 3. The tag pass (`./jsx.js`) — HTML tags become RN components, `onClick`
 *    becomes `onPress`, text children get wrapped in `<Text>`.
 * 4. Import injection (`../imports.js`) — the components the tag pass used are
 *    merged into the existing import blocks, last so it knows what to add.
 *
 * Consumed by `../transform.js`, which owns the whole pipeline and dispatches
 * a target to the direction it needs.
 */

const path = require("path");
const { injectImports } = require("../imports");
const { rewriteModuleSpecifiers } = require("../modules");
const { rewriteAuthoringImports } = require("../aliases");
const { warnUnmapped } = require("../warn");
const { rewriteTags } = require("./jsx");
const { buildForwardMappingTable } = require("./modules");
const { COMPONENT_PACKAGE, RN_PACKAGE } = require("./tags");

/**
 * The react → expo passes: web packages and HTML tags become native ones.
 *
 * @param {string} content
 * @param {object} [packageMappings] - rexpo.config.js's packageMappings
 * @param {number} [depth] - destination depth for authoring-relative imports
 * @returns {string}
 */
function applyReactNativeTransform(content, packageMappings, depth = 0) {
  let out = rewriteModuleSpecifiers(content, buildForwardMappingTable(packageMappings));

  // Authoring specifiers (`../@components/Card`) become per-target ones
  // (`../components/Card` at the destination's depth) before tags are
  // rewritten, so import statements read like the template's own.
  out = rewriteAuthoringImports(out, depth);

  const { content: jsxOut, used, unmapped } = rewriteTags(out);
  out = jsxOut;

  warnUnmapped(unmapped, "HTML tag(s) with no React Native mapping kept as-is");

  // Also catches handlers written outside JSX (object literals, etc.).
  out = out.replace(/\bonClick\b/g, "onPress");

  const needed = new Map();
  for (const component of used) {
    const source = COMPONENT_PACKAGE[component] || RN_PACKAGE;
    if (!needed.has(source)) needed.set(source, new Set());
    needed.get(source).add(component);
  }

  return injectImports(out, needed);
}

module.exports = { applyReactNativeTransform };
