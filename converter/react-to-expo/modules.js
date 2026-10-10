/**
 * converter/react-to-expo/modules.js — the forward module table (web → native).
 *
 * A web-only package cannot be imported on native, so `rexpo.config.js`
 * declares the pairs:
 *
 *   packageMappings: { 'framer-motion': 'moti', 'lucide-react': 'lucide-react-native' }
 *
 * The forward direction rewrites web specifiers to their native equivalents on
 * the expo target, subpath intact:
 *
 *   import { motion } from "framer-motion"        ->  ... from "moti"
 *   export { X } from "react-router-dom"          ->  ... from "expo-router"
 *   const m = await import("lucide-react")        ->  await import("lucide-react-native")
 *   require("framer-motion/animate")              ->  require("moti/animate")
 *
 * This folder owns the forward table — the pair that goes react → expo. The
 * inverse table lives in `../expo-to-react/modules.js`. The rewriting engine
 * itself is shared: `../modules.js`.
 */

const { BUILT_IN_MAPPINGS, loadConfig } = require("../modules");

/** Web-only entry points with a known native equivalent, always applied. */
const FORWARD_BUILT_IN_MAPPINGS = BUILT_IN_MAPPINGS;

/**
 * The forward (web -> native) table: rexpo.config.js's packageMappings, with
 * the built-in pairs for the web-only entry points the React Native transform
 * always knows how to replace. The pass is idempotent: a specifier that has
 * already been mapped is not a key in the table, so a second run is a no-op.
 *
 * @param {object} [packageMappings] - rexpo.config.js's packageMappings
 * @param {string} [packageRoot]
 * @returns {object} specifier -> specifier
 */
function buildForwardMappingTable(packageMappings, packageRoot) {
  const configured = packageMappings ?? loadConfig(packageRoot).packageMappings ?? {};
  const table = { ...FORWARD_BUILT_IN_MAPPINGS };

  for (const [from, to] of Object.entries(configured)) {
    if (from && to && from !== to) table[from] = to;
  }

  return table;
}

module.exports = {
  buildForwardMappingTable,
  FORWARD_BUILT_IN_MAPPINGS,
};
