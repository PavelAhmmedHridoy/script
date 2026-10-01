/**
 * converter/expo-to-react/transform.js — the expo → react direction.
 *
 * The web-target mirror of the react → expo pipeline, for source authored in
 * native primitives (`source.expo: true`). The forward pass rewrites DOM tags
 * to `react-native` components on the native target; this one rewrites
 * `react-native` imports and component tags back to DOM on the web target, so
 * one authoring file deploys to both without hand-maintained copies.
 *
 * Order matters, as on the native side:
 *
 * 1. Module rewriting (`./modules.js`) — native specifiers become their web
 *    equivalents, so later passes only see specifiers valid for this platform.
 * 2. Authoring imports (`../aliases.js`) — the same per-target specifier
 *    rewrite the native side runs.
 * 3. The tag pass (`./jsx.js`) — RN components become DOM tags, `onPress`
 *    becomes `onClick`.
 * 4. Import pruning (`./prune-imports.js`) — the imports the tags no longer
 *    need are removed last, so the generated file stays lint-clean.
 *
 * Consumed by `../transform.js`, which owns the whole pipeline and dispatches
 * a target to the direction it needs.
 */

const { rewriteModuleSpecifiers } = require("../modules");
const { rewriteAuthoringImports } = require("../aliases");
const { warnUnmapped } = require("../warn");
const { rewriteTagsToDom, rewriteOnPressToOnClick } = require("./jsx");
const { buildReverseMappingTable } = require("./modules");
const { pruneUnusedImports } = require("./prune-imports");

/**
 * The expo → react passes: native packages and components become web ones.
 *
 * @param {string} content
 * @param {object} [packageMappings] - rexpo.config.js's packageMappings
 * @param {number} [depth] - destination depth for authoring-relative imports
 * @returns {string}
 */
function applyWebTransform(content, packageMappings, depth = 0) {
  const reverseTable = buildReverseMappingTable(packageMappings);

  let out = rewriteModuleSpecifiers(content, reverseTable);

  // Same per-target specifier rewrite as the native side.
  out = rewriteAuthoringImports(out, depth);

  const { content: domOut, unmapped } = rewriteTagsToDom(out);
  out = rewriteOnPressToOnClick(domOut);

  warnUnmapped(unmapped, "native-only component(s) kept as-is for web");

  return pruneUnusedImports(out, reverseTable);
}

module.exports = { applyWebTransform };
