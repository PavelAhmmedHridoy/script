/**
 * connector/layout/sync.js — where the author's shell lands, per target.
 *
 * Maps:
 *   src/@layout.tsx -> template/react/src/@layout.tsx
 *   src/@layout.tsx -> template/expo/components/root-layout.tsx
 *
 * The two targets need the layout in different places:
 *   - web: next to App.tsx, imported by the generated main.tsx.
 *   - native: expo-router owns app/_layout.tsx and renders the router there,
 *     so the author's shell lives as a component and is wrapped around
 *     <Slot /> by [entry].js. Writing it to app/_layout.tsx directly would
 *     remove the router and render a blank screen.
 *
 * The author's `import "./global.css"` is dropped for native: the generated
 * app/_layout.tsx already imports the NativeWind entry, and the relative path
 * would no longer resolve from components/.
 */

const fs = require("fs");
const path = require("path");
const { convertFile, directionOptions } = require("../../converter");
const { ensureSingleJsxRoot } = require("./jsx-root");

const SOURCE_DIR = "src";
const LAYOUT_PATTERN = /^@layout\.(tsx|ts|jsx|js)$/;

/** Where the author's layout component lands in each template. */
const TARGETS = {
  react: { dir: "template/react/src", file: null },
  expo: { dir: "template/expo/components", file: "root-layout.tsx" },
};

/** Side-effect CSS import the native target must not carry. */
const GLOBAL_CSS_IMPORT_RE =
  /^[ \t]*import\s*["']\.\/global\.css["'];?[ \t]*\r?\n/gm;

/**
 * Get the target path for a source file.
 * @param {string} relativePath - Relative path from SOURCE_DIR
 * @param {string} template - 'react' or 'expo'
 * @returns {string}
 */
function getTargetPath(relativePath, template) {
  const target = TARGETS[template];
  if (!target) return null;

  return path.join(target.dir, target.file || relativePath);
}

/**
 * Per-target cleanups shared by full syncs and live watcher edits, so a live
 * edit of src/@layout.tsx produces exactly what a full sync would.
 *
 * Runs after the converter's built-in pass: on web, native-authored tags have
 * already become DOM, so the guard wraps in <div>; on native the file is
 * View/Text, so it wraps in <View>. Keyed on the target platform rather than
 * on the transform direction — the file is native whichever way it got there.
 */
function transform(content, ctx = {}) {
  let out = content;

  if (ctx.platform === "native") {
    out = out.replace(GLOBAL_CSS_IMPORT_RE, "");
    return ensureSingleJsxRoot(out, "View");
  }

  return ensureSingleJsxRoot(out, "div");
}

/**
 * Sync the layout file(s) from source to the enabled templates.
 * @param {object} config - rexpo.config.js
 * @param {string} packageRoot - Project root
 */
function sync(config, packageRoot) {
  const srcDir = path.join(packageRoot, SOURCE_DIR);

  if (!fs.existsSync(srcDir)) {
    console.warn(`[connector/layout] Source directory not found: ${SOURCE_DIR}`);
    return;
  }

  const entries = fs.readdirSync(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile() || !LAYOUT_PATTERN.test(entry.name)) continue;

    const srcFile = path.join(srcDir, entry.name);

    if (config.deploy?.react) syncFile(srcFile, entry.name, "react", packageRoot, config);
    if (config.deploy?.expo) syncFile(srcFile, entry.name, "expo", packageRoot, config);
  }
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
  LAYOUT_PATTERN,
  TARGETS,
  SOURCE_DIR,
};
