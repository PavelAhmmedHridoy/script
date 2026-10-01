/**
 * converter/expo-to-react/tags.js — the React / DOM tag tables.
 *
 * The web direction's side of the mapping, the mirror of
 * `../react-to-expo/tags.js`: React Native components become DOM elements
 * (`View` -> `div`, `Text` -> `span`), plus the expo/gesture-handler components
 * the templates can re-tag. Data only, no transformation logic; `./jsx.js`
 * consumes this table.
 *
 * The expo-router `Link` is the one entry that is not a DOM element: the web
 * template renders a real `BrowserRouter`, so the tag stays react-router-dom's
 * `Link` (its `to` prop is what the reverse pass rewrites `href` to) instead
 * of degrading to a full page reload in an anchor.
 */
const DOM_OF = {
  // Layout
  View: "div",
  SafeAreaView: "div",
  ScrollView: "div",
  KeyboardAvoidingView: "div",

  // Text
  Text: "span",

  // Interaction
  Pressable: "button",
  TouchableOpacity: "button",
  TouchableHighlight: "button",
  TouchableWithoutFeedback: "button",

  // Forms
  TextInput: "input",

  // Images
  Image: "img",
  ImageBackground: "div",

  // Lists
  FlatList: "div",
  SectionList: "div",

  // Feedback
  ActivityIndicator: "div",

  // Overlay
  Modal: "dialog",

  // Expo Router -> react-router-dom
  Link: "Link",

  // ─────────────────────────────
  // Expo / React Native Web
  // ─────────────────────────────

  VirtualizedList: "div",

  // React Native Web components
  Switch: "input",
  Slider: "input",

  // ─────────────────────────────
  // Expo components
  // ─────────────────────────────

  ExpoImage: "img",
  ExpoImageBackground: "div",

  // Expo Blur
  BlurView: "div",

  // Expo Linear Gradient
  LinearGradient: "div",

  // Expo Status Bar
  StatusBar: "div",

  // Expo WebBrowser
  WebBrowser: "iframe",

  // ─────────────────────────────
  // Gesture Handler
  // ─────────────────────────────

  GestureHandlerRootView: "div",
  GestureDetector: "div",
  PanGestureHandler: "div",
  TapGestureHandler: "div",
  LongPressGestureHandler: "div",
  PinchGestureHandler: "div",
  RotationGestureHandler: "div",
  FlingGestureHandler: "div",
  ForceTouchGestureHandler: "div",
};

/**
 * Expo / React Native component -> React DOM element
 */
module.exports = {
  DOM_OF,
};
