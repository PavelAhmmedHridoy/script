/**
 * [entry].js — connector for each template's entry point.
 *
 * These files are generated rather than copied: an author writes
 * src/@app.tsx and src/@layout.tsx, and each target needs a different
 * bootstrap around them.
 *
 *   react -> template/react/src/main.tsx      mounts <Layout><App /></Layout>
 *   expo  -> template/expo/app/_layout.tsx    expo-router <Slot /> inside the
 *                                            author's layout component
 *
 * With src/@pages/ present the web entry becomes a real router: a
 * BrowserRouter wraps Routes generated from the pages folder — the same
 * routing the expo target gets from expo-router — so a multi-page authoring
 * tree deploys to both targets without hand-written web routing.
 *
 * Neither file is a route connector: nothing in an app should have to import
 * main.tsx, and the expo layout is expo-router's own convention, so this runs
 * on every full sync (before the servers start) and has no getTargetPath.
 *
 * The work is split across connector/entry/, and this stays the single require
 * path (the connector loader matches `[name].js`, so a folder is invisible to
 * it):
 *
 *   entry/sources.js    what the author's tree contains — @app, @layout, pages
 *   entry/templates.js  the two generated files, and the sync that writes them
 */

const { SOURCE_EXTENSIONS, detectSources, detectWebPages, routeName } = require("./entry/sources");
const { reactEntry, expoLayout, sync } = require("./entry/templates");

module.exports = { sync, reactEntry, expoLayout, detectSources, detectWebPages, routeName, SOURCE_EXTENSIONS };
