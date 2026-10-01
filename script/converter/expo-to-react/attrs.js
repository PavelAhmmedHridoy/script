/**
 * converter/expo-to-react/attrs.js — the web prop rewrites.
 *
 * The inverse of the native prop rules, used when the source is authored in
 * native primitives and deployed to the web target: `source`/`alt` come back
 * as `src`/`alt`, react-router's `Link` takes `to` where expo-router took
 * `href`, and the controlled inputs want `onChange(event)` rather than
 * `onChangeText(value)`.
 *
 * The forward rules (`convertImageAttrs` and friends) live in
 * `../react-to-expo/attrs.js`.
 */

/**
 * `<Image source={{ uri: "a.png" }} accessibilityLabel="x" />` ->
 * `<img src="a.png" alt="x" />`, the inverse of convertImageAttrs.
 */
function convertWebImageAttrs(attrs) {
  let next = attrs;

  // The static form the forward pass produces goes back to a plain string:
  // a DOM `<img>` has no `{ uri }` source object to unwrap.
  next = next.replace(
    /\bsource\s*=\s*\{\s*\{\s*uri\s*:\s*(["'])(.*?)\1\s*\}\s*\}/g,
    'src="$2"'
  );
  // `source={{ uri: expr }}` -> `src={expr}`.
  next = next.replace(/\bsource\s*=\s*\{\s*\{\s*uri\s*:\s*([^{}]+)\}\s*\}/g, "src={$1}");
  // `source={expr}` -> `src={expr}`: on the DOM the expression is the URL.
  next = next.replace(/\bsource\s*=/g, "src=");
  next = next.replace(/\baccessibilityLabel\s*=/g, "alt=");

  return next;
}

/**
 * `<TextInput onChangeText={fn} keyboardType="email-address" />` ->
 * `<input onChange={fn} />`.
 *
 * Text inputs change `onChangeText(value)` into the DOM `onChange(event)` the
 * web target's controlled-input idiom expects, and drop `keyboardType`, which
 * only means anything to React Native.
 */
function convertWebInputAttrs(attrs) {
  let next = attrs.replace(/\bonChangeText\s*=\s*\{/g, "onChange={");
  next = next.replace(/\s+\bkeyboardType\s*=\s*(\{[^}]*\}|["'][^"']*["'])/g, "");
  return next;
}

/**
 * `<Link href="/x" />` -> `<Link to="/x" />`. The tag stays a component (see
 * `./tags.js`): react-router-dom's `Link` navigates with `to`, where
 * expo-router's used `href`.
 */
function convertWebLinkAttrs(attrs) {
  return attrs.replace(/\bhref\s*=\s*(["'])/g, "to=$1");
}

/** Components whose native `source` is a DOM `src` on the web target. */
const IMAGE_COMPONENTS = new Set(["Image", "ExpoImage"]);

/**
 * Web-side attribute adjustments for native-authored source: the inverse of
 * the per-element functions above, one group per element.
 *
 * Called once per converted element with the React Native component its tag
 * was, so each element group gets exactly its own rules — an `Image` gets
 * `src`/`alt` back, a `TextInput` its DOM `onChange`, a router `Link` its
 * `to` — instead of every prop rule being applied to every element.
 *
 * @param {string} attrs
 * @param {string} [component] - the React Native component the tag was
 * @returns {string}
 */
function convertWebAttrs(attrs, component) {
  if (IMAGE_COMPONENTS.has(component)) return convertWebImageAttrs(attrs);
  if (component === "TextInput") return convertWebInputAttrs(attrs);
  if (component === "Link") return convertWebLinkAttrs(attrs);
  return attrs;
}

module.exports = {
  convertWebAttrs,
  convertWebImageAttrs,
  convertWebInputAttrs,
  convertWebLinkAttrs,
  IMAGE_COMPONENTS,
};
