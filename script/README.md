# rexpo

Write the app once in React, ship it as a website **and** an Expo (React Native) app.

`rexpo` is a generator plus a small authoring convention. You edit files in `src/`,
and every file is transpiled into two real, independent projects:

- `template/react` — Vite + React + Tailwind CSS v4
- `template/expo` — Expo Router + NativeWind

Neither template is hand-maintained. Both are regenerated from `src/` on every sync.

This file is the main guide. Each folder under `script/` carries its own
`README.md` documenting its files and contracts — see the index below.

---

## Pipeline

```
                 src/@app.tsx   src/@layout.tsx   src/@pages/*   src/global.css
                        │
                        ▼
  script/deps         reconcile the root package.json/tsconfig.json bundles
                      with what src/ imports (per platform, post-macros)
                        │
                        ▼
  script/connector    12 route connectors: decide which target path each file
                      maps to, and regenerate each template's manifests
                        │
                        ▼
  script/converter    platform macros (useWeb / useApp / classWeb / classApp)
                      → module auto-detection (a web-only import becomes its
                      native equivalent) → the React Native transform, native
                      only (HTML → RN components, bare text → <Text>)
                        │
            ┌───────────┴───────────┐
            ▼                       ▼
    template/react             template/expo
    (Vite, Tailwind v4)        (Expo Router, NativeWind)
```

`script/watcher` runs the same routing on every file change, so live edits land
byte-identically to where a full sync would put them.

---

## Quick start

```bash
pnpm install

pnpm rexpo install   # detect what src/ imports, reconcile deps, install
pnpm dev             # web only    → http://localhost:7681
pnpm start           # native only → http://localhost:8081
```

Run these from the repo root. `pnpm dev` and `pnpm start` are root scripts that
sync `src/` into the target template and then run *that* template's server;
`pnpm rexpo <cmd>` and `node script/cli/index.js <cmd>` drive the same pipeline
through the CLI.

`pnpm start` is how the native app gets served: it syncs `src/` into
`template/expo`, then starts Expo's own server there with the port from
`rexpo.config.js` — the same interactive banner, QR code and key bindings you
get from `cd template/expo && pnpm start`, plus a `http://localhost:8081 ·
exp://<lan-ip>:8081` line so both addresses are visible at a glance. The runner
also fixes the advertised host to the machine's LAN address, which Expo's own
detection gets wrong (loopback) on Android/Termux.

Android / iOS / lint / doctor delegate into the Expo template:

```bash
pnpm android    pnpm ios    pnpm web    pnpm doctor    pnpm lint
```

Ports live in `rexpo.config.js` (`ports.web` = Vite, `ports.expo` = Metro).

---

## CLI

```bash
rexpo install                        # auto-detect src/ imports, reconcile, install
rexpo install <pkg>                  # auto-detect the target(s) and add it
rexpo install <pkg> --next           # web target only
rexpo install <pkg> --expo           # native target only
rexpo install <pkg> --next --expo    # both
rexpo install <pkg>@1.2.3            # pin a version
rexpo install <pkg> --no-install     # edit manifests, skip the package manager

rexpo dev | start | all | deps | sync | doctor | help
```

`--next` / `--web` / `--react` scope to the web target; `--expo` / `--native` /
`--app` to the native one.

### `rexpo sync` — both directions

Forward (default) runs that target's full pipeline — connectors, converter,
generated entries — and nothing else: no dependency reconciliation, no servers,
no watchers. Since every write goes through `script/io.js`, a sync that changes
nothing writes nothing.

| Script | Direction | Equivalent |
| --- | --- | --- |
| `pnpm sync:web` | root → `template/react` | `rexpo sync --web` |
| `pnpm sync:app` | root → `template/expo` | `rexpo sync --expo` |
| `pnpm sync:react` | `template/react` → root | `rexpo sync --web --from-template` |
| `pnpm sync:expo` | `template/expo` → root | `rexpo sync --expo --from-template` |

The pull pair is the recovery direction, and it is deliberately dumb: each file
is copied back to the root path its route came from, **verbatim**. Three things
follow from that:

- What returns is the template's dialect, not the authoring one. A native file
  comes back with `<View>` / `<Text>` / `onPress` and without `useWeb` / `useApp`
  — those were resolved at build time, and no table can tell a `Text` you wrote
  from a `Text` the converter emitted.
