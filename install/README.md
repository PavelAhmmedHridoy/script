# script/install

Runs `<pm> install` inside each bundled template (`template/react`, `template/expo`), using the same package manager that launched rexpo — npm, pnpm, yarn or bun, detected from `npm_config_user_agent` by `script/support/package-manager.js`.

- A template that does not exist yet, or has no `package.json`, is skipped with a warning rather than treated as a failure: the connectors create it on the next sync.
- `runInstall()` is the named alias `script/index.js` reads.
- `node script/install/index.js` runs the installer directly; the exit code is 1 when any install failed.
