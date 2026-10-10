/**
 * converter/aliases.js — rewrite authoring-relative imports for each target.
 *
 * An authoring file inside `src/` imports its siblings the way they are laid
 * out in src/:
 *
 *   import Card from "../@components/Card";   // from src/@pages/
 *   import Card from "./@components/Card";    // from src/@app.tsx
 *   import { useCounter } from "../@hooks/useCounter";
 *
 * The templates keep the same folders but without the "@" prefix — and at a
 * different depth per target, because the expo target's routes live in app/
 * while its shared folders live at the template root:
 *
 *   web  src/App.tsx            ->  ./components/Card
 *   web  src/pages/counter.tsx  ->  ../components/Card
 *   expo app/index.tsx          ->  ../components/Card
 *   expo app/about.tsx          ->  ../components/Card
 *
 * So the correct prefix cannot come from the authored specifier — it comes
 * from how deep the destination file sits below its template's shared-folder
 * root (template/react/src for web, template/expo for native). convertFile
 * computes that depth and hands it in; `../`.repeat(depth) is the prefix.
 *
 * Specifiers are edited in place with the same code mask as the module
 * rewriter, so a string or comment mentioning "@components" is untouched.
 *
 * DYNAMIC @FOLDER RESOLUTION:
 *   - Only @app, @pages, @layout are reserved semantic constructs
 *   - EVERY other @segment is dynamically treated as an ordinary folder
 *   - No FOLDER_MAP registry — the @ prefix is simply removed
 *   - Works for ANY folder name: @r, @foo, @services, @anything, etc.
 *   - Works for nested folders: @foo/@bar/@baz/test.tsx
 */

const { applyEdits, findImports, maskCode } = require("./imports");

/**
 * Reserved semantic segments that have special handling.
 * These are the ONLY hardcoded names — everything else is dynamic.
 */
const RESERVED_SEMANTIC = new Set(["app", "pages", "layout"]);

/**
 * Map a folder name to its target form.
 * For reserved semantic folders, returns the known mapping.
 * For dynamic folders, simply removes the @ prefix.
 *
 * @param {string} folder - folder name with @ prefix, e.g. "@components"
 * @returns {string|null} mapped folder name without @, or null if not a routable folder
 */
function mapFolder(folder) {
  if (!folder.startsWith("@")) return folder;
  
  const segment = folder.slice(1); // Remove @
  
  // Reserved semantic folders
  if (segment === "layout") return null; // entry convention, not a routable folder
  if (segment === "app") return "app";
  if (segment === "pages") return "pages";
  
  // Dynamic folder: just remove the @
  // This works for ANY folder name: @components, @hooks, @lib, @utils,
  // @styles, @r, @foo, @bar, @services, @anything, etc.
  return segment;
}

/**
 * True when the specifier points at the author's layout file. The web target
 * keeps it under its authored name next to App.tsx ([layout].js), so its
 * specifier is left exactly as written.
 */
function isLayoutSpecifier(spec) {
  return /\/@layout(\.[jt]sx?)?$/.test(spec) || /^@layout(\.[jt]sx?)?$/.test(spec);
}

/**
 * Strip the leading `@/` alias from an authoring specifier.
 *
 * `src/` is the only place imports can be authored, and the connector keeps
 * the shared folders (`@components`, `@hooks`, ...) under the file they route
 * to, so `@/` carries no routing information of its own — it just means "from
 * the authoring root". Normalising it first lets the relative-form rewrite
 * below do all the work:
 *
 *   "@/@hooks/useCounter"  ->  "./@hooks/useCounter"
 *   "@/@lib/format"        ->  "./@lib/format"
 *
 * A bare `@/` (the authoring root itself) becomes `./`. Anything without the
 * leading alias — relative specifiers, `@script/...`, scoped packages — is
 * returned unchanged.
 *
 * @param {string} spec
 * @returns {string}
 */
function stripRootAlias(spec) {
  return spec === "@/" ? "./" : spec.startsWith("@/") ? `./${spec.slice(2)}` : spec;
}

/**
 * One specifier -> one target specifier, at `depth` levels below the
 * template's shared-folder root.
 *
 *   rewriteSpecifier("./@components/Card", 0)  -> "./components/Card"
 *   rewriteSpecifier("./@components/Card", 1)  -> "../components/Card"
 *   rewriteSpecifier("./../@lib/format", 2)    -> "../../lib/format"
 *   rewriteSpecifier("../@app/detail", 1)      -> "../app/detail"
 *
 * DYNAMIC @FOLDER EXAMPLES:
 *   rewriteSpecifier("./@services/api", 0)     -> "./services/api"
 *   rewriteSpecifier("./@foo/bar", 2)          -> "../../foo/bar"
 *   rewriteSpecifier("./@r/t", 1)              -> "../r/t"
 *   rewriteSpecifier("./@foo/@bar/baz", 0)     -> "./foo/@bar/baz" (first @ only)
 *
 * A specifier with no @-folder segment (./helpers, @script/authoring/platform,
 * @tailwindcss/vite) is returned unchanged.
 *
 * @param {string} spec
 * @param {number} depth
 * @returns {string}
 */
function rewriteSpecifier(spec, depth = 0) {
  if (!spec.includes("@")) return spec;

  // `@/@hooks/useCounter` and `./@hooks/useCounter` are the same import: the
  // root alias is pure authoring sugar, so strip it before matching folders.
  spec = stripRootAlias(spec);

  // Match the first @folder segment
  const folderMatch = /@([\w-]+)(?=\/)/.exec(spec);
  if (!folderMatch) return spec;

  const folder = folderMatch[1];
  
  // Check for reserved semantic folders
  if (folder === "layout") return spec; // entry-level convention, kept as-is
  
  // Get the mapped folder name (dynamic for non-reserved, fixed for semantic)
  const mapped = mapFolder(`@${folder}`);
  if (!mapped) return spec;

  const prefix = depth > 0 ? "../".repeat(depth) : "./";
  // Everything after the `@folder` token (e.g. "/Card", "/format") travels
  // along — the lookahead in the regex only *checked* the slash, it did not
  // consume it, so the segment after the folder is preserved verbatim.
  const rest = spec.slice(folderMatch.index + folderMatch[0].length);
  return prefix + mapped + rest;
}

/**
 * Rewrite every authoring-relative specifier in `content` for a destination
 * `depth` levels below its template's shared-folder root.
 *
 * @param {string} content
 * @param {number} [depth]
 * @returns {string}
 */
function rewriteAuthoringImports(content, depth = 0) {
  if (!content.includes("@")) return content;

  const mask = maskCode(content);
  const imports = findImports(content);
  const edits = [];

  for (const imp of imports) {
    if (!imp.source) continue;

    // Accept both the relative form (./@components/Card) and the root-alias
    // form (@/@components/Card) as the same authoring convention.
    if (!imp.source.startsWith(".") && !imp.source.startsWith("@/")) continue;
    const source = stripRootAlias(imp.source);
    if (isLayoutSpecifier(source)) continue;
    if (!source.includes("@")) continue;

    const rewritten = rewriteSpecifier(source, depth);
    if (rewritten === source) continue;

    // The specifier sits inside the statement; find its exact offsets.
    const text = content.slice(imp.start, imp.end);
    const at = text.indexOf(imp.source);
    if (at === -1) continue;

    const start = imp.start + at;
    if (!mask[start]) continue; // inside a comment (defensive)

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
