/**
 * converter/index.js — unified file converter.
 * Converts an authoring source file (src/@xxx) into a target template file.
 *
 * A source file is converted by walking it through a fixed sequence of passes:
 *
 * 1. Platform macros (converter/platform-blocks.js) — `useWeb` / `useApp` /
 *    `classWeb` / `classApp`, resolved for the target being generated.
 * 2. The direction pass — the one thing that differs per target, one folder
 *    per direction:
 *
 *      converter/react-to-expo/   HTML tags and web packages -> native
 *      converter/expo-to-react/   native components and packages -> web
 *
 *    Each folder owns its module table, tag tables, prop rewrites, JSX walk
 *    and the assembled pipeline (see the folder's README).
 *
 * The rest of this module stays the single require path for everything the
 * two directions share:
 *
 *   converter/transform.js  the pipeline — content in, content out
 *   converter/run.js        reading, writing and the `--once`/watch entry
 *   converter/direction.js  config.source × template -> the direction options
 *   converter/modules.js    the shared specifier-rewriting engine
 *   converter/imports.js    import statements, and the scanning behind them
 *   converter/jsx/read.js   the shared JSX tag reader
 *   converter/macro/        the platform macros
 *   converter/warn.js       the unmapped-name warning
 *
 * Options (see transform in converter/transform.js):
 *   platform         — "web" | "native"; defaults from applyRNTransform
 *   applyRNTransform — apply the react -> expo direction (native targets)
 *   useWebTransform  — force the expo -> react direction on or off
 *   transform        — connector-supplied hook run after the built-ins, used
 *                      for target quirks the generic pass cannot know about
 *                      (e.g. prepending NativeWind directives to global.css)
 *
 * Connectors do not assemble those by hand: they resolve them from
 * `rexpo.config.js` with directionOptions(source, template) — see
 * converter/direction.js — so the pass a target runs follows from the
 * authoring dialect vs. the template, not from the template alone.
 */

const {
  transform,
  needsWebTransform,
  applyReactNativeTransform,
  applyWebTransform,
  setCurrentSource,
  JS_EXT,
} = require("./transform");
const { convertFile, syncDir, main } = require("./run");
const { directionOptions, sourceDialect } = require("./direction");
const {
  rewriteModuleSpecifiers,
  resolveMappedSpecifier,
  buildForwardMappingTable,
  FORWARD_BUILT_IN_MAPPINGS,
  TAG_MAP,
  RN_PACKAGE,
  COMPONENT_PACKAGE,
  NEEDS_TEXT_WRAPPER,
  DOM_OF,
} = require("./directions");
const { readTag, isNodeTag, TAG_NAME_RE } = require("./jsx/read");

module.exports = {
  convertFile,
  transform,
  applyReactNativeTransform,
  applyWebTransform,
  needsWebTransform,
  buildForwardMappingTable,
  FORWARD_BUILT_IN_MAPPINGS,
  rewriteModuleSpecifiers,
  resolveMappedSpecifier,
  setCurrentSource,
  JS_EXT,
  directionOptions,
  sourceDialect,
  syncDir,
  main,
  // Tag tables, per direction.
  TAG_MAP,
  RN_PACKAGE,
  COMPONENT_PACKAGE,
  NEEDS_TEXT_WRAPPER,
  DOM_OF,
  // Shared JSX reading.
  readTag,
  isNodeTag,
  TAG_NAME_RE,
  ...require("./imports"),
};

if (require.main === module) {
  process.exitCode = main();
}
