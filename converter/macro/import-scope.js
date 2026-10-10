/**
 * converter/macro/import-scope.js — platform-scoped static imports.
 *
 * `useWeb`/`useApp` already scope a callback or an expression to one
 * platform (see macro/build.js). An `import` declaration cannot be wrapped
 * the same way — imports are hoisted, static declarations, not expressions,
 * so `useWeb(() => { import X from "y" })` is not valid JS/TS at all. A
 * platform-scoped import is written as a trailing directive comment instead:
 *
 *   import RexpoLogoWeb from "./rexpo-logo.svg";        // useWeb
 *   import RexpoLogoNative from "./rexpo-logo-native";  // useApp
 *
 * This pass deletes the whole statement — comment included — on the platform
 * that does not keep it. It runs as part of applyPlatformBlocks, which is
 * step 1 of converter/transform.js and also what deps/scan.js runs over
 * content before extracting specifiers, so by the time module
 * auto-detection, the RN tag pass, or the dependency scanner ever see the
 * file, the other platform's import — and whatever package or asset it
 * names — has already been removed. Neither target's bundler is ever asked
 * to resolve a module that only exists for the other one.
 *
 * The two imports can share a local name in the *output*, since only one
 * survives per target — but not while authoring, when both lines are live in
 * the same file at once and a shared name is a real duplicate-declaration
 * error. Give them different names instead, and resolve the single binding
 * you actually use with the existing expression form:
 *
 *   const RexpoLogo = useWeb(() => RexpoLogoWeb) ?? useApp(() => RexpoLogoNative);
 */

const { findImports } = require("../imports");
const { MACROS } = require("./table");

/** A trailing `// useWeb` or `// useApp` directive, anchored to end-of-line. */
const DIRECTIVE_RE = /\/\/\s*(useWeb|useApp)\s*$/;

/**
 * @param {string} content
 * @param {"web"|"native"} platform
 * @returns {string}
 */
function applyImportScopes(content, platform) {
  if (!content.includes("useWeb") && !content.includes("useApp")) return content;

  const imports = findImports(content);
  if (imports.length === 0) return content;

  const edits = [];

  for (const imp of imports) {
    // The directive has to sit on the import's own line: look from the end
    // of the statement to the next newline (or EOF), not past it.
    const lineEnd = content.indexOf("\n", imp.end);
    const tailEnd = lineEnd === -1 ? content.length : lineEnd;
    const tail = content.slice(imp.end, tailEnd);

    const match = DIRECTIVE_RE.exec(tail);
    if (!match) continue;

    const kept = MACROS[match[1]] === platform;

    if (kept) {
      // Keep the import, drop just the now-meaningless directive comment
      // and any incidental whitespace it leaves before end-of-line.
      let start = imp.end + tail.indexOf(match[0]);
      while (start > imp.end && (content[start - 1] === " " || content[start - 1] === "\t")) {
        start--;
      }
      edits.push({ start, end: tailEnd, text: "" });
      continue;
    }

    // Drop the whole line — statement, directive, and its own newline — so
    // removing it never leaves a blank line behind.
    let from = imp.start;
    let back = from - 1;
    while (back >= 0 && (content[back] === " " || content[back] === "\t")) back--;
    if (back < 0 || content[back] === "\n") from = back + 1;

    let to = tailEnd;
    if (content[to] === "\r") to++;
    if (content[to] === "\n") to++;

    edits.push({ start: from, end: to, text: "" });
  }

  if (edits.length === 0) return content;

  let out = content;
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    out = out.slice(0, edit.start) + edit.text + out.slice(edit.end);
  }
  return out;
}

module.exports = { applyImportScopes, DIRECTIVE_RE };
