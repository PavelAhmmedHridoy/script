/**
 * watcher/mirror.js — what happens to one changed or deleted root file.
 *
 * Routing of a changed root file:
 *   - Special "@" convention files (src/@app.tsx, src/@layout.tsx,
 *     src/@components/*, src/@pages/*, src/@lib/*, ...) are routed by the
 *     connector system to their special template locations, e.g.
 *     src/@app.tsx -> template/react/src/App.tsx + template/expo/app/index.tsx.
 *   - Dynamic route files are routed the same way, e.g.
 *     src/@pages/[id].tsx -> template/expo/app/[id].tsx (expo-router dynamic
 *     segment) and template/react/src/pages/[id].tsx.
 *   - Everything else falls back to a raw 1:1 copy at the same relative path in
 *     every enabled template.
 *
 * The connectors run first and a raw copy is only the fallback, which is what
 * makes a live edit land where a full sync would put it.
 */

const fs = require("fs");
const path = require("path");
const { syncSingleFile, removeSingleFile } = require("../connector");
const { PACKAGE_ROOT } = require("../support/paths");
const { isDynamicRoute, enabledTemplateDirs } = require("./paths");

/**
 * Raw fallback: mirror a file 1:1 into a template dir at the same relative
 * path. Only used when no route connector's pattern matches the file.
 */
function rawSyncToTemplate(rootPath, targetDir) {
  const relative = path.relative(PACKAGE_ROOT, rootPath);
  const dest = path.join(targetDir, relative);
  const destDir = path.dirname(dest);

  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  try {
    fs.copyFileSync(rootPath, dest);
    console.log(`[live] synced (raw): ${relative} -> ${path.relative(PACKAGE_ROOT, dest)}`);
  } catch (err) {
    console.error(`[live] failed to sync ${relative}: ${err.message}`);
  }
}

/** Raw fallback removal, mirroring rawSyncToTemplate. */
function rawRemoveFromTemplate(rootPath, targetDir) {
  const relative = path.relative(PACKAGE_ROOT, rootPath);
  const dest = path.join(targetDir, relative);

  try {
    if (fs.existsSync(dest)) {
      fs.unlinkSync(dest);
      console.log(`[live] removed: ${path.relative(PACKAGE_ROOT, dest)}`);
    }
  } catch (err) {
    console.error(`[live] failed to remove ${relative}: ${err.message}`);
  }
}

/**
 * Handle a changed root file: route-aware connectors first (this is what puts
 * src/@app.tsx / src/@pages/[id].tsx in their special template locations);
 * only fall back to a raw copy for files no connector's pattern matches.
 */
function handleChangedFile(filePath, config) {
  const handled = syncSingleFile(filePath, config, PACKAGE_ROOT);
  if (handled) {
    if (isDynamicRoute(filePath)) {
      console.log(`[live] dynamic route synced: ${path.relative(PACKAGE_ROOT, filePath)}`);
    }
    return;
  }

  for (const targetDir of enabledTemplateDirs(config)) {
    rawSyncToTemplate(filePath, targetDir);
  }
}

/** Handle a deleted root file, mirroring handleChangedFile's routing. */
function handleRemovedFile(filePath, config) {
  const handled = removeSingleFile(filePath, config, PACKAGE_ROOT);
  if (handled) return;

  for (const targetDir of enabledTemplateDirs(config)) {
    rawRemoveFromTemplate(filePath, targetDir);
  }
}

module.exports = { handleChangedFile, handleRemovedFile, rawSyncToTemplate, rawRemoveFromTemplate };
