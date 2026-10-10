/**
 * connector/resolver/aliases.js — alias rewriting using the central path model.
 *
 * Rewrites authoring-relative imports for each target, using the same
 * dynamic @folder resolution as the rest of the system.
 *
 * DYNAMIC @FOLDER RESOLUTION:
 *   - Only @app, @pages, @layout are reserved semantic constructs
 *   - EVERY other @segment is dynamically treated as an ordinary folder
 *   - The @ prefix is simply removed
 *   - No hardcoded folder names. No registry. Fully dynamic.
 */

const { applyEdits, findImports, maskCode } = require("../../converter/imports");

/** Reserved semantic segments that have special handling. */
const RESERVED_SEMANTIC = new Set(["app", "pages", "layout"]);

/**
 * Map a folder name to its target form.
 * For reserved semantic folders, returns the known mapping.
 * For dynamic folders, simply removes the @ prefix.
 */
function mapFolder(folder) {
  if (!folder.startsWith("@")) return folder;

  const segment = folder.slice(1);

  if (segment === "layout") return null;
  if (segment === "app") return "app";
  if (segment === "pages") return "pages";

  // Dynamic folder: just remove the @
  return segment;
}

/**
 * Strip the leading @/ alias from an authoring specifier.
 */
function stripRootAlias(spec) {
  return spec === "@/" ? "./" : spec.startsWith("@/") ? `./${spec.slice(2)}` : spec;
}

/**
 * Check if a specifier points at the author's layout file.
 */
function isLayoutSpecifier(spec) {
  return spec.includes("/@layout") || spec === "@layout" || spec.startsWith("@layout");
}

/**
 * Rewrite one specifier for a destination at a given depth.
 */
function rewriteSpecifier(spec, depth = 0) {
  if (!spec.includes("@")) return spec;

  spec = stripRootAlias(spec);

  const folderMatch = /@([\w-]+)(?=\/)/.exec(spec);
  if (!folderMatch) return spec;

  const folder = folderMatch[1];

  if (folder === "layout") return spec;

  const mapped = mapFolder(`@${folder}`);
  if (!mapped) return spec;

  const prefix = depth > 0 ? "../".repeat(depth) : "./";
  const rest = spec.slice(folderMatch.index + folderMatch[0].length);
  return prefix + mapped + rest;
}

/**
 * Rewrite every authoring-relative specifier in content for a destination
 * at a given depth below the target's shared-folder root.
 */
function rewriteAuthoringImports(content, depth = 0) {
  if (!content.includes("@")) return content;

  const mask = maskCode(content);
  const imports = findImports(content);
  const edits = [];

  for (const imp of imports) {
    if (!imp.source) continue;

    if (!imp.source.startsWith(".") && !imp.source.startsWith("@/")) continue;

    const source = stripRootAlias(imp.source);

    if (isLayoutSpecifier(source)) continue;
    if (!source.includes("@")) continue;

    const rewritten = rewriteSpecifier(source, depth);
    if (rewritten === source) continue;

    const text = content.slice(imp.start, imp.end);
    const at = text.indexOf(imp.source);
    if (at === -1) continue;

    const start = imp.start + at;
    if (!mask[start]) continue;

    edits.push({ start, end: start + imp.source.length, text: rewritten });
  }

  return edits.length === 0 ? content : applyEdits(content, edits);
}

module.exports = {
  rewriteAuthoringImports,
  rewriteSpecifier,
  stripRootAlias,
  isLayoutSpecifier,
  mapFolder,
};
