# script/converter/expo-to-react

The **expo → react** direction: source authored in native primitives (`View`,
`Text`, `onPress`, native packages) generated onto the web target. Selected by
`direction.js` when `source.expo` and the template is `react`.

| File | Job |
| --- | --- |
| `transform.js` | The pipeline, mirroring the forward order: modules → authoring imports → tags/handlers → import pruning. |
| `modules.js` | The **reverse** module table: native specifiers → web equivalents (`react-native` → `react-native` via react-native-web, `expo-router` → `react-router-dom`, and every `packageMappings` pair inverted). The rewriting engine is shared (`../modules.js`). |
| `tags.js` | The web tag table: `DOM_OF` — React Native components → DOM elements (`View` → `div`, `Text` → `span`, `Pressable` → `button`, `Image` → `img`, expo and gesture-handler components included). `Link` stays a component: react-router-dom's `Link` (its `to` prop is what `attrs.js` rewrites `href` to), because the web template renders a real `BrowserRouter` and an anchor would drop client-side navigation. |
| `attrs.js` | The web prop rewrites, dispatched on the component the tag was: `source`/`source={{ uri }}` → `src`, `accessibilityLabel` → `alt` for `Image`/`ExpoImage`, `href` → `to` for the router `Link`, `onChangeText` → `onChange` and `keyboardType` removed for `TextInput` — the exact inverse of each forward rule. |
| `jsx.js` | The reverse JSX walk: RN components → DOM tags in one brace-, quote- and comment-aware pass, with the same closing-tag stack as the forward walk. `onPress` → `onClick` afterwards. Components without a DOM mapping are left as-is and reported; JSX text passes through untouched — dropping it here is what silently deleted the layout's content on the first web run. |
| `prune-imports.js` | Drops named imports whose bindings the tag pass just removed (`View`/`Text` the web output no longer references), so the generated file stays lint-clean. Side-effect, namespace and default imports are always kept. |

The forward direction — React DOM elements onto the native target — lives in
[`../react-to-expo/`](../react-to-expo/README.md). Everything direction-neutral
(the macro resolution, the import scanner, the alias rewriter, the direction
resolver, the run/CLI entry) stays in `../`.
