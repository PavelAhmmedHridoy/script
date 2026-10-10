/**
 * converter/react-to-expo/index.js — the react → expo direction.
 *
 * Everything the native pass owns, in one require path: the module table that
 * maps web packages to their native equivalents, the tag tables that map HTML
 * elements to RN components, the prop rewrites those elements need, the JSX
 * walk that applies them, and the assembled pipeline.
 *
 * `../transform.js` is the dispatcher: connectors keep requiring `../converter`
 * and hand `directionOptions(source, template)` (../direction.js) to
 * `convertFile`, and the direction that runs follows from the authoring
 * dialect vs. the template — never from this folder being required directly.
 */

const { applyReactNativeTransform } = require("./transform");
const { buildForwardMappingTable } = require("./modules");
const {
  RN_PACKAGE,
  COMPONENT_PACKAGE,
  TAG_MAP,
  PRESSABLE_REPLACEMENTS,
  NEEDS_TEXT_WRAPPER,
  INPUT_TYPE_MAP,
} = require("./tags");
const { readTag, isNodeTag, TAG_NAME_RE } = require("../jsx/read");

module.exports = {
  applyReactNativeTransform,
  buildForwardMappingTable,
  RN_PACKAGE,
  COMPONENT_PACKAGE,
  TAG_MAP,
  PRESSABLE_REPLACEMENTS,
  NEEDS_TEXT_WRAPPER,
  INPUT_TYPE_MAP,
  // The shared JSX reader, re-exported so a consumer of the direction gets
  // everything the old `converter/jsx.js` surface exposed.
  readTag,
  isNodeTag,
  TAG_NAME_RE,
};
