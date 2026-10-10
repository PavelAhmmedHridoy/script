/**
 * converter/imports.js — import statement utilities.
 *
 * Shared by the converter (to add the components a rewrite needs), by
 * platform-blocks.js (to lift the authoring-only macro import back out), by
 * modules.js (to rewrite specifiers per platform) and by deps/scan.js. Kept
 * separate so none of them need a require cycle through converter/index.js, and
 * kept as one require path: the work lives in imports/, one concern per file.
 *
 *   imports/scan.js        reading strings, comments and specifiers the way
 *                          JavaScript means them — what is code, what is prose
 *   imports/statements.js  finding import statements, and the splice helpers
 *                          that add specifiers to them
 *
 * This module is still the leaf of the converter: nothing under imports/
 * requires anything else from the converter.
 */

const {
  looksLikeStringStart,
  skipString,
  skipComment,
  maskCode,
  packageNameOf,
} = require("./imports/scan");
const {
  findImportEnd,
  findImports,
  splitNames,
  localName,
  applyEdits,
  injectImports,
} = require("./imports/statements");

module.exports = {
  findImportEnd,
  findImports,
  splitNames,
  localName,
  applyEdits,
  injectImports,
  looksLikeStringStart,
  skipString,
  skipComment,
  maskCode,
  packageNameOf,
};