- Only files that already have a root counterpart are written. Template
  scaffolding (the Expo template's own components and hooks, a generated
  `main.tsx` or `app/_layout.tsx`) has no root file to restore, so it is listed
  as skipped instead of appearing in `src/`. A root file you deleted cannot be
  pulled back — recreate it empty and pull again.
- `template/expo/app/foo.tsx` is ambiguous: it can come from `src/@app/foo.tsx`
  or `src/@pages/foo.tsx`. An existing root file wins; otherwise the documented
  route (`src/@pages/`) is used.

The pull routes mirror the connectors' `getTargetPath` functions by hand, in
`script/connector/pull/routes.js` — inverting a path builder generically is
guesswork, and a wrong guess there overwrites authored source. The one
non-verbatim case is the global stylesheet: the web pass strips the Tailwind v3
directives, so a pull re-adds them rather than deleting lines you wrote.

### `rexpo doctor`

Run this **before** bundling. It does the checks a stalled bundle cannot tell
you about, entirely offline:

| Check | Catches |
| --- | --- |
| config source | a target with no config source at all: no `package.expo` / `tsconfig.react` file, and no `react` / `expo` bundle entry to fall back on. Also a bundle key no target reads |
| config matches template | a template edited by hand, replaced by a fresh scaffold, or a source changed without a sync. Compared **byte-for-byte** through the same serializer the writer uses, for `package.json` *and* `tsconfig.json`, and the report names which file won — so drift in `scripts`, `devDependencies` or compiler options cannot hide behind matching dependencies |
| package manager | a manager that is on PATH but cannot execute (see troubleshooting) |
| installed | a declared dependency missing from `node_modules` |
| version drift | an installed version outside its declared range |
| SDK compatibility | `expo install --check` — the "common problem" Expo prints and does not expand |
| typecheck | `tsc --noEmit` per template |
| generated files | a build-time macro or generator path leaked into output |

Exit code is 1 when anything failed, so it drops straight into CI.

### Target auto-detection

With no target flag, `rexpo install <pkg>` decides where the package belongs, in
order of how trustworthy the signal is:

1. **Where it is imported.** `src/` is scanned per platform, post-macros, exactly
   as the converter sees it — so a package used only inside a `useWeb` block is
   web-only. This covers writing the import first and installing afterwards.
2. **`packageMappings`.** A mapped *value* (`moti`) is native. A mapped *key*
   (`framer-motion`) is the web original and installs into both, since the
   native side receives the mapped equivalent.
3. **Name heuristics.** `expo-*`, `react-native*`, `@expo/*` are native;
   `react-dom`, `vite`, `tailwindcss`, `next` are web.
4. **Unknown → both**, because this is one codebase targeting two platforms and
   a missing dependency is worse than an extra one.

Examples:

| Command | Result |
| --- | --- |
| `rexpo install expo-camera` | auto-detects `expo` |
| `rexpo install lucide-react --expo` | adds `lucide-react-native` to `expo` |
| `rexpo install framer-motion` | `framer-motion` → `react`, `moti` → `expo` |
| `rexpo install zod` | both (unknown package) |

A version is reused from the other target or read from an installed copy. An
explicit `install` may fall back to the `latest` tag, since you asked for it;
the background reconciliation pass never does.

---

## Project layout

```
rexpo.config.js      source/deploy flags, ports, packageMappings, deps, monitor
script/              the generator — see the folder index below
src/                 ← the only place you edit app code
template/react/      generated web project
template/expo/       generated native project
types/               rexpo.config.js type definitions
```

### script/ folder index

Each folder has its own README with its files, contracts and non-obvious choices:

| Folder | One-line job | README |
| --- | --- | --- |
| `script/index.js` | Entry: install → runner. *(file)* | — |
| `script/io.js` | Write-only-on-change filesystem helpers. *(file)* | — |
| `support/` | Project root (`REXPO_ROOT`), the one config loader, package-manager detection. | [support/README.md](support/README.md) |
| `install/` | `<pm> install` inside each template. | [install/README.md](install/README.md) |
| `runner/` | The pipeline: deps → sync → dev server → watchers. | [runner/README.md](runner/README.md) |
| `watcher/` | chokidar live sync + preflight checks. | [watcher/README.md](watcher/README.md) |
| `connector/` | The 12 route connectors, generated entries, and the pull direction. | [connector/README.md](connector/README.md) |
| `converter/` | The source-to-target transform: platform macros, and one folder per direction (`react-to-expo/`, `expo-to-react/`) owning that direction's module table, tag tables, prop rewrites and JSX pass. | [converter/README.md](converter/README.md) |
| `deps/` | Dependency scanning, reconciliation, `rexpo install`'s engine. | [deps/README.md](deps/README.md) |
| `authoring/` | `platform.ts` — the authoring-only macro shim (never ships). | [authoring/README.md](authoring/README.md) |
| `cli/` | The `rexpo` command. | [cli/README.md](cli/README.md) |
| `doctor/` | The offline preflight checks and report. | [doctor/README.md](doctor/README.md) |

