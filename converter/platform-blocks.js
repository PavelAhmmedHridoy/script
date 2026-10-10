/**
 * converter/platform-blocks.js — build-time platform macros.
 *
 * `useWeb(fn)` / `useApp(fn)` and `classWeb(str)` / `classApp(str)` are macros,
 * not functions. They are resolved while a source file is synced into each
 * template, so a single file in src/ can hold platform-specific code — and
 * platform-specific *classes* — without any runtime branching:
 *
 *                          web output            native output
 *   useWeb(() => { ... })  kept                  deleted
 *   useApp(() => { ... })  deleted               kept
 *   classWeb("hover:x")    appended at the       ""
 *                          end of className
 *   classApp("min-h-11")   ""                    appended at the
 *                                                end of className
 *
 * Both class macros also have a bare-attribute shorthand for when the only
 * thing an element needs is one platform-specific class — no template
 * literal to open just to hold the call:
 *
 *   <span classWeb="hover:x" className="panel">   web output adds "hover:x"
 *                                                  to className; native just
 *                                                  drops the attribute,
 *                                                  className unchanged
 *
 * See macro/attrs.js for that pass; everything below is the call form.
 *
 * The class macros exist because the two dialects are not the same Tailwind:
 * the web target compiles Tailwind v4 against a real DOM, where `hover:`,
 * `cursor-pointer`, `transition-*`, `md:*` and `font-mono` all mean something,
 * while the native target compiles NativeWind against React Native, where they
 * do not (and where an unresolvable `fontFamily` is worse than no rule at all).
 * A kept class macro appends its class at the end of the enclosing className
 * (see macro/build.js); the dropped platform gets "" and no append, so the
 * class never reaches a stylesheet that could not apply it.
 * Both class forms take a single argument: a string, or any expression that
 * evaluates to one.
 *
 * A call that cannot be parsed is deliberately left alone and reported, so the
 * build fails loudly at the unresolved identifier instead of silently dropping
 * code.
 *
 * The work is split across converter/macro/, one concern per file, and the
 * public surface stays here:
 *
 *   macro/table.js     the macro tables — which names exist, which platform
 *                      keeps each, where they are imported from
 *   macro/scan.js      finding calls: strings, comments and template-literal
 *                      holes read as JavaScript means them
 *   macro/callback.js  reading the function a block macro takes, or refusing
 *   macro/build.js     splices, the fixed-point pass, lifting the import
 *
 * Every other module keeps requiring this path, and `doctor` keeps scanning for
 * the macro names themselves, so nothing outside has to know the split exists.
 */

const { applyPlatformBlocks, hasMacroCalls } = require("./macro/build");
const { readCallback } = require("./macro/callback");
const { scanMacroCalls } = require("./macro/scan");
const { applyAttrMacros } = require("./macro/attrs");
const { applyImportScopes } = require("./macro/import-scope");
const {
  MACROS,
  VALUE_MACROS,
  PLATFORMS,
  AUTHORING_MODULE_RE,
} = require("./macro/table");

module.exports = {
  applyPlatformBlocks,
  hasMacroCalls,
  readCallback,
  scanMacroCalls,
  applyAttrMacros,
  applyImportScopes,
  MACROS,
  VALUE_MACROS,
  PLATFORMS,
  AUTHORING_MODULE_RE,
};
