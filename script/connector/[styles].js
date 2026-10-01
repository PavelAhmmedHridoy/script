/**
 * [styles].js — connector for styles/CSS files.
 * Maps: src/@styles/*.css -> template/react/src/styles/*.css
 *        src/@styles/*.css -> template/expo/styles/*.css
 */

const fs = require("fs");
const path = require("path");
const { convertFile, directionOptions } = require("../converter");
const { walkFiles } = require("./walk");

const SOURCE_DIR = "src";
const STYLES_PATTERN = /^@styles\/?/;

const TARGETS = {
  react: "template/react/src/styles",
  expo: "template/expo/styles",
};

function getTargetPath(relativePath, template) {
  const target = TARGETS[template];
  if (!target) return null;

  const mapped = relativePath.replace(STYLES_PATTERN, "");
  return path.join(target, mapped);
}

function sync(config, packageRoot) {
  const srcDir = path.join(packageRoot, SOURCE_DIR);
  if (!fs.existsSync(srcDir)) {
    console.warn(`[connector/styles] Source directory not found: ${SOURCE_DIR}`);
    return;
  }

  const files = walkFiles(srcDir);
  for (const file of files) {
    const relative = path.relative(srcDir, file);
    if (!STYLES_PATTERN.test(relative)) continue;

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
    // The CSS post-processing follows the target (NativeWind directives for
    // native, Tailwind v4 cleanup for web); the direction still comes from the
    // authoring `source` mode.
    convertFile(srcFile, dest, directionOptions(config.source, template));
    console.log(`[connector/styles] ${relativePath} -> ${targetPath}`);
  } catch (err) {
    console.error(`[connector/styles] Failed: ${err.message}`);
  }
}

module.exports = { sync, getTargetPath, STYLES_PATTERN };
