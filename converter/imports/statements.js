/**
 * converter/imports/statements.js — finding import statements and editing them.
 *
 * `findImports` returns the absolute offsets of every top-level import and, for
 * a named one, the offsets of the braces' contents. Everything that adds or
 * removes a specifier works on those offsets through `applyEdits`, which sorts
 * splices back-to-front so earlier offsets stay valid — the reason a pass can
 * collect a batch of edits against the original string and apply them at once.
 *
 * `injectImports` is the front door for the tag pass: it merges the components
 * a rewrite needs into an existing named import of the same package when there
 * is one, and appends a new import otherwise.
 */

/**
 * Index just past the import statement whose body starts at `from`.
 * Brace- and quote-aware, so a multi-line `import {\n  a,\n  b\n} from "x";`
 * is consumed whole rather than ending at the first newline.
 */
function findImportEnd(content, from) {
  let i = from;
  let depth = 0;
  let quote = null;

  while (i < content.length) {
    const c = content[i];

    if (quote) {
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
      if (depth === 0) {
        // Consume the trailing ` from "x";` part of the statement.
        while (i < content.length && content[i] !== "\n" && content[i] !== ";") i++;
        if (content[i] === ";") i++;
        return i;
      }
      continue;
    }
    if (depth === 0 && (c === "\n" || c === ";")) return c === ";" ? i + 1 : i;
    i++;
  }

  return content.length;
}

/**
 * Collect every top-level `import` statement in `content`.
 * @returns {Array<{start:number, end:number, source:string|null,
 *   brace:{start:number, end:number, names:string}|null}>}
 */
function findImports(content) {
  const imports = [];
  const re = /^[ \t]*import\b/gm;
  let match;

  while ((match = re.exec(content))) {
    const start = match.index;
    const end = findImportEnd(content, match.index + match[0].length);
    const text = content.slice(start, end);

    // `import { A, B } from "x"` or the side-effect form `import "x"`.
    const sourceMatch =
      /from\s*(["'])([^"']+)\1/.exec(text) || /^\s*import\s*(["'])([^"']+)\1/.exec(text);
    const braceMatch = /\{([\s\S]*?)\}/.exec(text);

    imports.push({
      start,
      end,
      source: sourceMatch ? sourceMatch[2] : null,
      // Absolute offsets of the brace contents, so a merge is an in-place splice.
      brace: braceMatch
        ? {
            start: start + braceMatch.index + 1,
            end: start + braceMatch.index + 1 + braceMatch[1].length,
            names: braceMatch[1],
          }
        : null,
    });
  }

  return imports;
}

/** Split `A, B as C` into `["A", "B as C"]`. */
function splitNames(names) {
  return names
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
}

/** The local binding of `B as C` is `C`. */
function localName(specifier) {
  const parts = specifier.split(/\s+as\s+/);
  return parts[parts.length - 1].trim();
}

/**
 * Apply `{start, end, text}` splices. Sorted back-to-front so offsets computed
 * against the original string stay valid.
 */
function applyEdits(content, edits) {
  let out = content;
  for (const edit of [...edits].sort((a, b) => b.start - a.start)) {
    out = out.slice(0, edit.start) + edit.text + out.slice(edit.end);
  }
  return out;
}

/**
 * Add `neededBySource` components to `content`, merging into an existing named
 * import of the same package when there is one and appending a new import
 * otherwise.
 *
 * @param {string} content
 * @param {Map<string, Set<string>>} neededBySource
 * @returns {string}
 */
function injectImports(content, neededBySource) {
  if (neededBySource.size === 0) return content;

  const imports = findImports(content);
  const edits = [];
  const pending = new Map();

  for (const [source, components] of neededBySource) {
    const own = imports.filter((imp) => imp.source === source);
    const already = new Set();

    for (const imp of own) {
      if (imp.brace) splitNames(imp.brace.names).forEach((n) => already.add(localName(n)));
    }

    const missing = [...components].filter((c) => !already.has(c)).sort();
    if (missing.length === 0) continue;

    const mergeTarget = own.find((imp) => imp.brace);
    if (mergeTarget) {
      const merged = [
        ...new Set([...splitNames(mergeTarget.brace.names), ...missing]),
      ].sort();
      edits.push({
        start: mergeTarget.brace.start,
        end: mergeTarget.brace.end,
        text: ` ${merged.join(", ")} `,
      });
    } else {
      pending.set(source, missing);
    }
  }

  let out = applyEdits(content, edits);

  if (pending.size > 0) {
    const lines = [...pending.entries()]
      .map(([source, names]) => `import { ${names.join(", ")} } from "${source}";`)
      .join("\n");

    const all = findImports(out);
    if (all.length > 0) {
      // Splice after the final import. The trailing newline is unconditional:
      // the previous import ends at its `;`, so without it the new statement
      // would be glued onto the same line.
      let at = all[all.length - 1].end;
      if (out[at] === "\r") at++;
      if (out[at] === "\n") at++;
      out = `${out.slice(0, at)}\n${lines}\n${out.slice(at)}`;
    } else {
      out = `${lines}\n\n${out}`;
    }
  }

  return out;
}

module.exports = {
  findImportEnd,
  findImports,
  splitNames,
  localName,
  applyEdits,
  injectImports,
};