---

## Authoring conventions

Files under `src/` are routed by an `@`-prefixed name:

| You write | Web target | Native target |
| --- | --- | --- |
| `src/@app.tsx` | `template/react/src/App.tsx` | `template/expo/app/index.tsx` |
| `src/@layout.tsx` | `template/react/src/@layout.tsx` | `template/expo/components/root-layout.tsx` |
| `src/@pages/about.tsx` | `template/react/src/pages/about.tsx` | `template/expo/app/about.tsx` |
| `src/@components/*` | `template/react/src/components/*` | `template/expo/components/*` |
| `src/@hooks/*` · `@lib/*` · `@utils/*` · `@styles/*` | mirrored into `src/…` | mirrored into the app root |
| `src/global.css` | `template/react/src/global.css` | `template/expo/global.css` (NativeWind input) |
| `assets/**` | `template/react/assets/**` | `template/expo/assets/**` |

Both targets use the same folder name for the same purpose. On the web target
that folder is Vite's `publicDir` (set explicitly in
`template/react/vite.config.ts`), so `assets/images/favicon.png` is served from
`/images/favicon.png`.

Two files are **generated, not authored**:

- `template/react/src/main.tsx` — mounts `<Layout><App /></Layout>`, imports
  `index.css` (Tailwind) and `global.css`. With `src/@pages/` present it
  becomes a real router: a `BrowserRouter` wraps `Routes` generated from the
  pages folder (`index` → `/`, `about` → `/about`, `[id]` → `/:id`), with the
  author's `@app` as the index route — the same routing expo-router derives
  from the same folders.
- `template/expo/app/_layout.tsx` — expo-router's root route: renders `<Slot />`
  inside your layout component.

`@layout.tsx` becomes a *component* on native rather than being written to
`app/_layout.tsx`, because expo-router needs to own that file's router. Writing
your shell there directly would render a blank screen.

### Platform macros

`useWeb` / `useApp` and `classWeb` / `classApp` are build-time macros, resolved
per target — no runtime branching:

```tsx
import { useWeb, useApp, classWeb, classApp } from "script/authoring/platform";

export default function Screen() {
  const [n, setN] = useState(0);

  useWeb(() => {
    document.title = `Count ${n}`;
  });

  useApp(() => {
    Haptics.selectionAsync();
  });

  return (
    <div className={`panel ${classWeb("hover:border-slate-700")} ${classApp("min-h-11")}`}>
      Hello
      {useWeb(() => <a href="/todos">Todos</a>)}
      {useApp(() => <NativeOnly />)}
    </div>
  );
}
```

| Form | Web output | Native output |
| --- | --- | --- |
| `useWeb(() => expr)` | `(expr)` | removed (`null` in expression position) |
| `useWeb(() => { … })` | `(() => { … })()` | removed |
| `useApp(() => expr)` | removed (`null`) | `(expr)` |
| `useApp(() => { … })` | removed | `(() => { … })()` |
| `classWeb("hover:x")` | appended at the end of `className` | `""` |
| `classApp("min-h-11")` | `""` | appended at the end of `className` |

#### The brace form — imports and exports

An `import` cannot be wrapped in a callback (imports are hoisted, static
declarations), so block macros also accept a brace body, and the paired form is
**one construct**:

```tsx
useWeb {
  import Logo from "./logo.web";
  export const AppLogo = Logo;
}
useApp {
  import Logo from "./logo.native";
  export const AppLogo = Logo;
}
```

The kept half's body is spliced in verbatim, with no wrapping function — which
is what lets it hold `import` / `export` declarations. A lone block for the
platform not being generated is dropped whole. Either half order works
(`useApp{ B }:useWeb{ A }` too).

#### Platform-scoped imports (directive form)

For a single import there is a lighter spelling — a trailing directive comment:

