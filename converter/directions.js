/**
 * converter/directions.js — the two conversion directions, under one barrel.
 *
 * A direction is everything a target's pass owns that the other target does
 * not: its module table, its tag tables, its prop rewrites, its JSX walk, and
 * the pipeline that orders them.
 *
 *   react-to-expo/   source authored in React (HTML tags, web packages)
 *                    generated onto the native template
 *   expo-to-react/   source authored in native primitives (View/Text/onPress)
 *                    generated onto the web template
 *
 * Which direction runs for a file is not chosen here — it comes from
 * `rexpo.config.js`'s `source` compared with the template being generated;
 * see direction.js. This module only keeps the two folders a single require
 * path, the way `converter/index.js` does for the whole converter.
 */

// react -> expo: the native pass.
const {
  applyReactNativeTransform,
} = require("./react-to-expo/transform");
const {
  buildForwardMappingTable,
  FORWARD_BUILT_IN_MAPPINGS,
} = require("./react-to-expo/modules");
const {
  RN_PACKAGE,
  COMPONENT_PACKAGE,
  TAG_MAP,
  PRESSABLE_REPLACEMENTS,
  NEEDS_TEXT_WRAPPER,
  INPUT_TYPE_MAP,
} = require("./react-to-expo/tags");

// expo -> react: the web pass.
const { applyWebTransform } = require("./expo-to-react/transform");
const { buildReverseMappingTable } = require("./expo-to-react/modules");
const { pruneUnusedImports } = require("./expo-to-react/prune-imports");
const { DOM_OF } = require("./expo-to-react/tags");

module.exports = {
  // react -> expo
  applyReactNativeTransform,
  buildForwardMappingTable,
  FORWARD_BUILT_IN_MAPPINGS,
  RN_PACKAGE,
  COMPONENT_PACKAGE,
  TAG_MAP,
  PRESSABLE_REPLACEMENTS,
  NEEDS_TEXT_WRAPPER,
  INPUT_TYPE_MAP,

  // expo -> react
  applyWebTransform,
  buildReverseMappingTable,
  pruneUnusedImports,
  DOM_OF,
};
