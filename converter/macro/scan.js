/**
 * converter/macro/scan.js — finding macro calls in a source file.
 *
 * Everything here is a character walk, because the converter has no parser and
 * a naive regex is wrong on real code: a `useWeb(` inside a string, a macro
 * name in a comment, or a `${...}` hole in a template literal all have to read
 * exactly as JavaScript means them.
 *
 * The one non-obvious rule: a template literal is *both* prose and code. Its
 * text is skipped — `"classWeb(\"x\")"` is a string, not a call — but each
 * `${ ... }` hole is handed back to the scanner, because
 *
 *   `panel ${classWeb("hover:border")}`
 *
 * is a real call. Without that split, the call survives both targets and the
 * build fails at an unresolved identifier instead of converting.
 *
 * ## The brace form
 *
 * Besides the call form above, block macros accept a brace body — a paired
 * construct and a lone block:
 *
 *   useWeb{ document.title = "x" }:useApp{ Haptics.selectionAsync(); }
 *   useWeb{ document.title = "x" }
 *
 * `useWeb{ A }:useApp{ B }` is ONE construct: each target splices in its own
 * half, so the pair never has to be written as two callbacks. Scanning it is
 * a second walk (scanBraceBlocks) rather than an extension of the call walk,
 * because the dispatch character differs — `{` after the name instead of `(`
 * — and the two forms must stay exclusive: `useWeb(` is a call, `useWeb{` is
 * a block. Like the call walk it skips strings and comments, but it does not
 * descend into template-literal holes — the class macros own className, and a
 * block inside a hole is not a supported position.
 *
 * @returns nothing; the caller receives calls through the `visit` callback:
 *   {name, start, end, argText, enclosing} — byte offsets of the whole call,
 *   the text between its parentheses, and, when the call sits inside a
 *   template-literal hole, the bounds of that hole and the literal around it
 *   (see HOLE_INFO below).
 */

const { MACROS } = require("./table");

/** Index just past the string literal starting at `start`. */
function skipStringLiteral(content, start) {
  const quote = content[start];
  let i = start + 1;

  while (i < content.length) {
    const c = content[i];
    if (c === "\\") {
      i += 2;
      continue;
    }
    if (c === quote) return i + 1;
    if (c === "\n" && quote !== "`") return i; // unterminated
    i++;
  }

  return content.length;
}

/** Index just past the comment starting at `start`, or -1 if not a comment. */
function skipComment(content, start) {
  if (content[start] !== "/") return -1;

  if (content[start + 1] === "/") {
    const nl = content.indexOf("\n", start);
    return nl === -1 ? content.length : nl;
  }
  if (content[start + 1] === "*") {
    const close = content.indexOf("*/", start + 2);
    return close === -1 ? content.length : close + 2;
  }
  return -1;
}

/** Index just past the `)` matching the `(` at `openIndex`. */
function findCallEnd(content, openIndex) {
  let depth = 0;
  let i = openIndex;

  while (i < content.length) {
    const c = content[i];

    if (c === '"' || c === "'" || c === "`") {
      i = skipStringLiteral(content, i);
      continue;
    }

    const commentEnd = skipComment(content, i);
    if (commentEnd !== -1) {
      i = commentEnd;
      continue;
    }

    if (c === "(") {
      depth++;
    } else if (c === ")") {
      depth--;
      if (depth === 0) return i + 1;
    }
    i++;
  }

  return -1;
}

/**
 * Index of the `}` matching the `{` at `openIndex`, skipping over strings,
 * comments and any nested template literal.
 * @returns {number} index of the closing brace, or -1
 */
function findHoleEnd(content, openIndex) {
  let depth = 0;
  let i = openIndex;

  while (i < content.length) {
    const c = content[i];

    if (c === "`") {
      i = walkTemplateLiteral(content, i, () => {});
      continue;
    }
    if (c === '"' || c === "'") {
      i = skipStringLiteral(content, i);
      continue;
    }

    const commentEnd = skipComment(content, i);
    if (commentEnd !== -1) {
      i = commentEnd;
      continue;
    }

    if (c === "{") {
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth === 0) return i;
    }
    i++;
  }

  return -1;
}

/**
 * Walk the template literal starting at `start` (a backtick).
 *
 * The literal text is skipped — a macro name inside it is prose, not a call —
 * but each `${ ... }` hole holds real code, so those ranges are handed back to
 * `scanCode`:
 *
 *   `panel ${classWeb("hover:border")}`   the classWeb call is a real call
 *   "classWeb(\"x\")"                      this one is not
 *
 * The closing backtick is located BEFORE any hole is visited, so every hole is
 * handed the bounds of the whole literal: the class macros append their
 * compiled class at the literal's end (the tail of a className), which they
 * could not compute from the hole alone.
 *
 * @returns {number} index just past the closing backtick
 */
