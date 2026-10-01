/**
 * [components].js — connector for component routes.
 * Maps: src/@components/*.tsx -> template/react/src/components/*.tsx
 *        src/@components/*.tsx -> template/expo/components/*.tsx
 */

const fs = require("fs");
const path = require("path");
const { convertFile, directionOptions } = require("../converter");
const { walkFiles } = require("./walk");

/** Source directory to watch */
const SOURCE_DIR = "src";

/** Pattern to match component routes */
const COMPONENTS_PATTERN = /^@components\/?/;

/** Target directories per template */
const TARGETS = {
  react: "template/react/src/components",
  expo: "template/expo/components",
};

/**
 * Get the target path for a source file.
 * @param {string} relativePath - Relative path from SOURCE_DIR
 * @param {string} template - 'react' or 'expo'
 * @returns {string}
 */
function getTargetPath(relativePath, template) {
  const target = TARGETS[template];
  if (!target) return null;

  // @components/ -> components/
  const mapped = relativePath.replace(COMPONENTS_PATTERN, "");
  return path.join(target, mapped);
}

/**
 * Sync component routes from source to templates.
 * @param {object} config - rexpo.config.js
 * @param {string} packageRoot - Project root
 */
function sync(config, packageRoot) {
  const srcDir = path.join(packageRoot, SOURCE_DIR);

  if (!fs.existsSync(srcDir)) {
    console.warn(`[connector/components] Source directory not found: ${SOURCE_DIR}`);
    return;
  }

  const files = walkFiles(srcDir);

  for (const file of files) {
    const relative = path.relative(srcDir, file);

    // Only process @components routes
    if (!COMPONENTS_PATTERN.test(relative)) continue;

    // Sync to each enabled template
    if (config.deploy?.react) {
      syncFile(file, relative, "react", packageRoot, config);
    }
    if (config.deploy?.expo) {
      syncFile(file, relative, "expo", packageRoot, config);
    }
  }
}

/**
 * Sync a single file to a template.
 */
function syncFile(srcFile, relativePath, template, packageRoot, config) {
  const targetPath = getTargetPath(relativePath, template);
  if (!targetPath) return;

  const dest = path.join(packageRoot, targetPath);
  const destDir = path.dirname(dest);

  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  try {
    // Which way this target converts — react -> expo, expo -> react, or a
    // plain copy — comes from the authoring `source` mode, not the template.
    convertFile(srcFile, dest, directionOptions(config.source, template));
    console.log(`[connector/components] ${relativePath} -> ${targetPath}`);
  } catch (err) {
    console.error(`[connector/components] Failed: ${err.message}`);
  }
}


module.exports = { sync, getTargetPath, COMPONENTS_PATTERN };
