/**
 * [assets].js — connector for the project's assets folder.
 * Maps: assets/** -> template/react/assets/**  (served from the site root —
 *        Vite's `publicDir` in template/react/vite.config.ts points here)
 *        assets/** -> template/expo/assets/**
 *
 * Static binaries are copied byte-for-byte — the RN transform has nothing to
 * say about a PNG. `getTargetPath` exists so the watcher routes a newly added
 * asset to the same place a full sync would, instead of raw-copying it to
 * template/react/static/** where Vite would never serve it.
 */

const fs = require("fs");
const path = require("path");
const { copyFileIfChanged } = require("../io");
const { walkFiles } = require("./walk");

const SOURCE_DIR = "assets";
const ASSETS_PATTERN = /^assets\//;

const TARGETS = {
  react: "template/react/assets",
  expo: "template/expo/assets",
};

/**
 * Get the target path for an asset.
 *
 * Accepts both `hero.png` (relative to assets/, as `sync` passes it) and
 * `assets/hero.png` (relative to the project root, as the watcher passes it).
 * @param {string} relativePath
 * @param {string} template - 'react' or 'expo'
 * @returns {string|null}
 */
function getTargetPath(relativePath, template) {
  const target = TARGETS[template];
  if (!target) return null;

  return path.join(target, relativePath.replace(ASSETS_PATTERN, ""));
}

function sync(config, packageRoot) {
  const srcDir = path.join(packageRoot, SOURCE_DIR);
  if (!fs.existsSync(srcDir)) {
    console.warn(`[connector/assets] Source directory not found: ${SOURCE_DIR}`);
    return;
  }

  const files = walkFiles(srcDir);

  for (const file of files) {
    const relative = path.relative(srcDir, file);

    if (config.deploy?.react) {
      syncFile(file, relative, "react", packageRoot);
    }
    if (config.deploy?.expo) {
      syncFile(file, relative, "expo", packageRoot);
    }
  }
}

function syncFile(srcFile, relativePath, template, packageRoot) {
  const target = TARGETS[template];
  if (!target) return;

  const dest = path.join(packageRoot, target, relativePath);

  if (copyFileIfChanged(srcFile, dest)) {
    console.log(`[connector/assets] ${relativePath} -> ${target}/${relativePath}`);
  }
}

module.exports = { sync, getTargetPath, ASSETS_PATTERN };
