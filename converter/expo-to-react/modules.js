/**
 * converter/expo-to-react/modules.js — the reverse module table (native → web).
 *
 * Inverse of the forward package mapping rules (`packageMappings` maps web ->
 * native for the native target; this maps native -> web), plus the two
 * always-on pairs: native primitives exist for web under the same
 * `react-native` name (react-native-web rewrites them away), and expo-router's
 * Link exists on web through `react-router-dom`.
 *
 * Consumed by `./transform.js` (the web pass) and by `deps/scan.js`, which
 * mirrors the web direction so dependency scanning reports what the web target
 * actually ships. The forward table lives in
 * `../react-to-expo/modules.js`; the rewriting engine is shared (`../modules.js`).
 */

const { loadConfig } = require("../modules");

/**
 * The reverse (native -> web) table.
 *
 * @param {object} [packageMappings] - rexpo.config.js's packageMappings
 * @param {string} [packageRoot]
 * @returns {object} specifier -> specifier
 */
function buildReverseMappingTable(packageMappings, packageRoot) {
  const configured =
    packageMappings ?? loadConfig(packageRoot).packageMappings ?? {};
  const table = {
    "react-native": "react-native",
    "expo-router": "react-router-dom",
  };

  for (const [web, native] of Object.entries(configured)) {
    if (web && native && web !== native) table[native] = web;
  }
  return table;
}

module.exports = {
  buildReverseMappingTable,
};
