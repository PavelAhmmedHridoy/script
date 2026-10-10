/**
 * [layout].js — connector for the root layout component.
 *
 * Maps:
 *   src/@layout.tsx -> template/react/src/@layout.tsx
 *   src/@layout.tsx -> template/expo/components/root-layout.tsx
 *
 * The two targets need the layout in different places:
 *   - web: next to App.tsx, imported by the generated main.tsx.
 *   - native: expo-router owns app/_layout.tsx and renders the router there,
 *     so the author's shell lives as a component and is wrapped around
 *     <Slot /> by [entry].js. Writing it to app/_layout.tsx directly would
 *     remove the router and render a blank screen.
 *
 * Two cleanups ride along, both of which have to run for a live watcher edit
 * exactly as they do for a full sync:
 *
 *   - the author's `import "./global.css"` is dropped for native, because the
 *     generated app/_layout.tsx already imports the NativeWind entry and the
 *     relative path would no longer resolve from components/.
 *   - every `return ( ... )` with several sibling JSX roots is wrapped, because
 *     "Adjacent JSX elements must be wrapped in an enclosing tag" is a
 *     bundle-time crash on native and a blank page on web.
 *
 * Both live under connector/layout/, and this file stays the single require
 * path (the connector loader matches `[name].js`, so a folder is invisible to
 * it):
 *
 *   layout/sync.js      the routes, and the per-target cleanups
 *   layout/jsx-root.js  the multi-root guard, on its own so it can be tested
 *                       against a string
 */

const { sync, getTargetPath, transform, LAYOUT_PATTERN, TARGETS } = require("./layout/sync");
const { ensureSingleJsxRoot, countRootElements } = require("./layout/jsx-root");

module.exports = {
  sync,
  getTargetPath,
  transform,
  ensureSingleJsxRoot,
  countRootElements,
  LAYOUT_PATTERN,
  TARGETS,
};
