# script/connector

The route connectors: how every file in the authoring root is mapped to its place in each template. A full sync runs them all; the live watcher runs the same routing on a single changed file (`syncSingleFile` / `removeSingleFile`), so live edits land exactly where a full sync would put them.

## How connectors load

`index.js` scans this directory for `[name].js` files. Pattern connectors declare a source `RegExp` plus `getTargetPath(relativePath, template)`; static connectors (`config`, `entry`) sync fixed file lists and have no per-file route. A connector may also export `transform(content, ctx)`, a hook the converter runs after its built-in pass (used e.g. by `[global-css]` to prepend NativeWind directives) — it is forwarded to single-file syncs so the watcher is byte-identical to a full sync.

## The pattern connectors

| Connector | Source | Web target | Native target |
| --- | --- | --- | --- |
| `[app]` | `src/@app.tsx`, `src/@app/*` | `src/App.tsx` (root file) / `src/app/*` | `app/index.tsx` (root file) / `app/*` |
| `[layout]` | `src/@layout.tsx` | `src/@layout.tsx` (kept next to App) | `components/root-layout.tsx` |
| `[pages]` | `src/@pages/*` | `src/pages/*` | `app/*` (expo-router routes) |
| `[components]` | `src/@components/*` | `src/components/*` | `components/*` |
| `[hooks]` / `[lib]` / `[utils]` / `[styles]` | `src/@…` folders | `src/…` (no `@`) | template root `…/` |
| `[global-css]` | `src/global.css` | `src/global.css` | `global.css` (NativeWind input, directives ensured) |
| `[assets]` | `assets/**` | `assets/**` (Vite `publicDir`) | `assets/**` (byte-for-byte copy) |

Every JS/TS route converts through the converter. Which pass a target runs follows from `source` vs. the template (`directionOptions` in `../converter/direction.js`), not from the template alone: `source.react` + the expo target is the React Native transform, `source.expo` + the web target is the reverse pass, and a target whose dialect already matches the source is a straight copy. `[assets]` copies binaries via `io.copyFileIfChanged` — no conversion for a PNG.

## The static connectors

- **`[config]`** — build/tooling config, two kinds: bundled (`package.json` / `tsconfig.json`, split per target from the `react` / `expo` entries or `package.react` / `package.expo` files) and plain (verbatim per-template copies: `index.html`, `vite.config.ts`, `app.json`, `metro.config.js`, …), minus the files rexpo.config.js's `specialFiles.exclude` names for that target. Also syncs the user's `specialFiles.include` per target — root files like `.env` / `.env.local` that no connector routes (and which the watchers used to skip as dot-files), with `{ from, to }` rename support. `bundleEntryJson()` here is the single serializer doctor compares generated files against, and `writeBundleEntry()` lets the deps pass refresh a template manifest the moment it changes the root bundle.
- **`[entry]`** — the two *generated* bootstrap files: `template/react/src/main.tsx` (mounts `<Layout><App /></Layout>`; becomes a real BrowserRouter over `src/@pages` when pages exist) and `template/expo/app/_layout.tsx` (expo-router `<Slot />` wrapped in the author's layout component — writing the author's file there directly would remove the router and blank the screen).

## Subfolders

| Folder | Job |
| --- | --- |
| `config/` | `[config]`'s engine: `bundle.js` (read/serialize), `plain.js` (copy table), `special.js` (user specialFiles — includes, excludes, live change/remove), `sync.js` (writers) |
| `walk.js` | The one recursive directory walk every pattern connector shares: drops dot-directories and junk dot-files (`.DS_Store`, `.gitignore`, …), keeps other files, optional `keep(name)` filter. Replaces the per-connector `getAllFiles()` copies, which copied tooling noise into the templates. |
| `entry/` | `[entry]`'s engine: `sources.js` (what the author's tree contains), `templates.js` (the generated files) |
| `layout/` | `[layout]`'s engine: `sync.js` (routes + per-target cleanups), `jsx-root.js` (multi-root JSX guard) |
| `pull/` | the inverse direction: `routes.js` (template → root table), `run.js` (the writers) |

## Pull (`pull.js`) — template → root, verbatim

The recovery direction (`rexpo sync --from-template`): walks the same routes backwards and copies each template file to the root path its route came from. Deliberately dumb:

1. What returns is the **template's dialect** (RN components, no macros) — build-time resolution cannot be un-done.
2. **Only files with an existing root counterpart are written**; template scaffolding is listed as skipped, never invented in `src/`.
3. Two non-verbatim cases: the global stylesheet gets its stripped Tailwind directives re-added, and bundle configs are written back into the root bundle's own entry (only that target's key touched).

The expo route `app/foo.tsx` is ambiguous (`src/@app/foo.tsx` or `src/@pages/foo.tsx`) — an existing root file wins, else `src/@pages/`. Routes are hand-written (`pull/routes.js`) rather than derived, because inverting a path builder generically is guesswork and a wrong guess overwrites authored source. `app/_layout.tsx` is `ignore: true` — expo-router owns it.
