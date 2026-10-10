/**
 * converter/macro/callback.js — reading the function a block macro takes.
 *
 * `useWeb(fn)` / `useApp(fn)` are only transformable when the argument is a
 * single function whose body can be lifted out verbatim. Anything else — a
 * spread, a call, a variable holding a callback, a parameter list with a
 * default that spans a comment — is deliberately *not* guessed at: the caller
 * leaves the call untouched and reports it, so the build fails at a real
 * unresolved identifier instead of silently dropping code.
 *
 * Both spellings are accepted, and they are not equivalent downstream:
 *
 *   () => { … }   a block. Kept as an IIFE so `return` and scope stay the
 *                 callback's instead of leaking into the surrounding function.
 *   () => expr    a single expression. Inlined as `(expr)`.
 */

const { skipStringLiteral } = require("./scan");

/** Arrow-function parameter lists we are willing to unwrap. */
const PARAM_LIST_RE = /^\(?\s*[\w$,\s:[\]{}|.<>=]*\)?$/;

/** Index of the `=>` at depth 0 in `text`, or -1. */
function findTopLevelArrow(text) {
  let depth = 0;
  let i = 0;

  while (i < text.length) {
    const c = text[i];

    if (c === '"' || c === "'" || c === "`") {
      i = skipStringLiteral(text, i);
      continue;
    }
    if ("([{".includes(c)) depth++;
    else if (")]}".includes(c)) depth--;
    else if (c === "=" && text[i + 1] === ">" && depth === 0) return i;
    i++;
  }

  return -1;
}

/**
 * Read the callback passed to a macro.
 * @param {string} argText - the text between the macro's parentheses
 * @returns {{body:string, isBlock:boolean, source:string}|null}
 *   null when the argument is not a single function we can safely unwrap.
 */
function readCallback(argText) {
  const source = argText.trim();
  if (!source) return null;

  const arrowAt = findTopLevelArrow(source);

  if (arrowAt !== -1) {
    const params = source.slice(0, arrowAt).trim();
    if (!PARAM_LIST_RE.test(params)) return null;

    let body = source.slice(arrowAt + 2).trim();
    if (!body) return null;

    // `() => { ... }` is a block; `() => expr` is a single expression.
    if (body.startsWith("{")) {
      if (!body.endsWith("}")) return null;
      return { body: body.slice(1, -1), isBlock: true, source };
    }
    return { body, isBlock: false, source };
  }

  const fnMatch = /^(?:async\s+)?function\b[^{]*\{([\s\S]*)\}$/.exec(source);
  if (fnMatch) return { body: fnMatch[1], isBlock: true, source };

  return null;
}

module.exports = { readCallback, findTopLevelArrow, PARAM_LIST_RE };
