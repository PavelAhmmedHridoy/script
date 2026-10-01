/**
 * usage.js — the `rexpo help` text.
 *
 * Kept apart from the dispatcher so the command list is one editable block
 * instead of a string buried in the middle of main().
 */

const USAGE = `
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
`.trim();

module.exports = { USAGE };
