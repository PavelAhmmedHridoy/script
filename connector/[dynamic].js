/**
 * [dynamic].js — unified connector for ALL dynamic @folders.
 *
 * This replaces the separate hardcoded connectors:
 *   [components].js, [hooks].js, [lib].js, [utils].js, [styles].js
 *
 * The new architecture:
 *   - Only @app, @pages, @layout are reserved semantic constructs
 *   - EVERY other @segment is dynamically treated as an ordinary folder
 *   - No common folder registry
 *   - Arbitrary folder names work automatically: @r, @foo, @bar, @services, @anything
 *   - Nested dynamic folders work: @foo/@bar/@baz/test.tsx
 *
 * Mapping (same algorithm for ALL dynamic folders):
 *   React:  src/@<folder>/... -> template/react/src/<folder>/...
 *   Expo:   src/@<folder>/... -> template/expo/<folder>/...
 *
 * The algorithm:
 *   1. Remove @ from each path segment
 *   2. Map to the target root
 *   3. Done — no special-casing, no registry, no configuration
 */

const fs = require("fs");
const path = require("path");
const { convertFile, directionOptions } = require("../converter");
const { walkFiles } = require("./walk");
const {
  classifySourcePath,
  isDynamicFolderPath,
  getTargetPath,
} = require("./resolver");

const SOURCE_DIR = "src";

/**
 * Pattern to match ANY dynamic @folder path.
 * Matches: @components/*, @hooks/*, @lib/*, @utils/*, @styles/*,
 *          @r/*, @foo/*, @bar/*, @services/*, @anything/*,
 *          @foo/@bar/*, @foo/@bar/@baz/*, etc.
 */
const DYNAMIC_FOLDER_PATTERN = /^@[\w-]+(?:\/[^\/]*)*\/?.*/;

/**
 * Get the target path for a dynamic @folder source file.
 * Delegates to the central resolver.
 */
function resolveTargetPath(relativePath, template, packageRoot) {
  return getTargetPath(relativePath, template, packageRoot);
}

/**
 * Sync all dynamic @folder files from source to templates.
 */
function sync(config, packageRoot) {
  const srcDir = path.join(packageRoot, SOURCE_DIR);

  if (!fs.existsSync(srcDir)) {
    console.warn(`[connector/dynamic] Source directory not found: ${SOURCE_DIR}`);
    return;
  }

  const files = walkFiles(srcDir);

  for (const file of files) {
    const relative = path.relative(srcDir, file);

    // Only process dynamic @folder paths
    if (!isDynamicFolderPath(relative)) continue;

    if (config.deploy?.react) {
      syncFile(file, relative, "react", packageRoot, config);
    }
    if (config.deploy?.expo) {
      syncFile(file, relative, "expo", packageRoot, config);
    }
  }
}

function syncFile(srcFile, relativePath, template, packageRoot, config) {
  const targetPath = resolveTargetPath(relativePath, template, packageRoot);
  if (!targetPath) return;

  const dest = path.join(packageRoot, targetPath);
  const destDir = path.dirname(dest);

  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  try {
    convertFile(srcFile, dest, directionOptions(config.source, template));
    console.log(`[connector/dynamic] ${relativePath} -> ${targetPath}`);
  } catch (err) {
    console.error(`[connector/dynamic] Failed: ${err.message}`);
  }
}

module.exports = {
  sync,
  getTargetPath,
  DYNAMIC_FOLDER_PATTERN,
};
