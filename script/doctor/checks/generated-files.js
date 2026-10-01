/**
 * checks/generated-files.js — check 6: no build-time macro or generator path
 * leaked into a generated file.
 *
 * `useWeb` / `useApp` / `classWeb` / `classApp` are resolved at build time and
 * `script/authoring/platform` must never reach a template, because it throws if
 * it is ever evaluated. A hit here means a file was copied rather than
 * converted.
 */

const fs = require("fs");
const path = require("path");
const { ok, fail } = require("../results");

/** Files never scanned when checking for leaked generator references. */
const SKIP_DIRS = new Set(["node_modules", ".expo", "dist", "web-build", ".git", "ios", "android"]);

/** Extensions that could carry a macro call. */
const SOURCE_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".css"]);

/**
 * What a leaked macro or generator import looks like — the call form
 * (`classWeb(...)`) and the bare-attribute shorthand (`classWeb="..."` as a
 * plain JSX prop, see converter/macro/attrs.js) both count: either one
 * reaching a generated file means it was copied rather than converted.
 */
const MACRO_RE =
  /useWeb\s*\(|useApp\s*\(|classWeb\s*\(|classApp\s*\(|classWeb\s*=|classApp\s*=|authoring\/platform/;

/** How many offending files to name before collapsing the list. */
const MAX_LISTED = 5;

/** Yield source files under `dir`, skipping build output and dependencies. */
function* walk(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (SOURCE_EXT.has(path.extname(entry.name).toLowerCase())) yield full;
  }
}

/** Files under one template that still reference the generator or a macro. */
function leaksIn(templateDir, packageRoot) {
  const leaks = [];

  for (const file of walk(templateDir)) {
    let content;
    try {
      content = fs.readFileSync(file, "utf-8");
    } catch {
      continue;
    }
    if (MACRO_RE.test(content)) leaks.push(path.relative(packageRoot, file));
  }

  return leaks;
}

/**
 * @param {string} packageRoot
 * @param {string[]} templates - enabled template names
 * @returns {Array} a single ok/fail entry
 */
function checkGeneratedFiles(packageRoot, templates) {
  const leaks = templates.flatMap((template) => leaksIn(path.join(packageRoot, "template", template), packageRoot));

  if (leaks.length === 0) return [ok("generated files", "no macro or generator references")];

  return [
    fail(
      "generated files",
      `macro/generator reference left in: ${leaks.slice(0, MAX_LISTED).join(", ")}`
    ),
  ];
}

module.exports = { checkGeneratedFiles, leaksIn, SKIP_DIRS, MACRO_RE };