```tsx
import RexpoLogoWeb from "./rexpo-logo.svg";        // useWeb
import RexpoLogoNative from "./rexpo-logo-native";  // useApp

const RexpoLogo = useWeb(() => RexpoLogoWeb) ?? useApp(() => RexpoLogoNative);
```

The converter deletes the whole statement — comment included — on the platform
that does not keep it, before that platform's bundler or the dependency scanner
ever sees the specifier.

#### Platform classes

The two targets do not compile the same Tailwind: web is Tailwind v4 against a
real DOM, native is NativeWind against React Native. A class only one side can
honour goes inside `classWeb` / `classApp`, which keep it on that target
(appended at the end of the enclosing className) and give the other platform
`""` and no class at all — so it never reaches a stylesheet that could not
apply it.

```tsx
const webInteractive = classWeb("cursor-pointer transition-colors duration-150");
const appTouchTarget = classApp("min-h-[44px]");
```

- **`classWeb`** — hover and focus states, `cursor-*`, `transition-*`,
  responsive `md:*` prefixes, `font-mono` (a CSS font list is not an RN
  `fontFamily`), `min-h-screen`, gradients, backdrop blur.
- **`classApp`** — a minimum touch target, a device-only rule, or a spelling
  the native dialect still uses.
- **The bare-attribute shorthand** — when an element needs nothing but one
  platform-only class, write it as a plain prop instead of opening a template
  literal just to hold the call:

  ```tsx
  <span classWeb="hover:underline" classApp="active:opacity-70" className="text-sm">
  ```

  It is removed on the platform that drops it and appended into that element's
  own `className` on the platform that keeps it. It only merges into a
  `className` that is a plain string or a hole-free template literal; anything
  else is left alone and reported — use the call form there:
  `` className={`${navLinkStyles} ${classWeb("hover:underline")}`} ``.

The macro import is lifted back out of every file, so nothing under `script/`
ever reaches a template's dependencies or bundle. `script/authoring/platform.ts`
exists only so the editor and `tsc` can resolve the calls while you author; its
functions throw if they somehow reach runtime. A call the converter cannot
parse as a callback is left untouched and reported, so the build fails at a
real identifier instead of silently dropping code.

---

## Configuration

`rexpo.config.js` is typed by `types/rexpo-config.d.ts`:

```js
source:  { react: true, expo: false }   // authoring dialect
deploy:  { react: true, expo: true }    // which targets are generated
ports:   { web: 7681, expo: 8081 }
package: { support: "pnpm" }
scripts: { react: {...}, expo: {...} }  // script names invoked in each template

packageMappings: {                      // web package → native equivalent
  'framer-motion': 'moti',              // the converter REWRITES the import
  'lucide-react': 'lucide-react-native', //   on the native target, subpaths
  'react-router-dom': 'expo-router',    //   intact
  ...
}

deps: {                                 // dependency reconciliation
  autoAdd: true,               // add packages imported in scanDirs to the bundles
  scanDirs: ["src"],           // folders searched for imports
  allowUnknownVersions: false  // never guess a version
}

monitor: { strictTypeChecking: true, autoFixImports: true, debounceMs: 150 }

specialFiles: {                         // per-target special files
  react: {
    include: [".env", ".env.local"],     // root files copied verbatim into
                                        // template/react/ ("none" opts out;
                                        // { from, to } renames in the template)
    exclude: []                         // file names this target must NOT get
  },
  expo: { include: [".env"], exclude: [] }
}
```

### How dependencies work

A target's `package.json` / `tsconfig.json` is generated from the first of
these that exists:

```
package.expo / tsconfig.expo     a per-target file, next to the shared one
package.json / tsconfig.json     its "expo" bundle entry

the winner  →  template/expo/package.json
```

Both forms are ordinary JSON and mean the same thing:

```jsonc
// package.expo — one target's config, on its own
{ "name": "my-app", "dependencies": { ... } }

// package.json — one entry per target, under a react / expo key
{ "react": [ { ...web config... } ], "expo": [ { ...native config... } ] }
```

The per-target file is how a heavily customised target lives in a file of its
own instead of a nested array; the bundle stays as the fallback, and the two
mix freely per file and per target. `rexpo doctor` names which source each
generated file came from:

```
[ok  ] expo: package.json matches bundle
       28 dependencies — from package.expo
```

