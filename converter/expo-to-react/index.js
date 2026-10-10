/**
 * converter/expo-to-react/index.js — the expo → react direction.
 *
 * Everything the web pass owns when the source is authored in native
 * primitives, in one require path: the reverse module table (native packages →
 * web equivalents), the DOM tag tables, the prop rewrites, the JSX walk, the
 * unused-import pruner, and the assembled pipeline.
 *
 * `../transform.js` is the dispatcher: connectors keep requiring
 * `../converter` and hand `directionOptions(source, template)`
 * (../direction.js) to `convertFile`, and the direction that runs follows from
 * the authoring dialect vs. the template — never from this folder being
 * required directly.
 */

const { applyWebTransform } = require("./transform");
const { buildReverseMappingTable } = require("./modules");
const { DOM_OF } = require("./tags");
const { pruneUnusedImports } = require("./prune-imports");
const { readTag, isNodeTag, TAG_NAME_RE } = require("../jsx/read");

module.exports = {
  applyWebTransform,
  buildReverseMappingTable,
  pruneUnusedImports,
  DOM_OF,
  // The shared JSX reader, re-exported so a consumer of the direction gets
  // everything the old `converter/jsx.js` surface exposed.
  readTag,
  isNodeTag,
  TAG_NAME_RE,
};
