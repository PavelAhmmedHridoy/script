/**
 * connector/index.js — entry point for the connector folder.
 * Loads all route connector files ([app].js, [components].js, etc.)
 * and maps root source files to template directories.
 */

const fs = require("fs");
const path = require("path");
const { convertFile, directionOptions } = require("../converter");

const PACKAGE_ROOT = path.resolve(__dirname, "..", "..");

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
      name: file.replace(/\[|\]/g, "").replace(".js", ""),
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
 * Static-mapping connectors (config, entry) sync fixed file lists and have no
 * per-file route, so they are skipped here.
 *
 * A connector may also export `transform(content, ctx)`, a hook the converter
 * runs after its built-in pass. It is forwarded here so the watcher produces
 * byte-identical output to a full sync instead of only running it on `sync()`.
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
      name: file.replace(/\[|\]/g, "").replace(".js", ""),
      pattern,
      getTargetPath: mod.getTargetPath,
      transform: typeof mod.transform === "function" ? mod.transform : undefined,
    });
  }
  return result;
}

/**
 * Route-relative path for a changed file, relative to the folder its
 * connector's pattern is written against. `src/@app.tsx` is routed as
 * `@app.tsx`; a root-level `assets/hero.png` is routed as `assets/hero.png`.
 * @returns {string|null} null when the file lives outside the project root.
 */
function relativePathFor(absPath, packageRoot) {
  const srcDir = path.join(packageRoot, "src");
  const fromSrc = path.relative(srcDir, absPath);
  if (fromSrc && !fromSrc.startsWith("..")) return fromSrc;

  const fromRoot = path.relative(packageRoot, absPath);
  if (fromRoot && !fromRoot.startsWith("..")) return fromRoot;

  return null;
}

/**
 * Sync a single changed source file to its correct location in every
 * enabled template, using the same route matching + transform rules as a
 * full `syncConnectors` run. This is what the watcher calls on every file
 * change, so live edits land in the same place a full sync would put them
 * instead of being copied to the same relative path verbatim.
 *
 * @param {string} absPath - Absolute path of the changed file.
 * @param {object} config - rexpo.config.js
 * @param {string} packageRoot - Project root
 * @returns {boolean} true if a route connector matched and handled the file;
 *   false if no connector's pattern recognizes this file (caller should
 *   fall back to a raw copy).
 */
function syncSingleFile(absPath, config, packageRoot) {
  const relative = relativePathFor(absPath, packageRoot);

  // Files outside the routable folders (src/, assets/, ...) are not routable.
  if (!relative) return false;

  for (const connector of loadPatternConnectors()) {
    if (!connector.pattern.test(relative)) continue;

    for (const template of ["react", "expo"]) {
      if (!config.deploy?.[template]) continue;

      const targetPath = connector.getTargetPath(relative, template);
      if (!targetPath) continue;

      const dest = path.join(packageRoot, targetPath);
      const destDir = path.dirname(dest);
      if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

      // Live edits go through the same direction resolution as a full sync, so
      // a save produces exactly what `rexpo sync` would write.
      convertFile(absPath, dest, {
        ...directionOptions(config.source, template),
        transform: connector.transform,
      });
      console.log(`[connector/${connector.name}] ${relative} -> ${targetPath}`);
    }

    return true;
  }

  return false;
}

/**
 * Remove a single changed source file's synced output from every enabled
 * template, mirroring syncSingleFile's routing.
 * @returns {boolean} true if a route connector matched and handled removal.
 */
function removeSingleFile(absPath, config, packageRoot) {
  const relative = relativePathFor(absPath, packageRoot);
  if (!relative) return false;

  for (const connector of loadPatternConnectors()) {
    if (!connector.pattern.test(relative)) continue;

    for (const template of ["react", "expo"]) {
      if (!config.deploy?.[template]) continue;

      const targetPath = connector.getTargetPath(relative, template);
      if (!targetPath) continue;

      const dest = path.join(packageRoot, targetPath);
      if (fs.existsSync(dest)) {
        fs.unlinkSync(dest);
        console.log(`[connector/${connector.name}] removed ${targetPath}`);
      }
    }

    return true;
  }

  return false;
}

module.exports = {
  loadConnectors,
  loadPatternConnectors,
  syncConnectors,
  syncSingleFile,
  removeSingleFile,
  relativePathFor,
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