function walkTemplateLiteral(content, start, visit) {
  let close = start + 1;

  while (close < content.length) {
    const c = content[close];
    if (c === "\\") {
      close += 2;
      continue;
    }
    // A hole may hold a nested template literal, whose backtick is not this
    // literal's closing one — skip the whole hole before looking again.
    if (c === "$" && content[close + 1] === "{") {
      const holeEnd = findHoleEnd(content, close + 1);
      if (holeEnd === -1) {
        close = content.length;
        break;
      }
      close = holeEnd + 1;
      continue;
    }
    if (c === "`") break;
    close++;
  }

  // Unterminated literal: there is no end to append at, and the scan still
  // walks what is there so the calls are at least found and reported.
  const templateEnd = close < content.length ? close : -1;
  const limit = templateEnd === -1 ? content.length : templateEnd;
  let i = start + 1;

  while (i < limit) {
    const c = content[i];

    if (c === "\\") {
      i += 2;
      continue;
    }

    if (c === "$" && content[i + 1] === "{") {
      const end = findHoleEnd(content, i + 1);
      if (end === -1) return content.length;
      scanCode(content, i + 2, end, visit, {
        holeStart: i, // the `$`
        innerStart: i + 2, // first char inside the braces
        innerEnd: end, // the closing `}`
        outerEnd: end, // same as innerEnd; outerEnd + 1 is past the `}`
        templateEnd, // the closing backtick, or -1 when unterminated
      });
      i = end + 1;
      continue;
    }

    i++;
  }

  return templateEnd === -1 ? content.length : templateEnd + 1;
}

/**
 * Index just past the template literal starting at `start`, without visiting
 * its holes. Used by the brace walk, which treats a whole literal as opaque:
 * a `{` in its text is prose, and holes are not a supported block position.
 * @returns {number} index just past the closing backtick
 */
function skipTemplateLiteral(content, start) {
  let i = start + 1;

  while (i < content.length) {
    const c = content[i];
    if (c === "\\") {
      i += 2;
      continue;
    }
    if (c === "`") return i + 1;
    if (c === "$" && content[i + 1] === "{") {
      const end = findHoleEnd(content, i + 1);
      if (end === -1) return content.length;
      i = end + 1;
      continue;
    }
    i++;
  }

  return content.length;
}

/**
 * Index just past the `}` matching the `{` at `openIndex`, skipping strings,
 * comments and template literals on the way — the brace-block counterpart of
 * findCallEnd.
 * @returns {number} index just past the closing brace, or -1
 */
function findBraceBlockEnd(content, openIndex) {
  let depth = 0;
  let i = openIndex;

  while (i < content.length) {
    const c = content[i];

    if (c === "`") {
      i = skipTemplateLiteral(content, i);
      continue;
    }
    if (c === '"' || c === "'") {
      i = skipStringLiteral(content, i);
      continue;
    }

    const commentEnd = skipComment(content, i);
    if (commentEnd !== -1) {
      i = commentEnd;
      continue;
    }

    if (c === "{") {
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth === 0) return i + 1;
    }
    i++;
  }

  return -1;
}

/**
 * Read the `:useApp{ ... }` half that may follow a brace block at `firstEnd`.
 * Whitespace around the colon is allowed; anything else between the halves —
 * a comment, a comma, an operator — means this is a lone block, and null
 * comes back. Only macro names are accepted after the colon, and the half
 * must open its own brace body that closes.
 *
 * @param {string} content
 * @param {number} firstEnd - index just past the first block's closing `}`
 * @returns {{name:string, start:number, end:number, bodyStart:number,
 *   bodyEnd:number}|null}
 */
function findPairedBraceBlock(content, firstEnd) {
  let i = firstEnd;
  while (/\s/.test(content[i] ?? "")) i++;
  if (content[i] !== ":") return null;
  i++;

  let name = null;
  for (const candidate of Object.keys(MACROS)) {
    if (content.startsWith(candidate, i)) {
      name = candidate;
      break;
    }
  }
  if (!name) return null;

  let j = i + name.length;
  if (/[A-Za-z0-9_$]/.test(content[j] ?? "")) return null; // `:useAppX{`
  while (/\s/.test(content[j] ?? "")) j++;
  if (content[j] !== "{") return null;

  const close = findBraceBlockEnd(content, j);
  if (close === -1) return null;

  return { name, start: i, end: close, bodyStart: j + 1, bodyEnd: close - 1 };
}

