/**
 * [hooks].js — connector for custom hooks.
 * Maps: src/@hooks/*.ts -> template/react/src/hooks/*.ts
 *        src/@hooks/*.ts -> template/expo/hooks/*.ts
 */

const fs = require("fs");
const path = require("path");
const { convertFile, directionOptions } = require("../converter");
const { walkFiles } = require("./walk");

const SOURCE_DIR = "src";
const HOOKS_PATTERN = /^@hooks\/?/;

const TARGETS = {
  react: "template/react/src/hooks",
  expo: "template/expo/hooks",
};

function getTargetPath(relativePath, template) {
  const target = TARGETS[template];
  if (!target) return null;

  const mapped = relativePath.replace(HOOKS_PATTERN, "");
  return path.join(target, mapped);
}

function sync(config, packageRoot) {
  const srcDir = path.join(packageRoot, SOURCE_DIR);
  if (!fs.existsSync(srcDir)) {
    console.warn(`[connector/hooks] Source directory not found: ${SOURCE_DIR}`);
    return;
  }

  const files = walkFiles(srcDir);
  for (const file of files) {
    const relative = path.relative(srcDir, file);
    if (!HOOKS_PATTERN.test(relative)) continue;

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
    console.error(`[connector/hooks] Failed: ${err.message}`);
  }
}

module.exports = { sync, getTargetPath, HOOKS_PATTERN };
