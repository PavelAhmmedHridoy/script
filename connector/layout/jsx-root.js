/**
 * connector/layout/jsx-root.js — the single-root guard for the app shell.
 *
 * A layout whose return has several sibling JSX elements ("header / content /
 * footer" written without a wrapper) is valid to *read* but is not valid JSX:
 * Babel fails the whole native bundle with "Adjacent JSX elements must be
 * wrapped in an enclosing tag", and the failure surfaces as a stalled Metro
 * progress bar instead of a message.
 *
 * So each `return ( ... )` with more than one root element gets wrapped —
 * <View> on native, <div> on web. The guard runs after the converter's built-in
 * pass, so on web the file is already DOM-tagged and `<div>` is the right
 * wrapper.
 */

const { maskCode, skipString } = require("../../converter/imports");
const { readTag } = require("../../converter/jsx/read");

/**
 * Count the JSX root elements inside the parenthesized region of one
 * `return ( ... )`. Brace- and quote-aware: `{expr}` containers are skipped
 * (their JSX is not a root), strings and comments via the code mask, and a
 * `<>` fragment counts as the single root it is.
 *
 * @param {string} region - content between the parentheses
 * @returns {number}
 */
function countRootElements(region) {
  const mask = maskCode(region);
  let braceDepth = 0;
  let jsxDepth = 0;
  let roots = 0;
  let i = 0;

  while (i < region.length) {
    if (!mask[i]) {
      i++;
      continue;
    }

    const c = region[i];

    if (c === "{") {
      braceDepth++;
      i++;
      continue;
    }
    if (c === "}") {
      braceDepth = Math.max(0, braceDepth - 1);
      i++;
      continue;
    }

    if (c === "<" && braceDepth === 0) {
      // Closing tag: pairs with the nearest open element.
      if (region[i + 1] === "/") {
        if (region[i + 2] === ">") {
          jsxDepth = Math.max(0, jsxDepth - 1); // </>
          i += 3;
          continue;
        }
        const closing = readTag(region, i);
        if (closing) {
          jsxDepth = Math.max(0, jsxDepth - 1);
          i = closing.end;
          continue;
        }
      }

      // Fragment opening: <>.
      if (region[i + 1] === ">") {
        if (jsxDepth === 0) roots++;
        jsxDepth++;
        i += 2;
        continue;
      }

      const tag = readTag(region, i);
      if (tag && /^[A-Za-z]/.test(tag.name)) {
        if (jsxDepth === 0) roots++;
        if (!tag.closing && !tag.selfClosing) jsxDepth++;
        i = tag.end;
        continue;
      }
    }

    i++;
  }

  return roots;
}

/**
 * Wrap every `return ( ... )` whose JSX has several root elements, so the
 * generated layout always parses ("Adjacent JSX elements" is a bundle-time
 * crash on native and a blank page on web).
 *
 * @param {string} content
 * @param {string} wrapper - element name to wrap with ("View" | "div")
 * @returns {string}
 */
function ensureSingleJsxRoot(content, wrapper) {
  const mask = maskCode(content);
  const re = /\breturn\s*\(/g;
  const edits = [];
  let match;

  while ((match = re.exec(content))) {
    if (!mask[match.index]) continue; // inside a string or comment

    const openParen = content.indexOf("(", match.index);

    // Find the matching close paren, quote-aware.
    let depth = 0;
    let closeParen = -1;
    for (let i = openParen; i < content.length; i++) {
      const c = content[i];
      if (c === '"' || c === "'") {
        // Jump over the string literal wholesale.
        const end = skipString(content, i);
        i = end - 1;
        continue;
      }
      if (c === "(") depth++;
      else if (c === ")") {
        depth--;
        if (depth === 0) {
          closeParen = i;
          break;
        }
      }
    }
    if (closeParen === -1) continue;

    const region = content.slice(openParen + 1, closeParen);
    if (countRootElements(region) <= 1) continue;

    // Indentation of the `return` line, plus one level for the wrapper.
    const lineStart = content.lastIndexOf("\n", match.index) + 1;
    const baseIndent = /^[ \t]*/.exec(content.slice(lineStart))[0];
    const indent = `${baseIndent}  `;

    edits.push({ at: openParen + 1, text: `\n${indent}<${wrapper}>` });
    edits.push({ at: closeParen, text: `\n${indent}</${wrapper}>\n${baseIndent}` });
  }

  if (edits.length === 0) return content;

  let out = content;
  for (const edit of [...edits].sort((a, b) => b.at - a.at)) {
    out = out.slice(0, edit.at) + edit.text + out.slice(edit.at);
  }
  return out;
}

module.exports = { countRootElements, ensureSingleJsxRoot };
