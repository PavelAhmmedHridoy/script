# script/cli

The `rexpo` command, wired as the package `bin`. `index.js` only dispatches; the parser, the help text and one module per command live beside it.

## Command reference

Generated verbatim from `usage.js` — the same text `rexpo help` prints — so this section cannot drift from the CLI. Edit `usage.js`, then re-run `node script/cli/generate-readme-reference.js`:

<!-- BEGIN GENERATED: cli-usage -->

```
rexpo — write the app once, ship it to web and native

Usage
  rexpo install [package] [flags]

Commands
  install [package]   With no package: detect what src/ imports, reconcile the
                      dependency bundles, then install in each template.
                      With a package: add it to the target(s) that need it.
  dev                 Start the web target (Vite)
  start               Start the native target (Metro)
  all                 Start both targets
  deps                Reconcile dependency bundles only
  sync                Regenerate both templates (no servers). Target flags
                      scope it to one; --from-template copies that template's
                      files back into the root instead (see sync:react/sync:expo)
  doctor              Preflight in the terminal: bundles, installed packages,
                      Expo SDK compatibility, typecheck, generated files
  help                Show this message

Target flags (install and sync)
  --next, --web, --react      web target
  --expo, --native, --app     native target
  (install: neither => auto-detect from src/, packageMappings, the package name)

Other flags
  --no-install        Edit the manifests but do not run the package manager
  --from-template     sync only: root <- template, verbatim (alias --pull)

Examples
  rexpo install
  rexpo install lucide-react
  rexpo install expo-camera --expo
  rexpo install framer-motion --next
  rexpo install zod@3.23.8

  rexpo doctor        # run this before bundling if a build stalls
```

<!-- END GENERATED: cli-usage -->

Beyond the flags the help text lists: `install <pkg>@1.2.3` pins a version (the `@` split leaves `@scope/pkg` alone), and `--pull` is an alias for `--from-template`.

## Files

| File | Job |
| --- | --- |
| `index.js` | Dispatch argv → command. Runnable directly (`node script/cli/index.js <cmd>`). |
| `args.js` | Pure argv parsing (flags set + positionals) and `pkg@version` splitting that leaves `@scope/pkg` alone. No filesystem, so it is testable by calling it with an array. |
| `config.js` | The CLI's view of the project: root (`REXPO_ROOT` honoured) and `scopeDeploy()`, which narrows `config.deploy` to the requested targets so an install flag also scopes which manifests are touched. |
| `usage.js` | The `rexpo help` text, kept apart so the command list is one editable block. |
| `generate-readme-reference.js` | Splices `usage.js` into this README's generated command reference (see the markers above). Run `node script/cli/generate-readme-reference.js` after editing the help text; a no-op when already current. |

## Commands (`commands/`)

| File | Job |
| --- | --- |
| `install.js` | Both install modes. With no package: scan, reconcile the bundles, refresh manifests, run the package manager. With packages: resolve each one's target(s) (auto-detected when no flag is given), add to the bundle, report, optionally install. |
| `servers.js` | `dev` / `start` / `all` — the same runner pipeline scoped to one target or both. |
| `maintenance.js` | `deps` (reconcile only) and `sync` (forward: regenerate templates from the root, converted; `--from-template`: the pull direction, verbatim). |
| `doctor.js` | A thin wrapper over `script/doctor/` — exit code 1 when any check failed. |
