# script/runner

The pipeline entry point: reconcile dependencies → sync the templates → start the target's dev server → watch for edits. `dev` scopes everything to the web template, `start` to the native one, and nothing (or `all`) runs both.

## Files

| File | Job |
| --- | --- |
| `index.js` | `runAll({ target })` — the full pipeline, plus `resolveTarget()` (CLI mode → `react` / `expo` / `all`) and `scopedConfig()` (narrows `deploy` to the requested targets, still respecting `rexpo.config.js`). |
| `dev.js` | `runDev()` — `pnpm dev` inside `template/react` (Vite) with `--port` and `--host`, so the LAN address serves the app too. |
| `start.js` | `runStart()` — `pnpm start` inside `template/expo` (Metro/Expo) with `--port`, plus LAN host advertisement (below). |
| `run-template-script.js` | The shared spawn: package-manager fallback, template existence checks, exit reporting. `stdio: "inherit"` on purpose — a dev server owns the terminal. |

## Order matters

`syncDependencies` runs **before** `syncConnectors`: the deps pass updates the root `package.json` / `tsconfig.json` bundles, and the config connector regenerates each template's manifests from them. Running them the other way round would erase every discovered dependency.

## The native server's environment (`start.js`)

- `REACT_NATIVE_PACKAGER_HOSTNAME` is set to the machine's LAN IPv4 (wlan/eth/en interfaces preferred), because Expo's own detection resolves to loopback on Android/Termux and the QR code would point at `localhost`. A value the user set wins. It only changes the advertised URL — Metro binds all interfaces either way.
- `CI`, `EXPO_UNSTABLE_HEADLESS` and stdout's TTY-ness are deliberately left alone, so `expo start`'s interactive banner (QR code, `exp://` URL, key bindings) behaves exactly as when run by hand. `EXPO_UNSTABLE_HEADLESS=1 pnpm start` still gets you the quiet, non-interactive server when the standalone DevTools shell cannot run on your device.

Each runner script is also runnable directly (`node script/runner/dev.js`), and returns `false` instead of spawning when its target is disabled or its template is not runnable.
