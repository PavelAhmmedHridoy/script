/**
 * converter/macro/table.js — what a platform macro is.
 *
 * The tables every other macro module reads from:
 *
 *   MACROS        name -> the platform that keeps the call. Membership is also
 *                 what makes an identifier a macro at all, so the scanner, the
 *                 import lifter and doctor all read the same list.
 *   VALUE_MACROS  the subset whose argument is a value to keep or blank rather
 *                 than a callback to run.
 *   BRACE_PAIR    the block macros' complement, for the brace form
 *                 `useWeb{ A }:useApp{ B }`.
 *
 * Data only, no scanning and no editing, so each of the passes can require it
 * without a cycle.
 */

/** Macro name -> the platform that keeps it. */
const MACROS = {
  useWeb: "web",
  useApp: "native",
  classWeb: "web",
  classApp: "native",
};

/**
 * Macros whose argument is a value to keep or blank, rather than a callback to
 * run. The callback form is a function body; this form is a className string,
 * appended at the end of the enclosing className on the kept platform instead
 * of substituting in place, and never a statement to delete.
 */
const VALUE_MACROS = new Set(["classWeb", "classApp"]);

/** The platforms a file can be generated for. */
const PLATFORMS = new Set(["web", "native"]);

/**
 * The complement each block macro pairs with in the brace form
 * `useWeb{ A }:useApp{ B }` — either order, one construct. Only these two
 * pair: the class macros have their own bare-attribute shorthand instead.
 */
const BRACE_PAIR = {
  useWeb: "useApp",
  useApp: "useWeb",
};

/**
 * The authoring-only module the macros are imported from.
 *
 * Both accepted spellings name the same file while authoring: the plain
 * relative form (`script/authoring/platform`) and the `@script/` alias form
 * (`@script/authoring/platform`). Either way the import must be lifted back
 * out — the shim exists only so the editor and `tsc` resolve the calls.
 */
const AUTHORING_MODULE_RE = /(?:^|\/)authoring\/platform$/;
const AUTHORING_ALIAS_PREFIX = "@script/";

module.exports = {
  MACROS,
  VALUE_MACROS,
  PLATFORMS,
  BRACE_PAIR,
  AUTHORING_MODULE_RE,
  AUTHORING_ALIAS_PREFIX,
};
