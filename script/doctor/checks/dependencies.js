/**
 * checks/dependencies.js — check 3: every declared dependency is installed, at
 * a version inside its declared range.
 *
 * A missing package is what makes Metro fail with "Unable to resolve module"
 * long after this point; version drift is what Expo reports as a "common
 * problem" at startup.
 */

const fs = require("fs");
const path = require("path");
const { satisfies } = require("../ranges");
const { ok, warn, fail } = require("../results");

/** How many names to print before collapsing the rest into "(+n)". */
const MAX_LISTED = 6;

/**
 * Read a package's installed version from a template's node_modules.
 *
 * @param {string} templateDir
 * @param {string} pkg
 * @returns {string|null}
 */
function installedVersion(templateDir, pkg) {
  const manifest = path.join(templateDir, "node_modules", pkg, "package.json");
  try {
    return JSON.parse(fs.readFileSync(manifest, "utf-8")).version ?? null;
  } catch {
    return null;
  }
}

/** `a, b, c (+4)` — keep the detail line readable. */
function summariseNames(names) {
  const listed = names.slice(0, MAX_LISTED).join(", ");
  return names.length > MAX_LISTED ? `${listed} (+${names.length - MAX_LISTED})` : listed;
}

/**
 * @param {object} declared - the bundle entry's dependencies
 * @param {string} templateDir
 * @returns {Array} entries for installed / version drift
 */
function checkDependencies(declared, templateDir) {
  const missing = [];
  const skewed = [];

  for (const [pkg, range] of Object.entries(declared)) {
    const installed = installedVersion(templateDir, pkg);
    if (!installed) missing.push(pkg);
    else if (!satisfies(range, installed)) skewed.push(`${pkg} ${range} (installed ${installed})`);
  }

  const entries = [
    missing.length > 0
      ? fail("installed", `not installed: ${summariseNames(missing)}`)
      : ok("installed", `${Object.keys(declared).length} dependencies present`),
  ];

  if (skewed.length > 0) entries.push(warn("version drift", summariseNames(skewed)));

  return entries;
}

module.exports = { checkDependencies, installedVersion };
