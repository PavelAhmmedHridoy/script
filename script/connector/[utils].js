/**
 * [utils].js — connector for utility functions.
 * Maps: src/@utils/*.ts -> template/react/src/utils/*.ts
 *        src/@utils/*.ts -> template/expo/utils/*.ts
 */

const fs = require("fs");
const path = require("path");
const { convertFile, directionOptions } = require("../converter");
const { walkFiles } = require("./walk");

const SOURCE_DIR = "src";
const UTILS_PATTERN = /^@utils\/?/;

const TARGETS = {
  react: "template/react/src/utils",
  expo: "template/expo/utils",
};

function getTargetPath(relativePath, template) {
  const target = TARGETS[template];
  if (!target) return null;

  const mapped = relativePath.replace(UTILS_PATTERN, "");
  return path.join(target, mapped);
}

function sync(config, packageRoot) {
  const srcDir = path.join(packageRoot, SOURCE_DIR);
  if (!fs.existsSync(srcDir)) {
    console.warn(`[connector/utils] Source directory not found: ${SOURCE_DIR}`);
    return;
  }

  const files = walkFiles(srcDir);
  for (const file of files) {
    const relative = path.relative(srcDir, file);
    if (!UTILS_PATTERN.test(relative)) continue;

    if (config.deploy?.react) syncFile(file, relative, "react", packageRoot, config);
    if (config.deploy?.expo) syncFile(file, relative, "expo", packageRoot, config);
  }
}

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
  } catch (err) {
    console.error(`[connector/utils] Failed: ${err.message}`);
  }
}

module.exports = { sync, getTargetPath, UTILS_PATTERN };
