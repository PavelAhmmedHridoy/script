# script/connector/entry

The engine behind `script/connector/[entry].js` — the two files that are **generated, not authored**. Nothing in an app should have to import `main.tsx`, and the expo layout is expo-router's own convention, so this connector has no `getTargetPath`: it runs on every full sync (before the servers start) and writes only when content differs.

| File | Job |
| --- | --- |
| `sources.js` | What the author's tree contains. `detectSources()` finds `src/@app` / `src/@layout` (first of `.tsx/.jsx/.ts/.js`) — this decides whether the mount is wrapped and which extension to import. `detectWebPages()` turns `src/@pages/*` into web routes: `index` → `/`, `about` → `/about`, `[id]` → `/:id`. |
| `templates.js` | The generated files. `reactEntry()` builds `template/react/src/main.tsx`: without pages, the plain single-screen mount; with pages, a `BrowserRouter` + `Routes` generated from the pages folder (the same routing expo-router derives from the same folders), with the author's `src/@app` as the index route and each page wrapped in the author's Layout when one exists. The router is only imported when pages exist — unused imports fail `noUnusedLocals`. `expoLayout()` builds `template/expo/app/_layout.tsx`: `import "../global.css"` + expo-router `<Slot />`, wrapped in the author's `components/root-layout` when one exists. |

Why the expo layout wraps rather than copies: expo-router renders `<Stack />`/`<Slot />` in `app/_layout.tsx` and passes no children, so a layout that only renders `{children}` shows a blank screen. The author's shell is synced separately to `components/root-layout.tsx` by `[layout].js` and wrapped around `<Slot />` here, keeping both the shell and the router.
