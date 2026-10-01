/**
 * [pages].js — connector for page routes.
 * Maps: src/@pages/*.tsx -> template/react/src/pages/*.tsx
 *        src/@pages/*.tsx -> template/expo/app/*.tsx (expo-router)
 */

const fs = require("fs");
const path = require("path");
const { convertFile, directionOptions } = require("../converter");
const { walkFiles } = require("./walk");

const SOURCE_DIR = "src";
const PAGES_PATTERN = /^@pages\/?/;

const TARGETS = {
  react: "template/react/src/pages",
  expo: "template/expo/app",
};

function getTargetPath(relativePath, template) {
  const target = TARGETS[template];
  if (!target) return null;

  const mapped = relativePath.replace(PAGES_PATTERN, "");
  return path.join(target, mapped);
}

function sync(config, packageRoot) {
  const srcDir = path.join(packageRoot, SOURCE_DIR);
  if (!fs.existsSync(srcDir)) {
    console.warn(`[connector/pages] Source directory not found: ${SOURCE_DIR}`);
    return;
  }

  const files = walkFiles(srcDir);
  for (const file of files) {
    const relative = path.relative(srcDir, file);
    if (!PAGES_PATTERN.test(relative)) continue;

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
    console.log(`[connector/pages] ${relativePath} -> ${targetPath}`);
  } catch (err) {
    console.error(`[connector/pages] Failed: ${err.message}`);
  }
}


module.exports = { sync, getTargetPath, PAGES_PATTERN };
