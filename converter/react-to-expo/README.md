# script/converter/react-to-expo

The **react → expo** direction: source authored in React (DOM elements, web
packages) generated onto the native target. Selected by `direction.js` when
`source.react` and the template is `expo`.

| File | Job |
| --- | --- |
| `transform.js` | The pipeline, in the one order that works: modules → authoring imports → tags → handlers → import injection. |
| `modules.js` | The **forward** module table: web specifiers → native equivalents (`framer-motion` → `moti`, with the built-in `react-dom` → `react-native`). The rewriting engine is shared (`../modules.js`). |
| `tags.js` | The native tag tables: `TAG_MAP` (HTML → `View`/`Text`/`Pressable`/`Link`/`Image`/`TextInput`), `PRESSABLE_REPLACEMENTS`, `NEEDS_TEXT_WRAPPER`, `INPUT_TYPE_MAP`, `RN_PACKAGE`, `COMPONENT_PACKAGE`. |
| `attrs.js` | The native prop rewrites: `src` → `source={{ uri }}`, `alt` → `accessibilityLabel`, `type` → `keyboardType`/`secureTextEntry`/`returnKeyType`, `target="_blank"` dropped, `textarea` gains `multiline`. |
| `jsx.js` | The forward JSX walk: HTML tags → RN components in one brace-, quote- and comment-aware pass. A stack pairs closing tags with the component their opening tag became; text children of `View`/`Pressable` get wrapped in `<Text>` (React Native throws otherwise); unknown nodes are tracked so props are not shredded into text runs; lowercase unmapped tags are reported. |

The inverse direction — native primitives back to DOM for the web target —
lives in [`../expo-to-react/`](../expo-to-react/README.md). Everything
direction-neutral (the macro resolution, the import scanner, the alias
rewriter, the direction resolver, the run/CLI entry) stays in `../`.
