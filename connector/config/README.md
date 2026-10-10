# script/connector/config

The engine behind `script/connector/[config].js` — build/tooling config, split by kind. The split exists so doctor can read a bundle entry without being able to write one (`bundle.js` has no write side), and so the CLI, doctor and the deps pass all share one require path.

| File | Job |
| --- | --- |
| `bundle.js` | Reading the root's per-target configs. `package.json` / `tsconfig.json` hold one entry per target under a `react` / `expo` key and are **split, not copied** (copying verbatim is what previously broke both templates: the web tsconfig lost `references`, the expo one lost `extends: expo/tsconfig.base`). A per-target file (`package.expo`, `tsconfig.react`, …) wins over the bundle entry. Also owns `bundleEntryJson()` — the exact bytes a template file is generated with, and the source of truth doctor compares against. |
| `plain.js` | The verbatim per-template copy table (`MAPPINGS`): only files a template can actually use. `index.html` / `vite.config.ts` / `tsconfig.app.json` → react; `app.json` / `babel.config.js` / `metro.config.js` / `tailwind.config.js` (NativeWind preset) / `nativewind-env.d.ts` → expo. Copies go through `io.copyFileIfChanged`, so a no-change sync writes nothing. |
| `sync.js` | The writers. `writeBundleEntry()` writes one target's entry as its own manifest — exported so the dependency pass refreshes a template the moment it changes the root bundle. `sync()` writes bundles first (a template needs a manifest before anything can install into it), then plain copies, per enabled target. |

Every write here is content-gated (`io.writeIfChanged`): rewriting an identical `template/expo/package.json` would bump its mtime and make Metro announce *"Detected a change in metro.config.js"*, drop its transform cache, and restart a bundle already in flight.
