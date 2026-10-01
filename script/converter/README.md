# script/converter

Turns one authoring file (`src/@…`) into the two platform outputs. It has **no parser dependency**: every pass is a quote-, brace- and comment-aware character walk, so a naive regex's failure modes (`Don't` in JSX text, `>` inside an arrow function, a package name in a comment) read exactly the way JavaScript means them.

## The pipeline

`transform()` in `transform.js` is the whole pipeline for a single file, in the one order that works:

1. **Platform macros** (`platform-blocks.js`) — `useWeb` / `useApp` / `classWeb` / `classApp` resolved for the target being generated. Runs for **both** targets: a web build must drop native-only blocks too. Also lifts the authoring-only import back out.
2. **Module auto-detection** — per direction, so each folder owns the table it runs (`react-to-expo/modules.js` forward, `expo-to-react/modules.js` reverse) over the shared engine in `modules.js`. Native: a web-only specifier is rewritten to its `packageMappings` equivalent. Web (for native-authored source, `source.expo` mode): the reverse pass rewrites native specifiers (`react-native`, `expo-router`, `moti`, …) back to their web equivalents.
3. **The react → expo direction** (`react-to-expo/`) — native targets: web specifiers are rewritten to their native equivalents, HTML tags become RN components, `onClick` becomes `onPress` (a View/Text with a press handler becomes `Pressable`), text children get wrapped in `<Text>` (React Native *throws* otherwise), and `src`/`type`/`href` become their RN props. The imports the components need are merged into existing import blocks.
4. **The expo → react direction** (`expo-to-react/`) — the mirror of (3) for source authored in native primitives: `View`/`Text` become `div`/`span`, `onPress` → `onClick`, and imports the tags no longer need are pruned (`pruneUnusedImports`), so one authoring file deploys to both templates.

Which of (3) and (4) runs — if either — is the **direction**, and it comes from `rexpo.config.js`: the dialect `source` declares (`react` DOM elements vs. `expo` strict RN primitives) compared with the template being generated. `direction.js` resolves that pair into the options above (`platform`, `applyRNTransform`, `useWebTransform`), and every connector passes the result to `convertFile`, so `source.react` + the expo target converts react→expo, `source.expo` + the web target converts expo→react, and a target whose dialect already matches the source is copied with only its authoring-relative imports (`../@components/Card` → `../components/Card`) rewritten. A `source` with both flags set, or none, keeps the older behaviour: the native target converts and the web target falls back to the heuristic.

`transform.js` is pure content-in/content-out; `run.js` does the reading, writing (through `io.writeIfChanged` — an unchanged full sync touches nothing, or Metro/Vite rebuild for nothing) and computes the destination `depth` that authoring-relative imports need. `aliases.js` rewrites `../@components/Card` → `../components/Card` per destination depth, with `@/` root-alias sugar stripped and `@layout` deliberately left alone (an entry-level convention). CSS: the web pass strips Tailwind v3 `@tailwind` directives (Tailwind v4 is CSS-first).

## Options

| Option | Meaning |
| --- | --- |
| `platform` | `"web"` \| `"native"`; defaults from `applyRNTransform` |
| `applyRNTransform` | apply the RN transform (native targets) |
| `useWebTransform` | force the native→web pass on (`true`) / off (`false`); omitted leaves it to the content heuristic |
| `packageMappings` | override `rexpo.config.js`'s mappings for this conversion |
| `transform` | connector hook run last (target quirks like NativeWind directives) |

## Files

| File | Job |
| --- | --- |
| `index.js` | The single require path / barrel for everything above. Runnable: `node script/converter/index.js` does a full pass then live-watches; `--once` is what `sync` uses. |
| `transform.js` | The pipeline, in order — macros, then the direction pass, then the same-dialect alias fallback. |
| `run.js` | `convertFile()`, `syncDir()`, and the CLI entry. |
| `aliases.js` | Authoring-relative import rewriting per destination depth. |
| `direction.js` | `config.source` × target template → the transform options for that conversion. |
| `directions.js` | Barrel for the two direction folders — one require path for both passes. |
| `react-to-expo/` | The **react → expo** direction: forward module table, native tag tables, prop rewrites, the HTML→RN JSX walk, the assembled pipeline (see its README). |
| `expo-to-react/` | The **expo → react** direction: reverse module table, DOM tag table, prop rewrites, the RN→DOM JSX walk, unused-import pruning, the assembled pipeline (see its README). |
| `modules.js` | The shared specifier-rewriting engine — the mapping tables live with their directions. |
| `imports.js` | Import-statement utilities (leaf of the converter — see `imports/`). |
| `jsx/read.js` | The shared JSX tag reader — both directions walk with it. |
| `platform-blocks.js` | The macro surface (see `macro/`). |
| `warn.js` | The unmapped-name warning, and the current-source tracking behind it. |
| `imports/` | Import scanning and statement editing. |
| `macro/` | The platform macros. |

Unmapped HTML tags are kept as-is and warned about (a DOM element surviving into React Native is a runtime `View config` error); custom components are never touched.
