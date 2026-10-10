/**
 * converter/macro/build.js — turning macro calls into per-target source.
 *
 * The last stage: every call the scanner found is turned into text splices,
 * and all splices are applied back-to-front so the offsets stay valid.
 *
 *                          web output            native output
 *   useWeb(() => { ... })  kept                  deleted
 *   useApp(() => { ... })  deleted               kept
 *   classWeb("hover:x")    appended at the       ""
 *                          end of className
 *   classApp("min-h-11")   ""                    appended at the
 *                                                end of className
 *
 * Keeping a block replaces the call with the callback's own body, so no macro
 * identifier survives:
 *
 *   useWeb(() => window.scrollTo(0, 0))    ->  (window.scrollTo(0, 0))
 *   useWeb(() => { document.title = "x" }) ->  (() => { document.title = "x" })()
 *
 * Deleting a block drops the whole statement when the call stands alone on its
 * line as a statement, and substitutes `null` when it is used as an expression,
 * which is what the JSX child form needs:
 *
 *   {useApp(() => <Haptic />)}              ->  {null}
 *   const flag = useWeb(() => true);        ->  const flag = null;
 *
 * That second case is why "is this a statement" cannot be decided by the
 * trailing semicolon alone: a declaration initialiser also ends in one, and
 * removing the line would take the declaration with it.
 *
 * ## Class macros append at the end of the className
 *
 * A kept class macro (classWeb on the web target / template/react, classApp on
 * the native target / template/expo) does not substitute where the call sits.
 * Two splices do the work: the call's whole `${ ... }` hole is removed, and
 * the class text is inserted immediately BEFORE the className template
 * literal's closing backtick — the tail of the class list:
 *
 *   className={`panel ${classWeb("hover:x")}`}
 *   ->  className={`panel hover:x`}
 *
 * Because the removals and the insert are independent splices against the
 * original offsets, several macros in one className settle in one pass:
 *
 *   className={`p ${classWeb("a")} ${classApp("b")}`}   (web)
 *   ->  className={`p a b`}
 *
 * The dropped platform gets `""` in place and no insert ever fires there, so
 * classWeb contributes only to template/react and classApp only to
 * template/expo — the other target's className is left exactly as authored
 * (holes closed) with nothing appended.
 *
 * Only a literal string argument can be appended. A call whose argument is an
 * expression (a variable, a ternary), that sits in a className quoted string
 * (impossible — the scanner does not descend into strings — but defended
 * anyway), in a non-className template literal, or in a JSX `{...}` container
 * other than the plain `className={classWeb("x")}` form, substitutes in place
 * (kept: `(value)`) — valid wherever a string is, never silently dropped.
 *
 * Finally the authoring import is lifted back out — see liftAuthoringImport.
 */

const { findImports, splitNames, localName, applyEdits } = require("../imports");
const {
  MACROS,
  VALUE_MACROS,
  PLATFORMS,
  AUTHORING_MODULE_RE,
  AUTHORING_ALIAS_PREFIX,
} = require("./table");
const { readCallback } = require("./callback");
const { scanMacroCalls, scanBraceBlocks, skipStringLiteral, findHoleEnd } = require("./scan");
const { applyAttrMacros } = require("./attrs");
const { applyImportScopes } = require("./import-scope");

/** Guards against a pathological edit that never converges. */
const MAX_PASSES = 20;

/**
 * The nearest `className` attribute opening before `at`.
 *
 * The converter has no parser, so this is local backward detection: find the
 * last `className` word, then require the text after its `=` to open a value
 * this call could sit in — `"`, `'`, a backtick, or `{`. That rejects prose
 * mentions (`// className with hover:x`) and property reads
 * (`styles.className`), which cannot be the attribute the call belongs to.
 *
 * @param {string} content
 * @param {number} at - offset the search looks back from
 * @returns {{attrStart:number, valueOpen:number}|null} attrStart is the index
 *   of the `c` in `className`; valueOpen is the index of the value's opener
 *   (quote, backtick, or `{`).
 */
