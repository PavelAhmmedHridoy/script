/**
 * converter/react-to-expo/tags.js — the Expo / React Native tag tables.
 *
 * The native direction's side of the mapping: HTML tags become React Native
 * components (`div` -> `View`), and the props RN needs are derived from the
 * DOM props the authoring source used. Data only, no transformation logic;
 * `./jsx.js` consumes these tables.
 */

/** React Native components are imported from here. */
const RN_PACKAGE = "react-native";

/** Components that come from external packages. */
const COMPONENT_PACKAGE = {
  Link: "expo-router",
};

/**
 * HTML tag -> React Native component.
 *
 * Only lowercase HTML tags are mapped.
 * Custom React components such as <StatsCard /> are untouched.
 */
const TAG_MAP = {
  // Layout
  html: "View",
  body: "View",
  div: "View",
  main: "View",
  section: "View",
  header: "View",
  footer: "View",
  nav: "View",
  aside: "View",
  article: "View",
  ul: "View",
  ol: "View",
  form: "View",
  select: "View",
  fieldset: "View",
  figure: "View",
  address: "View",
  details: "View",
  blockquote: "View",
  hr: "View",
  table: "View",
  thead: "View",
  tbody: "View",
  tfoot: "View",
  tr: "View",
  dl: "View",

  // Text
  span: "Text",
  p: "Text",
  h1: "Text",
  h2: "Text",
  h3: "Text",
  h4: "Text",
  h5: "Text",
  h6: "Text",
  li: "Text",
  label: "Text",
  option: "Text",
  code: "Text",
  pre: "Text",
  strong: "Text",
  em: "Text",
  small: "Text",
  legend: "Text",
  figcaption: "Text",
  caption: "Text",
  th: "Text",
  td: "Text",
  dt: "Text",
  dd: "Text",
  b: "Text",
  i: "Text",
  u: "Text",
  s: "Text",
  mark: "Text",
  abbr: "Text",
  time: "Text",
  summary: "Text",

  // Interactive
  button: "Pressable",
  a: "Link",

  // Media
  img: "Image",

  // Form controls
  input: "TextInput",
  textarea: "TextInput",
};

/**
 * Components that should become Pressable when they have
 * an interaction/press handler.
 */
const PRESSABLE_REPLACEMENTS = new Set(["View", "Text"]);

/**
 * React Native components that cannot directly contain
 * bare string children.
 *
 * IMPORTANT:
 * This set applies ONLY to JSX CHILDREN.
 * It must never be used against JSX attributes.
 */
const NEEDS_TEXT_WRAPPER = new Set(["View", "Pressable"]);

/**
 * <input type="..."> -> React Native props.
 */
const INPUT_TYPE_MAP = {
  password: {
    secureTextEntry: true,
  },

  email: {
    keyboardType: "email-address",
  },

  tel: {
    keyboardType: "phone-pad",
  },

  number: {
    keyboardType: "numeric",
  },

  url: {
    keyboardType: "url",
  },

  search: {
    returnKeyType: "search",
  },
};

module.exports = {
  RN_PACKAGE,
  COMPONENT_PACKAGE,
  TAG_MAP,
  PRESSABLE_REPLACEMENTS,
  NEEDS_TEXT_WRAPPER,
  INPUT_TYPE_MAP,
};
