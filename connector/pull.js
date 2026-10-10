/**
 * pull.js — the inverse direction: template/<target> -> root, verbatim.
 *
 * `syncConnectors` writes root -> template/<target>, converting as it goes.
 * This walks the same routes backwards and copies each template file to the
 * root path its route came from, so a mangled root file can be restored from
 * the last generated copy (`sync:react`, `sync:expo`).
 *
 * It is deliberately the dumb direction: what returns is the template's
 * dialect, not the authoring one, and only files that already have a root
 * counterpart are written. See connector/pull/run.js for the three things to
 * know before running it.
 *
 * Routes are keyed by template and evaluated in order, mirroring the forward
 * connectors' `getTargetPath`. They are explicit rather than derived: inverting
 * a path-building function generically is guesswork, and a wrong guess here
 * overwrites authored source.
 *
 * The work is split across connector/pull/, and this stays the single require
 * path (the CLI requires `connector/pull`, and `node script/connector/pull.js`
 * still pulls both enabled templates):
 *
 *   pull/routes.js  the inverse route table, and matching a template file to a
 *                   root path
 *   pull/run.js     the writers — verbatim copy, stylesheet restore, bundle
 *                   entry — and the per-template walk
 */

const { ROUTES, routeFor } = require("./pull/routes");
const {
  pullTemplate,
  pullTemplates,
  restoreDirectives,
  pullBundle,
} = require("./pull/run");

module.exports = { pullTemplate, pullTemplates, routeFor, ROUTES, restoreDirectives, pullBundle };

// Allow `node script/connector/pull.js` to pull both enabled templates.
if (require.main === module) {
  const { loadConfig } = require("../support/config");
  const config = loadConfig();
  const templates = Object.keys(ROUTES).filter((template) => config.deploy?.[template]);
  pullTemplates(templates);
}
