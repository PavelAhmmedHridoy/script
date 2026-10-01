/**
 * converter/react-to-expo/jsx.js — HTML tags to React Native components.
 *
 * The forward pass of the tag transform — the react → expo direction of the
 * JSX walk. Everything below is one walk of the file, and the comments are the
 * list of ways a simpler implementation is wrong on real source.
 *
 * The reverse direction (native primitives → DOM) lives in
 * `../expo-to-react/jsx.js`.
 */

const {
  TAG_MAP,
  PRESSABLE_REPLACEMENTS,
  NEEDS_TEXT_WRAPPER,
} = require("./tags");
const { looksLikeStringStart, skipString } = require("../imports");
const { readTag, isNodeTag } = require("../jsx/read");
const {
  convertImageAttrs,
  convertInputAttrs,
  convertLinkAttrs,
} = require("./attrs");

/**
 * Convert every known HTML tag in `content` to its React Native component.
 *
 * A stack pairs closing tags with the exact component their opening tag was
 * converted to, so a `<div onClick>` that became `<Pressable>` closes as
 * `</Pressable>`. When the JSX is unbalanced (conditional fragments) the stack
 * top is not trusted and the plain TAG_MAP name is used instead — the same
 * result the old tag-name-only regex produced.
 *
 * Text children are wrapped in `<Text>` where the parent cannot hold a bare
 * string, because React Native throws "Text strings must be rendered within a
 * <Text> component" rather than rendering one.
 *
 * Elements with no TAG_MAP entry — custom components (`<StatsCard />`),
 * fragments and unmapped HTML tags — are nodes, not text: they are emitted
 * verbatim and tracked on the same stack. Without that they fell into the text
 * accumulator and a component's props were shredded into separate `<Text>`
 * runs (`<StatsCard label=` + `"Modules"`), which is invalid JSX and broke the
 * native bundle. Unmapped lowercase tags are reported in `unmapped`, since a
 * DOM element surviving into React Native is a runtime `View config` error.
 *
 * @returns {{content:string, used:Set<string>, unmapped:Set<string>}}
 */
function rewriteTags(content) {
  const used = new Set();
  const unmapped = new Set();
  const stack = [];
  let out = "";
  let pending = "";
  let braceDepth = 0;
  let i = 0;

  const parent = () => (stack.length ? stack[stack.length - 1] : null);

  /**
   * Emit accumulated JSX text, wrapping it in <Text> when its parent cannot
   * hold a bare string. Whitespace-only runs are left alone so indentation is
   * not turned into empty Text nodes.
   */
  const flush = () => {
    if (!pending) return;

    const top = parent();
    if (/\S/.test(pending) && top && NEEDS_TEXT_WRAPPER.has(top.rn)) {
      out += `<Text>${pending}</Text>`;
      used.add("Text");
    } else {
      out += pending;
    }

    pending = "";
  };

  while (i < content.length) {
    const c = content[i];

    if (c === "`" || ((c === '"' || c === "'") && looksLikeStringStart(content, i))) {
      flush();
      const end = skipString(content, i);
      out += content.slice(i, end);
      i = end;
      continue;
    }

    if (c === "{") {
      flush();
      braceDepth++;
      out += c;
      i++;
      continue;
    }

    if (c === "}") {
      flush();
      braceDepth = Math.max(0, braceDepth - 1);
      out += c;
      i++;
      continue;
    }

    if (c === "<") {
      // Fragments carry neither a tag name nor an RN component: pass them
      // through and keep the stack balanced so their children still resolve
      // their own parent.
      const opensFragment = content[i + 1] === ">";
      const closesFragment = content.startsWith("</>", i);

      if (opensFragment || closesFragment) {
        flush();

        if (opensFragment) {
          stack.push({ tag: "<>", rn: null, braceDepth });
          out += "<>";
          i += 2;
        } else {
          stack.pop();
          out += "</>";
          i += 3;
        }

        continue;
      }

      const tag = readTag(content, i);

      // A node the TAG_MAP does not know: a custom component, or an HTML tag
      // with no native equivalent. Emit it and its attrs untouched, and track
      // its nesting, so nothing inside it is mistaken for JSX text.
      if (tag && !Object.prototype.hasOwnProperty.call(TAG_MAP, tag.name) && isNodeTag(content, tag, i, stack)) {
        flush();

        if (tag.closing) {
          const top = stack[stack.length - 1];
          // Only unwind an element this pass actually opened; a mismatched
          // close is emitted as authored rather than popping someone else's
          // frame off the stack.
          if (top && top.tag === tag.name) stack.pop();
          out += `</${tag.name}>`;
        } else {
          if (!tag.selfClosing) stack.push({ tag: tag.name, rn: null, braceDepth });
          out += `<${tag.name}${tag.attrs}${tag.selfClosing ? "/>" : ">"}`;
          // Lowercase means a host element: it has no mapping, so it would
          // reach React Native as an unknown host component (`<video>`).
          if (/^[a-z]/.test(tag.name)) unmapped.add(tag.name);
        }

        i = tag.end;
        continue;
      }

      if (tag && Object.prototype.hasOwnProperty.call(TAG_MAP, tag.name)) {
        // Close out any text child of the element we are leaving or entering.
        flush();

        let rn = TAG_MAP[tag.name];

        if (tag.closing) {
          const top = stack.pop();
          rn = top && top.tag === tag.name ? top.rn : rn;
          used.add(rn);
          out += `</${rn}>`;
          i = tag.end;
          continue;
        }

        let attrs = tag.attrs;

        if (/\bonClick\b/.test(attrs) && PRESSABLE_REPLACEMENTS.has(rn)) {
          // A View/Text with onPress never fires; Pressable does.
          rn = "Pressable";
        }
        if (rn === "Image") attrs = convertImageAttrs(attrs);
        if (rn === "Link") attrs = convertLinkAttrs(attrs);
        if (rn === "TextInput") attrs = convertInputAttrs(attrs);
        if (tag.name === "textarea" && !/\bmultiline\b/.test(attrs)) {
          attrs = `${attrs.replace(/\s+$/, "")} multiline`;
        }

        used.add(rn);
        // Remember the brace depth the tag was written at: JSX text lives
        // directly inside an element, i.e. at exactly that depth.
        if (!tag.selfClosing) stack.push({ tag: tag.name, rn, braceDepth });
        out += `<${rn}${attrs}${tag.selfClosing ? "/>" : ">"}`;
        i = tag.end;
        continue;
      }
    }

    // Text is JSX text only when it sits directly inside an element, at the
    // same brace depth that element was opened at. Anything else is JS, and
    // must not be scanned for text nodes — `items.map(i => <li/>)` contains an
    // arrow function, not a text child.
    const top = parent();
    if (top && top.braceDepth === braceDepth) {
      pending += c;
    } else {
      out += c;
    }
    i++;
  }

  flush();

  return { content: out, used, unmapped };
}

module.exports = { rewriteTags };
