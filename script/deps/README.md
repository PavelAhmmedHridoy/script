# script/deps

Package self-healing: reconciles the root dependency bundles with the packages the authoring tree actually imports, so adding a library in `src/` is enough to get it into both targets.

## Why it writes the root bundle, not the templates

The config connector regenerates each template's `package.json` from the root `react` / `expo` bundle entries (or `package.react` / `package.expo`) on every sync. Writing a discovered dependency straight into a template would be erased by the next run. The bundle is the source of truth — so that is what gets updated, and the templates pick the change up when the connectors run immediately afterwards. `syncDependencies()` must run **before** the connectors.

## The two paths

- **Reconciliation** (`index.js`) — every sync: scan each target from the content it will *actually* receive (platform macros already resolved, so a package used only inside a `useWeb` block is not demanded by the native build; module mappings already applied, so native reports the mapped name), add what is missing.
- **Explicit install** (`add.js`) — backs `rexpo install <pkg>`: resolves the target(s) (see below), adds the package, refreshes the template manifests immediately, and optionally runs the package manager.

## Safety

- Only `dependencies` are ever added; existing entries are never rewritten or removed, and no other manifest key is touched.
- Internal specifiers are shielded (`scan.js`) and can never become a package: relative/absolute paths, the `@/` `~/` `#` aliases, Node built-ins (incl. `node:`), URLs, and anything under `script/` (the macro shim included) — with the tooling alias read from *your* tsconfig `paths` rather than assumed to be `@script/`.
- A version is only taken from something concrete: the other target's declaration, or an installed copy in either template's `node_modules` (Expo/React Native packages get `~`, everything else `^` — SDK lockstep). Failing both, the entry is *reported* (`rexpo install <pkg>` is suggested) rather than written blind — unless `deps.allowUnknownVersions` is set.
- Idempotent: a second run finds nothing missing.

## Files

| File | Job |
| --- | --- |
| `index.js` | The reconciliation pass and its settings (`deps.autoAdd`, `deps.scanDirs`, `deps.allowUnknownVersions`). Runnable directly. |
| `scan.js` | The scanner: post-macro, post-mapping content per platform, internal-specifier shielding. |
| `versions.js` | Target map (`react` → web, `expo` → native) and version resolution / range prefixes. |
| `bundles.js` | Reading and persisting each target's config (per-target file first, else the root bundle entry — touching only that key). |
| `add.js` | The explicit `rexpo install` path, including **target auto-detection**, in order of trustworthiness: (1) where the package is imported — the same post-macro scan the converter sees; (2) `packageMappings` — a mapped value is native, a mapped key needs both; (3) name heuristics (`expo-*`/`react-native*`/`@expo/*` native; `react-dom`/`vite`/`tailwindcss` web); (4) unknown → both, because a missing dependency is worse than an extra one. |

## One table, two halves

`packageMappings` is honoured in two places, which is what makes the pairs real rather than decorative: the converter **rewrites the import specifier** on the native target (`converter/modules.js`), and this pass **installs the native package**. A mapping with no rewrite would leave a web-only import in the native bundle; a rewrite with no install would leave it unresolved.
