/**
 * converter/expo-to-react/jsx.js — React Native components back to DOM.
 *
 * The reverse pass of the tag transform, for source authored in native
 * primitives (`source.expo` mode) and deployed to the web target: `View`/`Text`
 * become `div`/`span`, `onPress` becomes `onClick`. Without it the file would
 * run in a browser and die on the `react-native` import.
 *
 * The forward direction (HTML → RN components) lives in
 * `../react-to-expo/jsx.js`.
 */

const { DOM_OF } = require("./tags");
const { looksLikeStringStart, skipString } = require("../imports");
const { readTag } = require("../jsx/read");
const { convertWebAttrs } = require("./attrs");

/**
 * Rewrite `onPress` back to `onClick` on DOM elements.
 *
 * The mirror of the converter's web->native `onClick -> onPress` rule, for
 * source authored in native primitives (source.expo mode) and deployed to the
 * web target, where pressables are buttons with onClick.
 *
 * @param {string} content
 * @returns {string}
 */
function rewriteOnPressToOnClick(content) {
  return content.replace(/\bonPress\b/g, "onClick");
}

/**
 * Rewrite every known React Native component tag in `content` to its DOM
 * equivalent (View -> div, Text -> span, ...).
 *
 * The mirror of the forward JSX walk, for source authored in native primitives
 * and deployed to the web target. Only components the table knows are
 * rewritten, and their modules are rewritten by the same pass, so
 * `react-native` and `expo-router` specifiers are gone by the time the tags
 * are read. Components without a web equivalent (e.g. `FlatList`) are left
 * as-is and reported in `unmapped`, so the caller can name what native-only
 * API did not survive the conversion.
 *
 * A stack pairs closing tags with the component their opening tag produced,
 * the same pairing rule the forward walk uses.
 *
 * @param {string} content
 * @returns {{content:string, used:Set<string>, unmapped:Set<string>}}
 */
function rewriteTagsToDom(content) {
  const used = new Set();
  const unmapped = new Set();
  const stack = [];
  let out = "";
  let i = 0;

  while (i < content.length) {
    const c = content[i];

    if (c === "`" || ((c === '"' || c === "'") && looksLikeStringStart(content, i))) {
      const end = skipString(content, i);
      out += content.slice(i, end);
      i = end;
      continue;
    }

    if (c === "<") {
      const tag = readTag(content, i);

      if (tag && Object.prototype.hasOwnProperty.call(DOM_OF, tag.name)) {
        const rn = tag.closing ? (stack.pop() ?? tag.name) : tag.name;
        const dom = DOM_OF[rn] ?? DOM_OF[tag.name];
        used.add(dom);
        out += tag.closing
          ? `</${dom}>`
          : `<${dom}${
              // Props are inverted per element group, so the component the tag
              // was is what decides the rewrites (Image's source, Link's href,
              // TextInput's onChangeText).
              convertWebAttrs(tag.attrs, rn)
            }${tag.selfClosing ? "/>" : ">"}`;
        if (!tag.closing && !tag.selfClosing) stack.push(rn);
        i = tag.end;
        continue;
      }

      // Unknown capitalized tags are user components: track nesting so the
      // stack above stays balanced, and report the ones that are not DOM-
      // convertible so the caller can surface them.
      if (tag && /^[A-Z]/.test(tag.name)) {
        if (tag.closing) {
          stack.pop();
        } else if (!tag.selfClosing) {
          stack.push(tag.name);
          if (DOM_OF[tag.name] === undefined) unmapped.add(tag.name);
        }
      }
    }

    // Everything else — JSX text, {children}, code outside tags — passes
    // through untouched. Dropping it here is what silently deleted the
    // layout's content on the first web run.
    out += c;
    i++;
  }

  return { content: out, used, unmapped };
}

module.exports = { rewriteTagsToDom, rewriteOnPressToOnClick };
