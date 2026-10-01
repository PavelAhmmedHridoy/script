/**
 * converter/imports/scan.js — reading JavaScript the way JavaScript means it.
 *
 * A quote is ambiguous: `import x from "y"` opens a string, but `Don't` inside
 * JSX text does not. `looksLikeStringStart` decides by looking at what precedes
 * the quote, and getting that wrong in the permissive direction is what makes a
 * naive scanner swallow the rest of the file.
 *
 * `maskCode` is the same knowledge applied once, up front: it marks which
 * offsets are real code, so the passes that rewrite import specifiers never
 * touch a `from "pkg"` that only appears inside a comment or a string literal.
 *
 * `packageNameOf` answers the other half of the question — a specifier resolved
 * to the package that would actually be installed.
 */

/** Characters that can legally precede a JS string literal. */
const STRING_PREFIX_CHARS = new Set([
  "=", "(", "[", "{", ",", ":", ";", "!", "&", "|", "?", "+", "-", "*", "/",
  "%", "<", ">", "~", "^", "}", 
]);

/** Keywords that can legally precede a JS string literal. */
const STRING_PREFIX_KEYWORDS =
  /\b(?:return|typeof|case|in|of|instanceof|new|delete|void|throw|yield|await|else|do)$/;

/**
 * Heuristic: does the quote at `i` open a string literal, or is it an
 * apostrophe in JSX text like `Don't`? Getting this wrong in the permissive
 * direction is what makes a naive scanner swallow the rest of the file.
 */
function looksLikeStringStart(content, i) {
  let j = i - 1;
  while (j >= 0 && " \t\r\n".includes(content[j])) j--;
  if (j < 0) return true;

  const prev = content[j];
  if (STRING_PREFIX_CHARS.has(prev)) return true;
  if (/[A-Za-z0-9_$]/.test(prev)) {
    return STRING_PREFIX_KEYWORDS.test(content.slice(Math.max(0, j - 12), j + 1));
  }
  return false;
}

/**
 * Index just past the string literal starting at `start`.
 * Template literals are unambiguous and always skipped; quotes are only
 * skipped when looksLikeStringStart says so.
 */
function skipString(content, start) {
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

/**
 * Mark which offsets of `content` are real code as opposed to the inside of a
 * string or comment. Passes that edit specifiers use this so `from "pkg"`
 * inside a comment or a string is left alone.
 *
 * @returns {Uint8Array} 1 = code, 0 = inside a literal or comment
 */
function maskCode(content) {
  const mask = new Uint8Array(content.length).fill(1);
  let i = 0;

  while (i < content.length) {
    const c = content[i];

    if (c === "`" || ((c === '"' || c === "'") && looksLikeStringStart(content, i))) {
      const end = skipString(content, i);
      mask.fill(0, i, Math.min(end, content.length));
      i = end;
      continue;
    }

    const commentEnd = skipComment(content, i);
    if (commentEnd !== -1) {
      mask.fill(0, i, Math.min(commentEnd, content.length));
      i = commentEnd;
      continue;
    }

    i++;
  }

  return mask;
}

/**
 * Reduce a specifier to the package that would actually be installed.
 *   `lodash/fp`           -> `lodash`
 *   `@scope/pkg/sub`      -> `@scope/pkg`
 *   `@expo/vector-icons`  -> `@expo/vector-icons`
 */
function packageNameOf(spec) {
  const parts = spec.split("/");
  if (spec.startsWith("@")) return parts.slice(0, 2).join("/");
  return parts[0];
}

module.exports = {
  looksLikeStringStart,
  skipString,
  skipComment,
  maskCode,
  packageNameOf,
  STRING_PREFIX_CHARS,
  STRING_PREFIX_KEYWORDS,
};
