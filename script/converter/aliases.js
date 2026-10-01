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
 */

const { applyEdits, findImports, maskCode } = require("./imports");

/**
 * Authoring folder prefix -> the folder it becomes in the templates.
 * `@layout` is deliberately absent: it is an entry-level convention handled
 * by [entry].js, not a routable folder.
 */
const FOLDER_MAP = {
  "@app": "app",
  "@pages": "pages",
  "@components": "components",
  "@hooks": "hooks",
  "@lib": "lib",
  "@utils": "utils",
  "@styles": "styles",
};

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

  const folderMatch = /@([\w-]+)(?=\/)/.exec(spec);
  if (!folderMatch) return spec;

  const folder = folderMatch[1];
  if (folder === "layout") return spec; // entry-level convention, kept as-is

  const mapped = FOLDER_MAP[`@${folder}`];
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
  FOLDER_MAP,
};