/**
 * Visit every brace-form block macro in `content`: a lone `useWeb{ A }` and
 * the paired `useWeb{ A }:useApp{ B }`, in either half order. Skips strings,
 * comments and template literals wholesale — unlike the call walk, it does
 * not descend into `${ ... }` holes.
 *
 * A `{` after the name dispatches here only when the walk can balance it to
 * a closing `}`; a call, a mention and an object key (`{ useWeb: ... }`) are
 * all left for — or ignored by — the call walk.
 *
 * The visit receives byte offsets:
 *
 *   {name, pairName, start, end, bodyStart, bodyEnd,
 *    pairStart, pairEnd, pairBodyStart, pairBodyEnd}
 *
 * `pairName` is the complement when the construct is a pair and null when
 * lone; `pair*` are -1 in the lone case. `start`/`end` cover the WHOLE
 * construct — the splicer always rewrites from the leading name.
 *
 * @param {string} content
 * @param {(block: object) => void} visit
 */
function scanBraceBlocks(content, visit) {
  const names = Object.keys(MACROS);
  let i = 0;

  while (i < content.length) {
    const c = content[i];

    if (c === "`") {
      i = walkTemplateLiteral(content, i, () => {});
      continue;
    }
    if (c === '"' || c === "'") {
      i = skipStringLiteral(content, i);
      continue;
    }

    const commentEnd = skipComment(content, i);
    if (commentEnd !== -1) {
      i = commentEnd;
      continue;
    }

    let matched = false;

    for (const name of names) {
      if (!content.startsWith(name, i)) continue;

      const before = content[i - 1];
      if (before && /[A-Za-z0-9_$]/.test(before)) continue; // `myuseWeb`

      let j = i + name.length;
      if (/[A-Za-z0-9_$]/.test(content[j] ?? "")) continue; // `useWebThing`

      while (/\s/.test(content[j] ?? "")) j++;
      if (content[j] !== "{") continue; // a call form, a mention, an object key

      const close = findBraceBlockEnd(content, j);
      if (close === -1) continue; // unbalanced: leave it alone

      const pair = findPairedBraceBlock(content, close);
      const end = pair ? pair.end : close;

      visit({
        name,
        pairName: pair ? pair.name : null,
        start: i,
        end,
        bodyStart: j + 1,
        bodyEnd: close - 1,
        pairStart: pair ? pair.start : -1,
        pairEnd: pair ? pair.end : -1,
        pairBodyStart: pair ? pair.bodyStart : -1,
        pairBodyEnd: pair ? pair.bodyEnd : -1,
      });
      i = end;
      matched = true;
      break;
    }

    if (!matched) i++;
  }
}

/**
 * Visit every macro call identifier in `content`.
 * Skips strings and comments so a mention inside either is not a macro, but
 * descends into the `${ ... }` holes of a template literal, which are code.
 * @param {string} content
 * @param {(call: {name:string, start:number, end:number, argText:string,
 *   enclosing:object|null}) => void} visit
 */
function scanMacroCalls(content, visit) {
  scanCode(content, 0, content.length, visit, null);
}

/**
 * The scanner behind scanMacroCalls, over the half-open range [from, to) —
 * which is the whole file at the top level, and one interpolation hole when a
 * template literal is being walked.
 *
 * `enclosing` describes the hole this range came from (null at the top level):
 * {holeStart, innerStart, innerEnd, outerEnd, templateEnd}. A macro call found
 * deeper — inside a nested template's own hole — carries that inner hole
 * instead: the innermost literal is the one its compiled class appends to.
 */
function scanCode(content, from, to, visit, enclosing) {
  const names = Object.keys(MACROS);
  let i = from;

  while (i < to) {
    const c = content[i];

    if (c === "`") {
      i = walkTemplateLiteral(content, i, visit);
      continue;
    }

    if (c === '"' || c === "'") {
      i = skipStringLiteral(content, i);
      continue;
    }

    const commentEnd = skipComment(content, i);
    if (commentEnd !== -1) {
      i = commentEnd;
      continue;
    }

    let matched = false;

    for (const name of names) {
      if (!content.startsWith(name, i)) continue;

      const before = content[i - 1];
      if (before && /[A-Za-z0-9_$]/.test(before)) continue; // `myuseWeb`

      let j = i + name.length;
      if (/[A-Za-z0-9_$]/.test(content[j] ?? "")) continue; // `useWebThing`

      while (/\s/.test(content[j] ?? "")) j++;
      if (content[j] !== "(") continue; // a mention, not a call

      const end = findCallEnd(content, j);
      if (end === -1) continue;

      visit({ name, start: i, end, argText: content.slice(j + 1, end - 1), enclosing });
      i = end;
      matched = true;
      break;
    }

    if (!matched) i++;
  }
}

module.exports = {
  skipStringLiteral,
  skipComment,
  findCallEnd,
  findHoleEnd,
  walkTemplateLiteral,
  skipTemplateLiteral,
  findBraceBlockEnd,
  findPairedBraceBlock,
  scanMacroCalls,
  scanBraceBlocks,
  scanCode,
};
