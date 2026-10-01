# script/support

The three facts every other folder needs, each of which used to exist as several divergent copies (four config loaders with three different fallbacks, three package-manager detectors, per-folder root computation).

| File | Job |
| --- | --- |
| `paths.js` | The project root. `PACKAGE_ROOT` is the checkout this tool ships in; `resolvePackageRoot()` honours `REXPO_ROOT`, which lets the CLI and tests be pointed at a fixture project without touching this one. |
| `config.js` | The one loader for `rexpo.config.js`, merged over `DEFAULT_CONFIG` (deploy both targets, ports 7681 / 8081, `monitor.debounceMs` 150) so call sites can dereference `config.ports.web` without a second guess at defaults. |
| `package-manager.js` | `detectPackageManager()` from `npm_config_user_agent` — the only signal that survives being invoked through a script alias. Returns `null` when launched by hand (`node script/...`), leaving the fallback choice to the caller. |

Nothing here requires anything else under `script/` except `paths.js` ← `config.js`, so every other folder can depend on support without cycles.