Add a dependency once at the root and it reaches both targets. The `deps` pass
does this for you when it can: it scans `src/` per target (on the post-macro
content, so a package used only inside `useApp` is not demanded by the web
build), applies `packageMappings` for native, and writes what it finds back to
whichever source is in play. A per-target file carries no `.json` extension
(the target suffix is the marker), so nothing loads it as a module. The
serializer — `bundleEntryJson()` in `script/connector/[config].js` — is shared
by the writer and the checker, so "the template matches its source" means the
exact bytes that function produces, whichever source won.

### Special files — what each template receives

Some root files belong to exactly one template, and some never reach either:
`metro.config.js` means nothing to Vite, `vite.config.ts` means nothing to
Metro, and `.env` / `.env.local` used to be filtered by the watchers as
tooling noise — so a native build failed with an unresolved variable instead
of a named cause.

`specialFiles` in rexpo.config.js settles both, per target:

- **`include`** — root files copied verbatim into that template. Defaults to
  `[".env", ".env.local"]` for both; a non-empty array replaces the default;
  `"none"` opts out. `{ from: ".env.staging", to: ".env" }` copies under a
  different name. Listed files are also watchable live — create one and it
  reaches the templates without a restart.
- **`exclude`** — file names that template must NOT receive, subtracted from
  the built-in plain-copy table. This is how a template stops getting a file
  it has no use for.

Both targets get `.env` / `.env.local` by default; exclude nothing and the
built-in table is unchanged. The copies go through `io.copyFileIfChanged`, so
an unchanged special file never triggers a rebuild.

`packageMappings` is honoured in two places, which is what makes the pairs real
rather than decorative: the converter **rewrites the import specifier** on the
native target, and the dependency pass **installs the native package**. A
mapping with no rewrite would leave a web-only import in the native bundle; a
rewrite with no install would leave it unresolved.

### Module auto-detection

On the native target the converter swaps every mapped specifier it finds —
plain imports, re-exports, dynamic `import()` and `require()`, with subpaths
preserved:

```ts
import { motion } from "framer-motion";        →  from "moti"
import { m } from "framer-motion/animate";     →  from "moti/animate"
export { Helmet } from "react-helmet-async";   →  from "expo-head"
const x = await import("lucide-react");        →  await import("lucide-react-native")
```

Specifiers inside comments and string literals are left alone, the web output
is untouched, and the pass is idempotent. `react-dom` / `react-dom/client` →
`react-native` is built in and always applied.

**Internal specifiers are shielded and can never become dependencies:**
relative paths, the `@/` `~/` `#` aliases, Node built-ins (`fs` and `node:fs`),
URLs, anything under `script/`, and the authoring macro shim. The tooling alias
is read from your own `tsconfig.json` `paths` rather than assumed to be
`@script/`, so `{"@rexpo": "./script/*"}` (or any other name) is picked up
automatically.

---

## Invariants worth knowing before editing script/

- **All writes go through `script/io.js`.** Rewriting identical content bumps
  mtimes; Vite and Metro treat that as a change, Metro invalidates its
  transform cache, and a bundle in flight stalls near the end. Writing only on
  a real difference makes repeated syncs safe next to live servers.
- **Order: deps before connectors.** The deps pass updates the root bundles;
  the config connector regenerates template manifests from them. Reversed,
  every discovered dependency is erased.
- **The root bundle is the source of truth.** Template manifests are always
  generated, never hand-edited; doctor compares bytes, and the pull direction
  writes bundles back into the root entry rather than over the shared file.
- **The converter has no parser.** Every pass is a quote-, brace- and
  comment-aware character walk; when a construct cannot be parsed safely, it is
  left untouched and reported instead of silently dropped.
- **Generated output contains zero generator references.** No macro calls, no
  `script/authoring/platform` import; doctor's `generated-files` check
  enforces it.
- **`[name].js` is the connector loader's convention.** Subfolders under
  `connector/` are engines invisible to the loader; each `[name].js` stays the
  single require path.

---

## Verification status

Proven by running:

- `tsc -b` and `vite build` pass in `template/react`, with `<Layout>` and
  `global.css` verifiably in the output bundle.
- `tsc --noEmit` passes in `template/expo`.
- Platform macros produce correct, macro-free output for both platforms, and
  leave zero `useWeb` / `useApp` / `authoring/platform` references in any
  template file.
- Dependency reconciliation is idempotent, applies `packageMappings`, excludes
  every internal specifier, and is a no-op on this repository.
