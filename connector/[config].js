/**
 * [config].js — connector for build/tooling config.
 *
 * Two kinds of config live in the authoring root and are handled differently:
 *
 * 1. Bundled configs. `package.json` and `tsconfig.json` hold one entry per
 *    target under a `react` / `expo` key, and are split rather than copied:
 *
 *      { "react": [{ ...web config... }], "expo": [{ ...native config... }] }
 *        -> template/react/package.json  = react[0]
 *        -> template/expo/package.json   = expo[0]
 *
 * 2. Plain configs, copied verbatim into the template that owns them. Only
 *    files a template can actually use are mapped — a tailwind.config.js with
 *    the NativeWind preset is meaningless to the web template, which is on
 *    Tailwind v4's CSS-first setup.
 *
 * The work is split across connector/config/, one concern per file, and the
 * public surface stays here (doctor and the dependency pass both read it):
 *
 *   config/bundle.js  reading and serializing a bundle entry — the source of
 *                     truth doctor compares generated files against
 *   config/plain.js   the per-template copy table
 *   config/sync.js    writing configs out, and the per-target sweep
 *   config/special.js the user's specialFiles: per-target includes (`.env`,
 *                     `.env.local`, renamed copies) and excludes that
 *                     subtract files the plain table would have copied
 */

const {
  TARGETS,
  BUNDLES,
  readBundle,
  readTargetConfig,
  targetConfigName,
  targetConfigPath,
  bundleEntryJson,
} = require("./config/bundle");
const { MAPPINGS } = require("./config/plain");
const {
  syncSpecialFiles,
  includesFor,
  excludesFor,
  isExcluded,
  DOT_ENV_DEFAULTS,
} = require("./config/special");
const { sync, writeBundleEntry } = require("./config/sync");

module.exports = {
  sync,
  readBundle,
  readTargetConfig,
  targetConfigName,
  targetConfigPath,
  writeBundleEntry,
  bundleEntryJson,
  syncSpecialFiles,
  includesFor,
  excludesFor,
  isExcluded,
  DOT_ENV_DEFAULTS,
  BUNDLES,
  MAPPINGS,
  TARGETS,
};
