/**
 * connector/index.js — entry point for the connector folder.
 * Loads all route connector files ([app].js, [components].js, etc.)
 * and maps root source files to template directories.
 */

const fs = require("fs");
const path = require("path");
const { convertFile, directionOptions } = require("../converter");
const { getTargetPath, isDynamicFolderPath, classifySourcePath } = require("./resolver");

// Prevent process crash on Termux when running in background (EIO error fix)
if (process.stdin && typeof process.stdin.on === "function") {
  process.stdin.on("error", (err) => {
    if (err.code === "EIO") return;
    console.error("stdin error:", err);
  });
}

const PACKAGE_ROOT = path.resolve(__dirname, "..", "..");

/**
 * Resolve target path using the central resolver.
 * Standard wrapper used across sync and single-file watcher passes.
 */
function resolveTargetPath(relativePath, template, packageRoot) {
  return getTargetPath(relativePath, template, packageRoot);
}

/**
 * Reserved semantic patterns that have their own dedicated connectors.
 * These are the ONLY hardcoded patterns — everything else is dynamic.
 */
const SEMANTIC_PATTERNS = {
  app: /^@app\.(tsx|ts|jsx|js)$/,           // src/@app.tsx
  layout: /^@layout\.(tsx|ts|jsx|js)$/,     // src/@layout.tsx
  pages: /^@pages\//,                        // src/@pages/...
};

/**
 * Check if a relative path is a reserved semantic path.
 * @param {string} relativePath - relative to src/ or project root
 * @returns {string|null} the semantic kind ("app", "layout", "pages") or null
 */
function getSemanticKind(relativePath) {
  if (SEMANTIC_PATTERNS.app.test(relativePath)) return "app";
  if (SEMANTIC_PATTERNS.layout.test(relativePath)) return "layout";
  if (SEMANTIC_PATTERNS.pages.test(relativePath)) return "pages";
  return null;
}

/**
 * Load all connector files from this directory.
 * Connector files follow the pattern: [route].js
 * @returns {object[]} Array of connector configs
 */
function loadConnectors() {
  const connectorDir = __dirname;
  const connectors = [];

  const files = fs.readdirSync(connectorDir).filter((f) => {
    return f.startsWith("[") && f.endsWith("].js") && f !== "index.js";
  });

  for (const file of files) {
    const connector = require(path.join(connectorDir, file));
    connectors.push({
      name: file.replace(/\[\vert{}\]/g, "").replace(".js", ""),
      ...connector,
    });
  }

  return connectors;
}

/**
 * Sync files based on all loaded connectors.
 * @param {object} config - rexpo.config.js
 */
function syncConnectors(config) {
  const connectors = loadConnectors();

  for (const connector of connectors) {
    if (connector.enabled === false) continue;

    console.log(`[connector] Running: ${connector.name}`);

    if (typeof connector.sync === "function") {
      connector.sync(config, PACKAGE_ROOT);
    }
  }
}

/**
 * Load only the "pattern" connectors — the ones that declare a RegExp source
 * pattern plus a getTargetPath(relativePath, template) function (app, layout,
 * pages, components, hooks, lib, styles, utils, global-css, assets).
 *
 * @returns {object[]} [{ name, pattern, getTargetPath, transform }]
 */
function loadPatternConnectors() {
  const connectorDir = __dirname;
  const files = fs.readdirSync(connectorDir).filter((f) => {
    return f.startsWith("[") && f.endsWith("].js");
  });

  const result = [];
  for (const file of files) {
    const mod = require(path.join(connectorDir, file));
    if (typeof mod.getTargetPath !== "function") continue;

    const pattern = Object.values(mod).find((v) => v instanceof RegExp);
    if (!pattern) continue;

    result.push({
      name: file.replace(/\[\vert{}\]/g, "").replace(".js", ""),
      pattern,
      getTargetPath: mod.getTargetPath,
      transform: typeof mod.transform === "function" ? mod.transform : undefined,
    });
  }
  return result;
}

