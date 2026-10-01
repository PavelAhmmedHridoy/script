/**
 * converter/macro/attrs.js — the bare-attribute shorthand for class macros.
 *
 * `classWeb(...)` / `classApp(...)` (see macro/build.js) are calls, meant to
 * sit inside a className value. Authors also want a plain-prop shorthand on
 * the element itself, with no template literal to open just to hold one call:
 *
 *   <span classWeb="inline-block" className="rounded-full ...">
 *
 *                          web output              native output
 *   classWeb="hover:x"     appended to the         removed, nothing added
 *                          element's className
 *   classApp="min-h-11"    removed, nothing added  appended to the
 *                                                   element's className
 *
 * Same contract as the call form (kept side appends at the tail of the
 * className, dropped side contributes nothing), scoped to one JSX tag instead
 * of one className value, so it has to find that tag's own className — not
 * the nearest one in the file — and is its own pass for that reason.
 *
 * Only a plain quoted className (`"a b"`, `` `a b` `` with no `${...}` holes)
 * is appended into. Anything else (an expression, a hole-bearing template) is
 * left alone and reported, same as an unparseable call — the attribute stays
 * so the build fails loudly at a leaked prop instead of silently dropping the
 * class.
 */

const { readTag } = require("../jsx/read");
const { MACROS } = require("./table");

const ATTR_MACROS = new Set(["classWeb", "classApp"]);

/** Match a bare `name="value"` / `name='value'` attribute inside a tag's attrs. */
function findBareAttr(attrs, name) {
  const re = new RegExp(`(^|\\s)${name}\\s*=\\s*("([^"]*)"|'([^']*)')`);
  const m = re.exec(attrs);
  if (!m) return null;
  const leadingWs = m[1].length;
  return {
    start: m.index + leadingWs,
    end: m.index + m[0].length,
    value: (m[3] ?? m[4] ?? "").trim(),
  };
}

/**
 * The element's own `className` value, if it is a shape this pass can append
 * to: a plain quoted string, or a template literal with no `${...}` holes.
 * Anything else (an expression, a hole-bearing template) is not guessable, so
 * it returns null and the caller leaves the macro attribute alone.
 */
function findAppendableClassName(attrs) {
  const re = /\bclassName\s*=\s*(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\})/;
  const m = re.exec(attrs);
  if (!m) return { present: false };
  if (m[3] !== undefined && m[3].includes("${")) return { present: true, appendable: false };
  const value = m[1] ?? m[2] ?? m[3];
  const isTemplate = m[3] !== undefined;
  return {
    present: true,
    appendable: true,
    start: m.index,
    end: m.index + m[0].length,
    value,
    isTemplate,
  };
}

/** Splice `token` onto the end of `attrs`'s className, or add one. */
function appendClassToken(attrs, token, onWarn, fileLabel) {
  const cls = findAppendableClassName(attrs);

  if (cls.present && !cls.appendable) {
    onWarn(
      `${fileLabel}: className is not a plain string or hole-free template — ` +
        `left a class attribute unmerged`
    );
    return null;
  }

  if (!cls.present) {
    return `${attrs} className="${token}"`;
  }

  const next = cls.isTemplate
    ? `className={\`${cls.value}${cls.value.endsWith(" ") ? "" : " "}${token}\`}`
    : `className="${cls.value}${cls.value.endsWith(" ") ? "" : " "}${token}"`;

  return attrs.slice(0, cls.start) + next + attrs.slice(cls.end);
}

/**
 * Resolve every bare `classWeb=`/`classApp=` attribute for one platform.
 * Removes the attribute always; appends its class into the element's own
 * className only on the platform that keeps it, and only when that
 * className is a shape this pass can append to.
 *
 * @param {string} content
 * @param {"web"|"native"} platform
 * @param {(message: string) => void} onWarn
 * @param {string} [fileLabel] - for warning messages
 * @returns {string}
 */
function applyAttrMacros(content, platform, onWarn, fileLabel = "file") {
  let out = "";
  let cursor = 0;
  const tagOpenRe = /<[A-Za-z]/g;
  let match;

  while ((match = tagOpenRe.exec(content))) {
    if (match.index < cursor) continue; // inside an already-consumed tag

    const tag = readTag(content, match.index);
    if (!tag || tag.closing) continue;

    if (!/\b(classWeb|classApp)\s*=/.test(tag.attrs)) continue;

    const attrStart = match.index + 1 + tag.name.length;
    let attrs = tag.attrs;

    for (const name of ATTR_MACROS) {
      const found = findBareAttr(attrs, name);
      if (!found) continue;

      // Collapse the blank line the attribute leaves behind when it sat
      // alone on its own line (the common, prettier-formatted case).
      const withoutAttr = (attrs.slice(0, found.start) + attrs.slice(found.end)).replace(
        /\n[ \t]*\n/g,
        "\n"
      );
      const kept = MACROS[name] === platform;

      if (!kept || !found.value) {
        attrs = withoutAttr;
        continue;
      }

      const merged = appendClassToken(withoutAttr, found.value, onWarn, fileLabel);
      attrs = merged === null ? attrs : merged; // null: leave attribute in place, unmerged
    }

    out += content.slice(cursor, attrStart) + attrs;
    cursor = attrStart + tag.attrs.length;
    tagOpenRe.lastIndex = cursor;
  }

  out += content.slice(cursor);
  return out;
}

module.exports = { applyAttrMacros, findBareAttr, findAppendableClassName, appendClassToken };
