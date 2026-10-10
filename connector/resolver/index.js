/**
 * connector/resolver/index.js — central path resolver/router.
 *
 * The authoritative path resolver for all Rexpo operations.
 * Every subsystem must use this instead of creating their own folder mapping logic.
 */

const {
  REACT_ROOT,
  EXPO_ROOT,
  reactRootPath,
  expoRootPath,
  targetRoot,
  targetRootPath,
  destDepth,
  destRelativeToRoot,
} = require("./roots");

const {
  classifySourcePath,
  isSemanticPath,
  semanticKindOf,
  isDynamicFolderPath,
  dynamicFolderName,
  resolvedDynamicPath,
  resolveDynamicFolderPath,
  RESERVED_SEMANTIC_SEGMENTS,
} = require("./classify");

const {
  getTargetPath,
  getSourcePathFromTarget,
  isGeneratedPath,
  getAppTargetPath,
  getLayoutTargetPath,
  getPagesTargetPath,
  getDynamicFolderTargetPath,
  getOrdinaryTargetPath,
} = require("./targets");

const {
  rewriteAuthoringImports,
  rewriteSpecifier,
  stripRootAlias,
  isLayoutSpecifier,
  mapFolder,
} = require("./aliases");

module.exports = {
  // Roots
  REACT_ROOT,
  EXPO_ROOT,
  reactRootPath,
  expoRootPath,
  targetRoot,
  targetRootPath,
  destDepth,
  destRelativeToRoot,

  // Classification
  classifySourcePath,
  isSemanticPath,
  semanticKindOf,
  isDynamicFolderPath,
  dynamicFolderName,
  resolvedDynamicPath,
  resolveDynamicFolderPath,
  RESERVED_SEMANTIC_SEGMENTS,

  // Target resolution
  getTargetPath,
  getSourcePathFromTarget,
  isGeneratedPath,
  getAppTargetPath,
  getLayoutTargetPath,
  getPagesTargetPath,
  getDynamicFolderTargetPath,
  getOrdinaryTargetPath,

  // Aliases
  rewriteAuthoringImports,
  rewriteSpecifier,
  stripRootAlias,
  isLayoutSpecifier,
  mapFolder,
};
