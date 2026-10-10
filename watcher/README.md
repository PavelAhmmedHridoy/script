# script/watcher

Nodemon-style live sync: watches the root source folders (`src/`, `app/`, `components/`, `pages/`, `assets/`) and mirrors every create / change / delete into every enabled template (`template/react`, `template/expo`) — through the same route-aware connectors a full sync uses, so a live edit lands byte-for-byte where `rexpo sync` would put it.

## Files

| File | Job |
| --- | --- |
| `index.js` | The chokidar watcher: picks the watch paths, ignores the noise, debounces per-file changes, and routes each event. Runnable directly (`node script/watcher/index.js`). |
| `paths.js` | What to watch and what to leave alone — source dirs, watchable extensions, ignored dir names, dynamic-route detection, enabled-template dirs, and the config-aware ignore filter (`createIgnoreFilter`). |
| `mirror.js` | What happens to one changed or deleted file: connector routing first, raw 1:1 copy as the fallback. |
| `check.js` | Preflight checks run before chokidar is armed (see below). |

## Routing a changed file

1. `connector.syncSingleFile()` is tried first. `@`-convention files (`src/@app.tsx`, `src/@pages/[id].tsx`, …) go to their special template locations, including the per-target conversion (direction resolved from `source` vs. target, connector `transform` hooks included).
2. No connector claims the file → raw 1:1 copy at the same relative path into every enabled template.

Deletions are mirrored the same way (`connector.removeSingleFile`, else unlink of the raw copy).

## Why directories instead of globs

chokidar v4 removed glob support, so patterns like `src/**/*.{ts,tsx}` silently match nothing. Watching real directories with an ignore filter also picks up dynamic route files (`[id].tsx`, `[...slug].tsx`), whose brackets glob parsers used to swallow as character classes.

## Ignored

`node_modules`, `.git`, build output, `template/` (our own output — syncing it back would loop), `script/`, hidden directories, and any file without a watchable extension (source, styles, JSON, images, fonts, video). If no source folder exists yet, the whole project root is watched and filtered.

**The dot-file exception.** Hidden means tooling for *directories*, always — but a root-level dot-file can be authored app input: `.env`, `.env.local` and anything else listed in rexpo.config.js's `specialFiles` are watchable (and `getWatchPaths` adds each existing one to the watch list, since the root itself is otherwise never watched). `createIgnoreFilter(config)` derives the allowlist from the config; the config-less `isIgnored` default covers the built-in `.env` pair. Dot-files *below* the root (`src/@components/.env`) stay ignored.

## Preflight (`check.js`)

The watcher refuses to start on a root that would produce silently-wrong output. Three checks, in doctor's order:

1. **`src/` exists** and is readable — nothing is routable without it.
2. **Source mode declared** — the AST passes pick from `source.react` / `source.expo`; with neither, a `<div>` would reach Metro untransformed. A missing config file falls back to the defaults (warning, not error).
3. **Template manifests match the root bundle** — each enabled template's `package.json` / `tsconfig.json` must be byte-identical to what the root bundle would generate (the same comparison `rexpo doctor` makes, derived at runtime so customised `package.expo` / `tsconfig.expo` are honoured). A hand-edited or replaced scaffold would be overwritten from the root on the next change.

Errors print in red, warnings in yellow; output is plain when stdout is not a TTY or `NO_COLOR` is set.

## Public API

`createWatcher` / `startWatchers` are the names `script/runner/index.js` calls; `createLiveWatcher` / `startLiveWatchers` / `watchLive` are aliases. `startWatchers` returns an array of `FSWatcher`s (callers close them on exit) and runs the preflight first — returning `[]` when it fails.