- `sync:web` / `sync:app` change nothing on an up-to-date repository (template
  checksums identical before and after, and a target-scoped sync leaves the
  other template untouched); the pull direction was exercised end to end
  against a fixture root via `REXPO_ROOT` — route resolution, the `@app` vs
  `@pages` rule, the skipped-without-counterpart list, the stylesheet directive
  restore, and a repeat run writing 0 files.
- The config → template link was exercised against real drift: `template/expo`
  replaced wholesale by a stock scaffold was caught by doctor (including the
  tsconfig), and `pnpm sync:app` reconnected it, with the web template left
  untouched. Per-target config files (`package.react` / `package.expo` /
  `tsconfig.expo`) were exercised end to end on a fixture root.

Not proven:

- **A full native Metro bundle.** `expo export --platform android` did not
  finish within the time budget on the machine it was tested on — Metro started
  but did not complete. The native output is verified to the type-check and
  source level only.
- Nothing in this repository has been run on a physical device or simulator.

---

## Troubleshooting

Start with `rexpo doctor` — it exists to turn the symptoms below into a named
cause.

### A bundle stalls near the end ("99% (1745/1746)")

Metro is not reporting an error, because there often is not one: its transform
cache was invalidated mid-bundle and it restarted. The giveaway is
`Detected a change in metro.config.js. Restart the server to see the new results.`

**Cause:** a sync ran while the server was live and rewrote `metro.config.js`,
`babel.config.js` or template source files. Rewriting an identical file still
bumps its mtime, which is enough for Metro and Vite to treat it as changed.

**Fixed:** every write goes through `script/io.js` and only happens when the
content actually differs, so a repeat sync is a true no-op. On an older
revision, don't re-run the sync command while a server is up.

### The native server starts without a QR code

`pnpm start` shows Expo's own banner exactly as if you had run `expo start` in
`template/expo` yourself. Expo only draws that UI when all three hold: stdout
is a TTY, `CI` is unset, and `EXPO_UNSTABLE_HEADLESS` is unset. The runner sets
none of them; it only forwards your environment.

If the standalone React Native DevTools shell cannot run on your device
(Android/Termux crashes installing `fb-dotslash`), run the server without the
UI instead of editing any code:

```bash
EXPO_UNSTABLE_HEADLESS=1 pnpm start
```

The browser DevTools at `/open-debugger` keep working either way.

### `expo: package.json matches bundle` fails

The template config no longer matches its entry in the root bundle — usually a
hand-edited `template/*/package.json`, or a template replaced by a fresh
scaffold. Nothing is lost by regenerating it:

```bash
pnpm sync:app      # rewrite template/expo from the root bundles
pnpm sync:web      # the same for template/react
cd template/expo && pnpm install   # a regenerated manifest describes packages
                                   # that may not be on disk yet
```

### `The following packages should be updated… Run npx expo install --check`

Expo SDK packages declared behind the versions the installed SDK expects. The
root bundle is the source of truth, so fix it there and re-sync:

```bash
# in the root package.json, then:
rexpo sync
cd template/expo && ./node_modules/.bin/expo install --fix
```

`--check` and `--fix` are mutually exclusive — `expo install --fix` is the one
that applies them.

### `Error: spawn pnpm ENOENT`

A package manager exists on PATH and is flagged executable, but the kernel
cannot resolve its shebang. On Termux, pnpm's `#!/usr/bin/env node` points at
`/usr/bin/env`, which does not exist there, so every spawn fails. `rexpo
doctor` detects this rather than letting it surface from inside another tool.
Two ways out:

```bash
# 1. Rewrite the shebangs in place (Termux only)
termux-fix-shebang $(command -v pnpm)

# 2. Or use npm for the template that has a pnpm lockfile:
#    remove template/expo/pnpm-lock.yaml and template/expo/pnpm-workspace.yaml,
#    then reinstall. expo infers the manager from the lockfile it finds.
```

Confirm with `node $(command -v pnpm) --version`: if that prints a version, the
binary is fine and only the shebang is broken.

---

## Known limitations

- **Static imports cannot be platform-scoped** except through the directive
  form (`// useWeb` / `// useApp`) or the brace form. A plain top-level
  `import` with no marker lands in both bundles even if every use of it sits
  inside a `useApp` block.
- Removing a `useWeb` / `useApp` statement can leave one blank line behind.
- `select` → `View` and `option` → `Text`: there is no `Picker` in
  react-native core, so selects degrade to layout rather than a broken import.
- Removed expressions become `null`, which is a valid JSX child but visible in
  rendered text if you relied on the raw expression never producing output.