function findEnclosingClassName(content, at) {
  const word = content.lastIndexOf("className", at - 1);
  if (word === -1) return null;

  const before = content[word - 1];
  if (before && /[A-Za-z0-9_$]/.test(before)) return null; // `myclassName`

  let i = word + "className".length;
  while (/\s/.test(content[i] ?? "")) i++;
  if (content[i] !== "=") return null;
  i++; // past `=`
  if (content[i] === "=") return null; // `==` / `===` comparison
  while (/\s/.test(content[i] ?? "")) i++;

  const opener = content[i];
  if (opener === '"' || opener === "'" || opener === "{" || opener === "`") {
    return { attrStart: word, valueOpen: i };
  }
  return null;
}

/**
 * Index just past the closing quote/backtick/`}` of the className value that
 * opens at `openAt`. Quote-aware and template-aware: `${ ... }` holes and
 * escaped characters inside a literal are skipped, and a `{` container is
 * balanced by findHoleEnd.
 *
 * @param {string} content
 * @param {number} openAt - index of `"`, `'`, a backtick, or `{`
 * @returns {number} index just past the closer (value end + 1)
 */
function classNameValueEnd(content, openAt) {
  const opener = content[openAt];

  if (opener === '"' || opener === "'") {
    return skipStringLiteral(content, openAt);
  }

  if (opener === "`") {
    let i = openAt + 1;
    while (i < content.length) {
      const c = content[i];
      if (c === "\\") {
        i += 2;
        continue;
      }
      if (c === "`") return i + 1;
      if (c === "$" && content[i + 1] === "{") {
        const holeEnd = findHoleEnd(content, i + 1);
        if (holeEnd === -1) return content.length;
        i = holeEnd + 1;
        continue;
      }
      i++;
    }
    return content.length;
  }

  // `{`: balanced braces with strings and holes skipped.
  const end = findHoleEnd(content, openAt);
  return end === -1 ? content.length : end + 1;
}

/**
 * The class token a class macro compiles to: its argument with one layer of
 * wrapping quotes stripped. Only a literal string can be appended verbatim;
 * an expression argument (a variable, a join) is not guessable, so it returns
 * null and the call falls back to in-place substitution.
 *
 * @param {string} argText
 * @returns {string|null}
 */
