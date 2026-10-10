# script/doctor

Terminal-side preflight for `rexpo doctor` — the checks a stalled bundle cannot tell you about, entirely offline. The point is to catch in the terminal what would otherwise surface as a stalled or half-finished bundle on a device: Metro reporting `99% (1745/1746)` and never finishing is the failure mode this exists to replace with a named, actionable error.

Exit code is **1 when anything failed**, so it drops into CI as-is. Warnings do not fail.

## The checks, in the order they run

| # | Check | Catches | File |
| --- | --- | --- | --- |
| 1 | config source | a target with no config source at all (no per-target file, no bundle entry), and a bundle key no target reads | `checks/bundle.js` |
| 2 | generated configs match their source | a template edited by hand, replaced by a fresh scaffold, or a source changed without a sync — compared **byte-for-byte** through the same serializer the writer uses, and the report names which file won, so drift in `scripts` / `devDependencies` / compiler options cannot hide behind matching dependencies | `checks/bundle-files.js` |
| 3 | package manager | a manager that is on PATH but cannot execute (the Termux shebang case) | `checks/template.js` + `package-manager.js` |
| 4 | installed | a declared dependency missing from `node_modules` | `checks/dependencies.js` |
| 5 | version drift | an installed version outside its declared range (approximate, offline — unparseable/opaque/workspace ranges count as satisfied, a false "drift" is worse than a missed one) | `checks/dependencies.js` + `ranges.js` |
| 6 | Expo SDK compatibility | `expo install --check` — the "common problem" Expo prints and does not expand; the report keeps the lines naming the expected versions, one `--fix` away from applied | `checks/expo-sdk.js` |
| 7 | typecheck | `tsc --noEmit` per template (the web template's app/node split, the expo template's single config), run with the template's own local tsc | `checks/typecheck.js` |
| 8 | generated files | a build-time macro or generator path leaked into output — a file copied rather than converted | `checks/generated-files.js` |

Checks 3–7 run once per enabled template, prefixed `react:` / `expo:`. Without the root bundle nothing below check 1 can be evaluated, and without a template's `package.json` its install/typecheck checks are skipped.

## Files

| File | Job |
| --- | --- |
| `index.js` | `diagnose()` runs the checks; `runDoctor()` prints the report and returns the exit code. Runnable directly. |
| `checks/index.js` | The order above; stops after check 1 when the bundle is unusable. |
| `checks/*.js` | One file per check (plus `template.js`, which sequences the per-template ones). |
| `results.js` | The `{ level, check, detail }` shape every check reports in; `ok` / `warn` / `fail` constructors so a level typo is impossible. |
| `report.js` | Results → aligned `[ok ] / [warn] / [FAIL]` lines plus totals and the exit code. |
| `ranges.js` | Offline `^` / `~` / exact range satisfaction. |
| `package-manager.js` | Which manager a template expects (its own lockfile first, then `package.support`), and a `--version` probe that diagnoses the ENOENT-shebang case with the actual fix. |
| `exec.js` | The one way doctor starts a subprocess. |

## The one standing recommendation

Run `rexpo doctor` **before** bundling. Every failure above is something Metro or Expo shows as a stalled progress bar, a bare "common problem" line, or an error far from its cause.
