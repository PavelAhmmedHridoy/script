/**
 * [lib].js — connector for lib/utility files.
 * Maps: src/@lib/*.ts -> template/react/src/lib/*.ts
 *        src/@lib/*.ts -> template/expo/lib/*.ts
 */

const fs = require("fs");
const path = require("path");
const { convertFile, directionOptions } = require("../converter");
const { walkFiles } = require("./walk");

const SOURCE_DIR = "src";
const LIB_PATTERN = /^@lib\/?/;

const TARGETS = {
  react: "template/react/src/lib",
  expo: "template/expo/lib",
};

function getTargetPath(relativePath, template) {
  const target = TARGETS[template];
  if (!target) return null;

  const mapped = relativePath.replace(LIB_PATTERN, "");
  return path.join(target, mapped);
}

function sync(config, packageRoot) {
  const srcDir = path.join(packageRoot, SOURCE_DIR);
  if (!fs.existsSync(srcDir)) {
    console.warn(`[connector/lib] Source directory not found: ${SOURCE_DIR}`);
    return;
  }

  const files = walkFiles(srcDir);
  for (const file of files) {
    const relative = path.relative(srcDir, file);
    if (!LIB_PATTERN.test(relative)) continue;

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
    console.error(`[connector/lib] Failed: ${err.message}`);
  }
}


module.exports = { sync, getTargetPath, LIB_PATTERN };
