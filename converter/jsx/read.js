/**
 * converter/jsx/read.js — reading one JSX tag out of a source string.
 *
 * Brace- and quote-aware, because a naive regex is wrong on real code:
 *
 *   <div onClick={() => f(a > b)}>   the `>` inside the arrow does not end the tag
 *   <img src="a.png" />              the tag ends at the self-closing slash
 *
 * `isNodeTag` is the other half of the question — whether a tag the mapping
 * table does not know is a JSX node at all. Capitalised (and `_` / `$`) names
 * are components by React's own rule; a lowercase name only counts as an
 * element when an attribute list or a self-closing slash follows it, so the
 * hooks' `useState<number[]>` is not mistaken for a tag and rewritten.
 */

const TAG_NAME_RE = /^[A-Za-z][A-Za-z0-9]*/;

/**
 * Read the JSX tag starting at `start` (content[start] === "<").
 * Brace- and quote-aware, so `onClick={() => f(a > b)}` does not terminate
 * the tag early on the `>` inside the arrow function.
 *
 * @returns {{name:string, closing:boolean, selfClosing:boolean, attrs:string, end:number}|null}
 */
function readTag(content, start) {
  let i = start + 1;
  let closing = false;

  if (content[i] === "/") {
    closing = true;
    i++;
  }

  const nameMatch = TAG_NAME_RE.exec(content.slice(i, i + 64));
  // No tag name => a fragment (`<>`) or a comparison operator (`a < b`).
  if (!nameMatch) return null;

  const name = nameMatch[0];
  i += name.length;

  const attrStart = i;
  let depth = 0;
  let quote = null;

  while (i < content.length) {
    const c = content[i];

    if (quote) {
      if (c === "\\") {
        i += 2;
        continue;
      }
      if (c === quote) quote = null;
      i++;
      continue;
    }

    if (c === '"' || c === "'") {
      quote = c;
      i++;
      continue;
    }
    if (c === "{") {
      depth++;
      i++;
      continue;
    }
    if (c === "}") {
      depth--;
      i++;
      continue;
    }
    if (c === ">" && depth === 0) {
      const selfClosing = content[i - 1] === "/";
      return {
        name,
        closing,
        selfClosing,
        attrs: content.slice(attrStart, selfClosing ? i - 1 : i),
        end: i + 1,
      };
    }
    i++;
  }

  return null;
}

/**
 * True when a tag with no TAG_MAP entry is a JSX node rather than a TypeScript
 * type argument.
 *
 * Capitalised (and `_` / `$`) names are components by React's own rule, which
 * covers `<StatsCard />` and friends. A lowercase name is an element only when
 * something follows it that could be an attribute list or a self-closing
 * slash: the hooks' `useState<number[]>` and `useState<number>` read as tags to
 * the tag reader, and rewriting those would corrupt plain TypeScript. Closing
 * tags count as nodes when they pair with an element already on the stack.
 *
 * @param {string} content
 * @param {{name:string, closing:boolean}} tag
 * @param {number} start - index of the `<`
 * @param {object[]} stack
 * @returns {boolean}
 */
function isNodeTag(content, tag, start, stack) {
  if (/^[A-Z_$]/.test(tag.name)) return true;

  if (tag.closing) {
    return stack.some((entry) => entry.tag === tag.name);
  }

  const afterName = content[start + 1 + tag.name.length];
  return afterName === "/" || (afterName !== undefined && /\s/.test(afterName));
}

module.exports = { readTag, isNodeTag, TAG_NAME_RE };
