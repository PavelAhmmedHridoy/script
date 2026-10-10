/**
 * converter/react-to-expo/attrs.js — the native prop rewrites.
 *
 * The DOM prop spellings that have a React Native equivalent, one function per
 * element group. Each returns the attribute text; the caller splices it back in
 * place of the tag's own attributes, so the functions stay string-in,
 * string-out and easy to test on their own:
 *
 *   <img src="a.png">            src becomes `source={{ uri }}`, alt an a11y label
 *   <input type="email">         type becomes keyboardType
 *   <a href="/x" target="_blank"> target="_blank" has no native meaning
 *
 * The reverse rules (`convertWebAttrs`) live in `../expo-to-react/attrs.js`.
 */

const { INPUT_TYPE_MAP } = require("./tags");

/** `<img src="a.png">` -> `<Image source={{ uri: "a.png" }}>`. */
function convertImageAttrs(attrs) {
  let next = attrs;

  // Static string source -> `{ uri }`, which is what RN's Image expects.
  next = next.replace(/\bsrc\s*=\s*(["'])([^"']*)\1/g, 'source={{ uri: "$2" }}');
  // `src={expr}` is assumed to already be an RN source object.
  next = next.replace(/\bsrc\s*=/g, "source=");
  next = next.replace(/\balt\s*=/g, "accessibilityLabel=");

  return next;
}

/** `<input type="email">` -> `<TextInput keyboardType="email-address" />`. */
function convertInputAttrs(attrs) {
  const typeMatch = /\btype\s*=\s*(["'])([^"']*)\1/.exec(attrs);
  const next = attrs.replace(/\s*\btype\s*=\s*(["'])[^"']*\1/, "");

  if (!typeMatch) return next;

  const mapped = INPUT_TYPE_MAP[typeMatch[2].toLowerCase()];
  if (!mapped) return next;

  const props = Object.entries(mapped)
    .map(([key, value]) => (value === true ? key : `${key}="${value}"`))
    .join(" ");

  // `attrs` keeps the space before a self-closing `/>`; drop it before appending.
  return `${next.replace(/\s+$/, "")} ${props}`;
}

/** `<a href="/x">` -> `<Link href="/x">` (expo-router keeps `href`). */
function convertLinkAttrs(attrs) {
  return attrs.replace(/\s+target\s*=\s*(["'])_blank\1/g, "");
}

module.exports = {
  convertImageAttrs,
  convertInputAttrs,
  convertLinkAttrs,
};
