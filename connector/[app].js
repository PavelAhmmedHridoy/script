/**
 * [app].js — connector for app routes.
 * Maps: src/@app.tsx -> template/react/src/App.tsx (overwrites the existing entry component)
 *        src/@app.tsx -> template/expo/app/index.tsx
 *        src/@app/*.tsx -> template/expo/app/*.tsx
 */

const fs = require("fs");
const path = require("path");
const { convertFile, directionOptions } = require("../converter");
const { walkFiles } = require("./walk");

/** Source directory to watch */
const SOURCE_DIR = "src";

/** Pattern to match app routes */
const APP_PATTERN = /^@app\/?/;

/** Target directories per template */
const TARGETS = {
  react: "template/react/src",
  expo: "template/expo/app",
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

  // The root @app file is the app's entry component. For react it should
  // overwrite the template's existing src/App.tsx, not create a nested
  // src/app/index.tsx route file.
  const isRootAppFile = /^@app\.(tsx|ts|jsx|js)$/.test(relativePath);
  if (template === "react" && isRootAppFile) {
    const ext = relativePath.split(".").pop();
    return path.join(target, `App.${ext}`);
  }

  // @app/ -> app/
  // @app.tsx -> app/index.tsx
  let mapped = relativePath.replace(APP_PATTERN, "app/");

  // Convert @app.tsx to app/index.tsx (handles app/.tsx case too)
  if (mapped === "app.tsx" || mapped === "app.js" || mapped === "app.jsx" || mapped.match(/^app\/\.\w+$/)) {
    const ext = mapped.split(".").pop();
    mapped = `app/index.${ext}`;
  }

  // For expo, the target already includes 'app/', so remove the duplicate
  if (template === "expo" && mapped.startsWith("app/")) {
    mapped = mapped.slice(4); // Remove 'app/' prefix
  }

  return path.join(target, mapped);
}

/**
 * Sync app routes from source to templates.
 * @param {object} config - rexpo.config.js
 * @param {string} packageRoot - Project root
 */
function sync(config, packageRoot) {
  const srcDir = path.join(packageRoot, SOURCE_DIR);

  if (!fs.existsSync(srcDir)) {
    console.warn(`[connector/app] Source directory not found: ${SOURCE_DIR}`);
    return;
  }

  const files = walkFiles(srcDir);

  for (const file of files) {
    const relative = path.relative(srcDir, file);

    // Only process @app routes
    if (!APP_PATTERN.test(relative)) continue;

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
    console.log(`[connector/app] ${relativePath} -> ${targetPath}`);
  } catch (err) {
    console.error(`[connector/app] Failed: ${err.message}`);
  }
}


module.exports = { sync, getTargetPath, APP_PATTERN };