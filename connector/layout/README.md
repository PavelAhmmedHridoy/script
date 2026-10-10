# script/connector/layout

The engine behind `script/connector/[layout].js` — where the author's shell lands per target.

| File | Job |
| --- | --- |
| `sync.js` | The routes and per-target cleanups. `src/@layout.tsx` → `template/react/src/@layout.tsx` (next to App.tsx, imported by the generated `main.tsx`) and → `template/expo/components/root-layout.tsx` (expo-router owns `app/_layout.tsx`, so the shell lives as a component that `[entry].js` wraps around `<Slot />` — writing it there directly would remove the router and render a blank screen). |
| `jsx-root.js` | The single-root guard: every `return ( … )` with several sibling JSX roots gets wrapped — `<View>` on native, `<div>` on web. |

## The two cleanups

Both run for a live watcher edit exactly as for a full sync (they are the connector's `transform` hook, applied after the converter's built-in pass — so on web the file is already DOM-tagged and `<div>` is the right wrapper):

1. **`import "./global.css"` is dropped for native** — the generated `app/_layout.tsx` already imports the NativeWind entry, and the relative path would no longer resolve from `components/`.
2. **Multi-root JSX is wrapped.** "Adjacent JSX elements must be wrapped in an enclosing tag" is a bundle-time crash on native and a blank page on web. `countRootElements()` is brace- and quote-aware: `{expr}` containers are skipped (their JSX is not a root), strings/comments are masked, `<>` counts as the one root it is, and a custom component or unmapped tag is tracked as a node rather than mistaken for text.
