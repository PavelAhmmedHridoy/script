# script/connector/pull

The engine behind `script/connector/pull.js` — the inverse direction, template → root, backing `rexpo sync --from-template` (aliases `sync:react` / `sync:expo`).

| File | Job |
| --- | --- |
| `routes.js` | The inverse route table, keyed by template and evaluated in order, mirroring the forward connectors' `getTargetPath` by hand — inverting a path builder generically is guesswork, and a wrong guess overwrites authored source. Route fields: `dir`/`file` (where to look), `match` (name filter), `ignore` (generated, never pulled — `app/_layout.tsx`), `to` (root path), `prefer` (root path that wins when it exists — the `app/foo.tsx` ambiguity between `src/@app/` and `src/@pages/`), `stylesheet` (re-add Tailwind directives), `bundle` (write back into the root bundle entry). |
| `run.js` | The writers and the per-template walk. `restoreDirectives()` re-adds `@tailwind base/components/utilities` after any leading `@import` lines (the web pass strips them). `pullBundle()` parses the template's manifest and rewrites only that target's key in the root bundle — the sibling target's entry and every other key survive; a root file with no `<template>` key is skipped rather than overwritten. `pullTemplate()` walks, routes, and only ever writes files that already have a root counterpart (the skipped list is reported, never invented in `src/`). |

## The three things to know before running it

1. **What returns is the template's dialect**, not the authoring one — RN components, `onPress`, and no `useWeb`/`useApp` macros (build-time resolution cannot be un-done; no table can tell a `Text` you wrote from one the converter emitted).
2. **Only files with an existing root counterpart are written.** Template scaffolding (the Expo template's own components/hooks, a generated `main.tsx` or `app/_layout.tsx`) is skipped, and a root file you deleted cannot be pulled back — recreate it empty and pull again.
3. **Two route kinds are deliberately not byte-for-byte:** the global stylesheet (directives re-added) and the bundle configs (written into the root bundle's entry for that target).

Every write is content-gated through `io.js`, so a repeat pull is a true no-op.