function classTokenOf(argText) {
  const value = argText.trim();
  const match = /^(["'`])([\s\S]*)\1$/.exec(value);
  if (!match) return null;
  const token = match[2].trim();
  return token || null;
}

/**
 * Confirm that a template-literal hole belongs to a className attribute value,
 * and return that attribute. The bounds check is the real guard: a hole only
 * counts when it sits textually inside the nearest preceding className value,
 * so a plain `const s = \`x ${classWeb("y")}\`` after some earlier
 * `className="static"` is correctly rejected (the hole is not within that
 * value) and falls back to in-place substitution.
 *
 * @param {string} content
 * @param {number} holeStart - index of the hole's `${`
 * @param {number} templateEnd - index of the literal's closing backtick
 * @returns {object|null} the className attr {attrStart, valueOpen}, or null
 */
function classNameHoleConfirmed(content, holeStart, templateEnd) {
  const attr = findEnclosingClassName(content, holeStart);
  if (!attr) return null;
  const valueEnd = classNameValueEnd(content, attr.valueOpen);
  if (!(holeStart > attr.valueOpen && templateEnd < valueEnd)) return null;
  return attr;
}

/**
 * Edits for a class macro inside a className template literal. Two
 * independent splices against the original offsets, so several macros in one
 * className settle in the same pass without overlapping:
 *
 *   - remove the call's whole `${ ... }` hole, swallowing the single space
 *     that separated it from the literal text before it;
 *   - insert the class immediately before the literal's closing backtick —
 *     the tail of the class list — unless the literal already ends in a
 *     space there.
 *
 *   className={`panel ${classWeb("hover:x")}`}  ->  className={`panel hover:x`}
 *   className={`p ${classWeb("a")} ${classApp("b")}`}  (web)
 *   ->  className={`p a b`}
 *
 * Null when the shape is not a pure macro hole or the className context
 * cannot be confirmed — the caller then substitutes in place instead of
 * guessing.
 *
 * @param {string} content
 * @param {{start:number, end:number, argText:string, enclosing:object}} call
 * @returns {object[]|null} [removeHole, insertClass], or null
 */
function buildTemplateAppendEdits(content, call) {
  const classToken = classTokenOf(call.argText);
  if (!classToken) return null;

  const { holeStart, innerEnd, templateEnd } = call.enclosing;
  if (templateEnd === -1) return null; // unterminated literal: fall back
  if (
    content[holeStart] !== "$" ||
    content[holeStart + 1] !== "{" ||
    content[innerEnd] !== "}"
  ) {
    return null;
  }

  // The hole must hold exactly the call: nothing but whitespace between the
  // `${` and the call. A hole with a larger expression around it
  // (`cond ? classWeb("a") : ""`) is not a tail class.
  if (content.slice(holeStart + 2, call.start).trim() !== "") return null;

  if (!classNameHoleConfirmed(content, holeStart, templateEnd)) return null;

  // Swallow the one separator space before the hole, so `panel ${X}` compiles
  // to `panel x`, not `panel  x`.
  const holeFrom = content[holeStart - 1] === " " ? holeStart - 1 : holeStart;

  const sep = content[templateEnd - 1] === " " ? "" : " ";
  return [
    { start: holeFrom, end: innerEnd + 1, text: "" },
    { start: templateEnd, end: templateEnd, text: sep + classToken },
  ];
}

/**
 * Edits for a kept class macro whose className is a JSX expression container.
 * Only the plain form `className={classWeb("x")}` — the whole value is the
 * call — is rewritten, to `className={"hover:x"}`; anything nested
 * (`cond ? classWeb("a") : "b"`) falls back to in-place substitution.
 *
 * @param {string} content
 * @param {{start:number, end:number, argText:string}} call
 * @param {{attrStart:number, valueOpen:number}} attr
 * @returns {object[]|null} [replaceValue], or null to fall back
 */
function buildBraceAppendEdits(content, call, attr) {
  const classToken = classTokenOf(call.argText);
  if (!classToken) return null;

  const valueEnd = classNameValueEnd(content, attr.valueOpen);
  const inner = content.slice(attr.valueOpen + 1, valueEnd - 1).trim();
  if (inner !== content.slice(call.start, call.end).trim()) return null; // nested: fall back

  return [{ start: attr.valueOpen, end: valueEnd, text: `{"${classToken}"}` }];
}

/**
 * Widen a statement's removal span to swallow its indentation and the line
 * break it sat on, so deleting a block does not leave a blank line behind.
 * Only widens when the statement is alone on its line.
 */
function expandStatementRemoval(content, start, end) {
  let from = start;
  let to = end;

  let back = from - 1;
  while (back >= 0 && (content[back] === " " || content[back] === "\t")) back--;
  if (back < 0 || content[back] === "\n") from = back + 1;

  let ahead = to;
  while (content[ahead] === " " || content[ahead] === "\t") ahead++;
  if (content[ahead] === "\n") to = ahead + 1;

  return { start: from, end: to };
}

/** Build the edits for one macro call on one platform, or null if unparseable. */
function buildEdit(content, call, platform) {
  if (VALUE_MACROS.has(call.name)) {
    const kept = MACROS[call.name] === platform;

    // Dropped side first, everywhere: classWeb on native, classApp on web.
    // An empty string composes in every position, and no append edit ever
    // fires on this platform — the class contributes nothing at all.
    // Inside a className template literal the whole `${ ... }` hole is
    // removed (plus its separator space); in any other template the hole
    // stays a plain removal so non-class string content is untouched.
    if (!kept) {
      if (call.enclosing) {
        const { holeStart, innerEnd, templateEnd } = call.enclosing;
        if (
          templateEnd !== -1 &&
          content[holeStart] === "$" &&
          content[holeStart + 1] === "{" &&
          content[innerEnd] === "}" &&
          content.slice(holeStart + 2, call.start).trim() === ""
        ) {
          const confirmed = classNameHoleConfirmed(content, holeStart, templateEnd);
          if (confirmed) {
            const from = content[holeStart - 1] === " " ? holeStart - 1 : holeStart;
            return { start: from, end: innerEnd + 1, text: "" };
          }
        }
      }
      return { start: call.start, end: call.end, text: `""` };
    }

    // Kept side: classWeb on web, classApp on native. The class appends at
    // the end of the enclosing className when one can be located; every
    // other position substitutes in place, which stays valid wherever a
    // string is.
    if (call.enclosing) {
      const edits = buildTemplateAppendEdits(content, call);
      if (edits) return edits;
    } else {
      const attr = findEnclosingClassName(content, call.start);
      if (attr && content[attr.valueOpen] === "{") {
        const edits = buildBraceAppendEdits(content, call, attr);
        if (edits) return edits;
      }
    }

    const value = call.argText.trim();
    if (!value) return null;
    return { start: call.start, end: call.end, text: `(${value})` };
  }

  const callback = readCallback(call.argText);
  if (!callback) return null;

  if (MACROS[call.name] === platform) {
    // Keep this block: run its body here, with the macro reference gone.
    const text = callback.isBlock
      ? `(${callback.source})()`
      : `(${callback.body})`;
    return { start: call.start, end: call.end, text };
  }

  // Delete this block. It was a statement only when the call stood alone on its
  // line and ran to a trailing `;` — `const x = useWeb(...)` also ends in a
  // semicolon, and removing that line would take the declaration with it and
  // leave invalid JS behind. Every other position is an expression, where
  // `null` fills in.
  let after = call.end;
  while (content[after] === " " || content[after] === "\t") after++;

  const lineStart = content.lastIndexOf("\n", call.start) + 1;
  const ownLine = /^[ \t]*$/.test(content.slice(lineStart, call.start));

  if (content[after] !== ";" || !ownLine) {
    return { start: call.start, end: call.end, text: "null" };
  }

  return { ...expandStatementRemoval(content, call.start, after + 1), text: "" };
}

/** One rewriting pass. */
function runPass(content, platform, onWarn) {
  const edits = [];

  scanMacroCalls(content, (call) => {
    const edit = buildEdit(content, call, platform);

    if (!edit) {
      const shape = VALUE_MACROS.has(call.name) ? "a value" : "a plain callback";
      onWarn(`${call.name}() at offset ${call.start} is not ${shape} — left unchanged`);
      return;
    }
    // A class macro can produce one splice or a hole removal + insert pair.
    for (const e of Array.isArray(edit) ? edit : [edit]) edits.push(e);
  });

  if (edits.length === 0) return { content, changed: false };
  return { content: applyEdits(content, edits), changed: true };
}

/**
 * Build the edit for one brace-form construct — `useWeb{ A }`, `useApp{ A }`,
 * or the paired `useWeb{ A }:useApp{ B }` in either order — on one platform.
 *
 * Unlike the call form, the kept half's body is spliced in exactly as
 * written, with no wrapping function: that is what lets it hold `import` /
 * `export` declarations, not just expressions or plain statements. A lone
 * block for the platform NOT being generated is dropped in its entirety,
 * widened the same way a deleted call-form statement is so no blank line is
 * left behind.
 *
 * @param {string} content
 * @param {object} block - as visited by scanBraceBlocks
 * @param {"web"|"native"} platform
 * @returns {{start:number, end:number, text:string}}
 */
function buildBraceEdit(content, block, platform) {
  if (MACROS[block.name] === platform) {
    return {
      start: block.start,
      end: block.end,
      text: content.slice(block.bodyStart, block.bodyEnd).trim(),
    };
  }

  if (block.pairName && MACROS[block.pairName] === platform) {
    return {
      start: block.start,
      end: block.end,
      text: content.slice(block.pairBodyStart, block.pairBodyEnd).trim(),
    };
  }

  return { ...expandStatementRemoval(content, block.start, block.end), text: "" };
}

/**
 * One rewriting pass over the brace-form constructs only. Kept separate from
 * `runPass` (the call form) rather than merged into one edit list: each scan
 * jumps past whatever it just matched, so a call-form macro sitting inside a
 * brace body and the brace construct itself can both produce edits in the
 * same pass, with the brace edit's span containing the call edit's — real
 * overlap, not just nesting. Running the two forms as separate sequential
 * passes instead of one combined edit list sidesteps that: each pass reads
 * `content` fresh and never overlaps with itself, and a macro newly exposed
 * by splicing a brace body is picked up by the next pass, same as nested
 * call-form macros already are by the fixed-point loop.
 */
function runBracePass(content, platform) {
  const edits = [];

  scanBraceBlocks(content, (block) => {
    edits.push(buildBraceEdit(content, block, platform));
  });

  if (edits.length === 0) return { content, changed: false };
  return { content: applyEdits(content, edits), changed: true };
}

/**
 * Remove the authoring-only macro import, dropping just the specifiers that are
 * no longer referenced so an untransformed call still fails at a real module
 * rather than at an undefined identifier.
 */
function liftAuthoringImport(content, stillUsed) {
  const edits = [];

  for (const imp of findImports(content)) {
    if (!imp.source) continue;

    const isAuthoring =
      AUTHORING_MODULE_RE.test(imp.source) || imp.source.startsWith(AUTHORING_ALIAS_PREFIX);
    if (!isAuthoring) continue;

    if (!imp.brace) {
      edits.push({ start: imp.start, end: imp.end, text: "" });
      continue;
    }

    const remaining = splitNames(imp.brace.names).filter((specifier) => {
      const name = localName(specifier);
      return !Object.prototype.hasOwnProperty.call(MACROS, name) || stillUsed.has(name);
    });

    if (remaining.length === 0) {
      // Take the whole line so removing the import leaves no blank line.
      edits.push({ ...expandStatementRemoval(content, imp.start, imp.end), text: "" });
    } else {
      edits.push({
        start: imp.brace.start,
        end: imp.brace.end,
        text: ` ${remaining.join(", ")} `,
      });
    }
  }

  return edits.length === 0 ? content : applyEdits(content, edits);
}

/**
 * Resolve every macro in one file for one platform.
 *
 * Runs to a fixed point so nested macros settle regardless of which platform
 * the outer block belongs to, then lifts the authoring import out.
 *
 * @param {string} content - Source file content
 * @param {"web"|"native"} platform - Target being generated
 * @param {(message: string) => void} [onWarn] - Warning sink
 * @returns {string} Content with zero macro references remaining
 */
function applyPlatformBlocks(content, platform, onWarn = defaultWarn) {
  if (!PLATFORMS.has(platform)) return content;

  let out = content;
  const warned = new Set();
  const warn = (message) => {
    if (warned.has(message)) return;
    warned.add(message);
    onWarn(message);
  };

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    // Brace-form constructs first, own pass: their body is spliced in
    // verbatim (see runBracePass for why that has to stay separate from the
    // call-form edits below rather than sharing one edit list).
    const braced = runBracePass(out, platform);
    out = braced.content;

    const called = runPass(out, platform, warn);
    out = called.content;

    if (!braced.changed && !called.changed) break;
  }

  // Two more macro forms, each its own syntax rather than a call, so neither
  // needs the fixed-point loop above:
  // - the bare-attribute shorthand (`classWeb="..."` as a plain JSX prop)
  // - a platform-scoped static import (`import X from "y"; // useWeb`)
  out = applyImportScopes(out, platform);
  out = applyAttrMacros(out, platform, warn);

  const stillUsed = new Set();
  scanMacroCalls(out, (call) => stillUsed.add(call.name));

  return liftAuthoringImport(out, stillUsed);
}

function defaultWarn(message) {
  console.warn(`[converter/platform-blocks] ${message}`);
}

/** True when `content` still references a macro call. */
function hasMacroCalls(content) {
  let found = false;
  scanMacroCalls(content, () => {
    found = true;
  });
  return found;
}

module.exports = {
  applyPlatformBlocks,
  hasMacroCalls,
  buildEdit,
  runPass,
  buildBraceEdit,
  runBracePass,
  liftAuthoringImport,
  expandStatementRemoval,
  findEnclosingClassName,
  classNameValueEnd,
  classNameHoleConfirmed,
  classTokenOf,
  buildTemplateAppendEdits,
  buildBraceAppendEdits,
  MAX_PASSES,
};
