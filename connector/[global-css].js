/**
 * [global-css].js — connector for the project's global stylesheet.
 *
 * Maps:
 *   src/global.css -> template/react/src/global.css   imported by main.tsx
 *   src/global.css -> template/expo/global.css        NativeWind's `input`
 *
 * The native target has to be `template/expo/global.css`: metro.config.js
 * configures `withNativeWind(config, { input: "./global.css" })` relative to
 * the app root, and that file is the one that must carry the Tailwind
 * directives. This used to land in app/global.css, which left NativeWind
 * compiling an empty stylesheet — `className` did nothing on device.
 *
 * The web target is a sibling of App.tsx / @layout.tsx because the generated
 * main.tsx imports it relatively.
 */

const fs = require("fs");
const path = require("path");
const { convertFile, directionOptions } = require("../converter");

const SOURCE_DIR = "src";
const GLOBAL_CSS_PATTERN = /^global\.css$/;

/** Tailwind directives NativeWind v4 needs at the top of its entry file. */
const NATIVEWIND_DIRECTIVES = "@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n";

const TARGETS = {
  react: "template/react/src",
  expo: "template/expo",
};

/**
 * Get the target path for a source file.
 * @param {string} relativePath - Relative path from SOURCE_DIR
 * @param {string} template - 'react' or 'expo'
 * @returns {string|null}
 */
function getTargetPath(relativePath, template) {
  const target = TARGETS[template];
  if (!target) return null;
  return path.join(target, relativePath);
}

/**
 * Ensure the native output is a valid NativeWind entry file.
 * Shared with the watcher via the connector interface.
 *
 * Keyed on the target platform, not on the transform direction: an
 * expo-authored stylesheet copied to the native template needs the directives
 * just as much, and the converter only strips them for web.
 */
function transform(content, { platform }) {
  if (platform !== "native") return content;
  if (/@tailwind\s+(?:base|components|utilities)\b/.test(content)) return content;
  return NATIVEWIND_DIRECTIVES + content;
}

/**
 * Sync the global stylesheet to every enabled template.
 * @param {object} config - rexpo.config.js
 * @param {string} packageRoot - Project root
 */
function sync(config, packageRoot) {
  const srcFile = path.join(packageRoot, SOURCE_DIR, "global.css");

  if (!fs.existsSync(srcFile)) {
    console.warn(`[connector/global-css] Source not found: ${SOURCE_DIR}/global.css`);
    return;
  }

  if (config.deploy?.react) syncFile(srcFile, "global.css", "react", packageRoot, config);
  if (config.deploy?.expo) syncFile(srcFile, "global.css", "expo", packageRoot, config);
}

function syncFile(srcFile, relativePath, template, packageRoot, config) {
  const targetPath = getTargetPath(relativePath, template);
  if (!targetPath) return;

  const dest = path.join(packageRoot, targetPath);

  convertFile(srcFile, dest, {
    ...directionOptions(config.source, template),
    transform,
  });
}

module.exports = {
  sync,
  getTargetPath,
  transform,
  GLOBAL_CSS_PATTERN,
  NATIVEWIND_DIRECTIVES,
};