/**
 * Route-relative path for a changed file, relative to the folder its
 * connector's pattern is written against.
 * Checks both src/ and sr/ directories.
 * @returns {string|null} null when the file lives outside the project root.
 */
function relativePathFor(absPath, packageRoot) {
  // Check src/ first
  const srcDir = path.join(packageRoot, "src");
  const fromSrc = path.relative(srcDir, absPath);
  if (fromSrc && !fromSrc.startsWith("..")) return fromSrc;

  // Check sr/ second (for Expo-focused source files)
  const srDir = path.join(packageRoot, "sr");
  const fromSr = path.relative(srDir, absPath);
  if (fromSr && !fromSr.startsWith("..")) return fromSr;

  // Check project root
  const fromRoot = path.relative(packageRoot, absPath);
  if (fromRoot && !fromRoot.startsWith("..")) return fromRoot;

  return null;
}

/**
 * Get the transform hook for a connector, if any.
 * @param {string} connectorName
 * @returns {function|null}
 */
function getConnectorTransform(connectorName) {
  try {
    const connectorFile = `/[${connectorName}].js`;
    const connectorPath = path.join(__dirname, connectorFile);
    if (fs.existsSync(connectorPath)) {
      const connector = require(connectorPath);
      if (typeof connector.transform === "function") {
        return connector.transform;
      }
    }
  } catch (e) {
    // Ignore — no transform for this connector
  }
  return null;
}

/**
 * Sync a single changed source file to its correct location in every
 * enabled template, using the CENTRAL RESOLVER for routing.
 *
 * @param {string} absPath - Absolute path of the changed file.
 * @param {object} config - rexpo.config.js
 * @param {string} packageRoot - Project root
 * @returns {boolean} true if the file was routed and handled; false otherwise.
 */
function syncSingleFile(absPath, config, packageRoot) {
  const relative = relativePathFor(absPath, packageRoot);

  if (!relative) return false;

  const templates = ["react", "expo"].filter((t) => config.deploy?.[t]);

  for (const template of templates) {
    const targetPath = resolveTargetPath(relative, template, packageRoot);
    if (!targetPath) continue;

    const dest = path.join(packageRoot, targetPath);
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

    const semanticKind = getSemanticKind(relative);
    const connectorName = semanticKind || (isDynamicFolderPath(relative) ? "dynamic" : "ordinary");

    convertFile(absPath, dest, {
      ...directionOptions(config.source, template),
      transform: getConnectorTransform(connectorName),
    });
    console.log(`[connector/${connectorName}] ${relative} -> ${targetPath}`);
  }

  return templates.length > 0;
}

/**
 * Remove a single changed source file's synced output from every enabled template.
 * @returns {boolean} true if the file was routed and handled.
 */
function removeSingleFile(absPath, config, packageRoot) {
  const relative = relativePathFor(absPath, packageRoot);
  if (!relative) return false;

  const templates = ["react", "expo"].filter((t) => config.deploy?.[t]);

  for (const template of templates) {
    const targetPath = resolveTargetPath(relative, template, packageRoot);
    if (!targetPath) continue;

    const dest = path.join(packageRoot, targetPath);
    if (fs.existsSync(dest)) {
      fs.unlinkSync(dest);
      const semanticKind = getSemanticKind(relative);
      const connectorName = semanticKind || (isDynamicFolderPath(relative) ? "dynamic" : "ordinary");
      console.log(`[connector/${connectorName}] removed ${targetPath}`);
    }
  }

  return templates.length > 0;
}

module.exports = {
  loadConnectors,
  loadPatternConnectors,
  syncConnectors,
  syncSingleFile,
  removeSingleFile,
  relativePathFor,
  resolveTargetPath,
};

// Allow `node script/connector/index.js` to run directly.
if (require.main === module) {
  const configPath = path.join(PACKAGE_ROOT, "rexpo.config.js");
  let config;
  try {
    config = require(configPath);
  } catch {
    config = { deploy: { react: true, expo: true } };
  }

  console.log("[connector] Starting sync...");
  syncConnectors(config);
  console.log("[connector] Done.");
}
