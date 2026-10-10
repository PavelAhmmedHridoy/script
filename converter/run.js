/**
 * converter/run.js — converting files, directories, and the CLI entry.
 *
 * The write side of the converter: read a source file, hand its content to
 * converter/transform.js, and write the result only when it differs. Everything
 * about *how* the content changes lives in transform.js; everything about
 * *where it goes* came from the connectors that called convertFile.
 */

const fs = require("fs");
const path = require("path");
const { transform, setCurrentSource } = require("./transform");
const { writeIfChanged } = require("../io");
const { PACKAGE_ROOT } = require("../support/paths");

/**
 * Convert a file from root to template.
 * @param {string} src - Source file path (absolute)
 * @param {string} dest - Destination file path (absolute)
 * @param {object} options - Conversion options; the connectors build these
 *   with directionOptions(config.source, template) (converter/direction.js).
 * @param {boolean} [options.applyRNTransform=true] - Apply RN transformations
 * @param {boolean} [options.useWebTransform] - Force the native->web pass on/off
 * @param {"web"|"native"} [options.platform] - Target platform
 * @param {function} [options.transform] - Connector hook run after the built-ins
 */
function convertFile(src, dest, options = {}) {
  setCurrentSource(src);
  try {
    const content = fs.readFileSync(src, "utf-8");

    // Depth of the destination below its template's shared-folder root — what
    // authoring-relative imports must climb back to. template/react's shared
    // folders live under src/, template/expo's at its root.
    const destRel = path.relative(path.join(PACKAGE_ROOT, "template"), dest);
    const templateName = destRel.split(path.sep)[0];
    const baseDir = templateName === "react" ? 1 : 0;
    const depth = path
      .dirname(dest)
      .split(path.sep)
      .filter(Boolean)
      .length -
      (path.join(PACKAGE_ROOT, "template", templateName).split(path.sep).filter(Boolean).length + baseDir);

    const output = transform(content, src, { ...options, dest, depth: Math.max(0, depth) });

    // Only touch the file when the output actually differs. A full sync on an
    // unchanged tree must leave every template file alone, or Metro/Vite see
    // the whole graph as modified and rebuild it for nothing.
    if (!writeIfChanged(dest, output)) return;

    const relSrc = path.relative(PACKAGE_ROOT, src);
    const relDest = path.relative(PACKAGE_ROOT, dest);
    console.log(`[converter] ${relSrc} -> ${relDest}`);
  } catch (err) {
    console.error(`[converter] Failed: ${err.message}`);
  } finally {
    setCurrentSource(null);
  }
}

/**
 * Sync a directory recursively.
 * @param {string} srcDir - Source directory
 * @param {string} destDir - Destination directory
 * @param {string[]} ignore - Patterns to ignore
 */
function syncDir(srcDir, destDir, ignore = ["node_modules", ".git", "dist", "build"]) {
  if (!fs.existsSync(srcDir)) return;

  const entries = fs.readdirSync(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    if (ignore.includes(entry.name)) continue;

    const src = path.join(srcDir, entry.name);
    const dest = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      syncDir(src, dest, ignore);
    } else {
      convertFile(src, dest);
    }
  }
}

/**
 * `npm run convert` — convert src/ for every enabled target, then stay live.
 *
 *   node script/converter/index.js           full pass, then keep watching
 *   node script/converter/index.js --once    full pass only (what `sync` does)
 *
 * The pass itself is the connector sweep, so every file is routed to the same
 * place `npm run sync` puts it; "live" then hands over to the watcher, which
 * re-runs the same routing (transform hooks included) on every save, so a live
 * edit produces byte-identical output to a full pass.
 *
 * connector/ and watcher/ are required lazily: both require this module back,
 * and by the time main() runs this module's exports are already assigned.
 *
 * @param {string[]} [argv]
 * @returns {number} exit code
 */
function main(argv = process.argv.slice(2)) {
  const once = argv.includes("--once") || argv.includes("--no-watch");

  const { loadConfig } = require("../support/config");
  const { syncConnectors } = require("../connector");
  const { startWatchers } = require("../watcher");

  const config = loadConfig();

  console.log("[converter] converting src/ -> enabled templates...");
  syncConnectors(config);
  console.log("[converter] pass complete.");

  if (once) return 0;

  const watchers = startWatchers(config);
  if (watchers.length === 0) {
    console.error("[converter] live watch did not start — see the preflight errors above.");
    return 1;
  }

  process.on("SIGINT", () => {
    console.log("\n[converter] stopping live watch...");
    watchers.forEach((watcher) => watcher.close());
    process.exit(0);
  });

  return 0;
}

module.exports = { convertFile, syncDir, main };
