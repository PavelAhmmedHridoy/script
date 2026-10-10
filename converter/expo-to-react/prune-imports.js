/**
 * converter/expo-to-react/prune-imports.js — drop imports the web pass emptied.
 *
 * The web direction removes the react-native `View`/`Text` from the JSX; this
 * drops the named imports whose bindings nothing uses any more, and keeps
 * everything else. Pruning keeps the generated file lint-clean instead of
 * leaving `View is not defined`-adjacent debris behind.
 *
 * Side-effect and namespace/default imports are always kept: they cannot be
 * proven unused locally.
 */

const { findImports, splitNames, localName, applyEdits } = require("../imports");

/**
 * @param {string} content
 * @param {object} [reverseTable] - unused today, kept for call-site symmetry
 *   with the other transform helpers
 * @returns {string}
 */
function pruneUnusedImports(content, reverseTable) {
  const imports = findImports(content);
  const edits = [];

  for (const imp of imports) {
    if (!imp.source || imp.source.startsWith(".")) continue;
    if (!imp.brace) continue;

    const names = splitNames(imp.brace.names);
    const kept = names.filter((name) => {
      // `type ReactNode` / `View as V` -> the binding actually referenced.
      const binding = localName(name).replace(/^type\s+/, "");
      const word = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(binding);
      if (!word) return true;
      return new RegExp(`\\b${word[0]}\\b`).test(content.slice(imp.end));
    });

    if (kept.length === names.length) continue;

    if (kept.length > 0) {
      edits.push({
        start: imp.brace.start,
        end: imp.brace.end,
        text: ` ${kept.join(", ")} `,
      });
    } else {
      // Whole statement unused: remove it and its trailing newline.
      let end = imp.end;
      if (content[end] === "\r") end++;
      if (content[end] === "\n") end++;
      edits.push({ start: imp.start, end, text: "" });
    }
  }

  if (edits.length === 0) return content;

  let out = applyEdits(content, edits);
  out = out.replace(/\n{3,}/g, "\n\n");
  return out;
}

module.exports = { pruneUnusedImports };
