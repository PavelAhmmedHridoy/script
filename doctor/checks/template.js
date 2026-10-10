/**
 * checks/template.js — the checks that run once per enabled template, in
 * order:
 *
 *   1. the package manager this template expects can actually run (first,
 *      because everything below depends on it)
 *   2. every bundle file was generated, and still matches its root entry
 *      (package.json, tsconfig.json)
 *   3. its declared dependencies are installed, at a satisfying version
 *   4. it typechecks
 *
 * Each entry is prefixed with the template name, so the report reads
 * `react: typecheck` rather than a bare label twice.
 */

const path = require("path");
const { effectivePackageManager, probePackageManager } = require("../package-manager");
const { checkBundleFiles } = require("./bundle-files");
const { checkDependencies } = require("./dependencies");
const { checkTypecheck } = require("./typecheck");
const { ok, fail } = require("../results");

/** `react: typecheck` */
const label = (template, name) => `${template}: ${name}`;

/** Re-label an entry produced by a shared check. */
const prefixed = (template, entry) => ({ ...entry, check: label(template, entry.check) });

/**
 * @param {{config: object, packageRoot: string, bundle: object}} context
 * @param {string} template - "react" | "expo"
 * @returns {Array} check entries for this template
 */
function checkTemplate({ config, packageRoot, bundle }, template) {
  const templateDir = path.join(packageRoot, "template", template);

  // The package manager has to be usable before anything below means much.
  const { pm, why } = effectivePackageManager(templateDir, config);
  const probe = probePackageManager(pm);

  const entries = [
    probe.ok
      ? ok(label(template, `package manager (${pm})`), `${probe.version} — from ${why}`)
      : fail(label(template, `package manager (${pm})`), probe.detail),
  ];

  const files = checkBundleFiles(packageRoot, template);
  entries.push(...files.entries.map((item) => prefixed(template, item)));

  // Without a package.json there is nothing to install or typecheck against.
  if (files.bail) return entries;

  const declared = bundle.entries[template]?.dependencies ?? {};
  entries.push(...checkDependencies(declared, templateDir).map((item) => prefixed(template, item)));
  entries.push(...checkTypecheck(template, templateDir).map((item) => prefixed(template, item)));

  return entries;
}

module.exports = { checkTemplate };
