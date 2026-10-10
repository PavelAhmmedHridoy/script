/**
 * connector/pull/run.js — walking a template back into the root.
 *
 * Three things to know before running it:
 *
 *   1. What comes back is the template's dialect, not the authoring dialect.
 *      A native file returns with `<View>` / `<Text>` / `onPress` and without
 *      the `useWeb` / `useApp` macros, because those were resolved at build
 *      time. Nothing can un-resolve that reliably: no table can tell a `Text`
 *      the author wrote from a `Text` the converter emitted.
 *   2. Only files that already have a root counterpart are written. Template
 *      scaffolding (the Expo template's own components, hooks, constants, a
 *      generated `main.tsx` or `app/_layout.tsx`) has no root file to restore,
 *      so it is counted as skipped rather than invented in `src/`. A root file
 *      you deleted cannot be pulled back — recreate it empty and pull again.
 *   3. Two route kinds are deliberately not byte-for-byte: the global
 *      stylesheet, whose stripped Tailwind directives are re-added, and the
 *      bundle configs, which are written back into the root bundle's entry for
 *      that target rather than over the whole file.
 */

const fs = require("fs");
const path = require("path");
const { copyFileIfChanged, writeIfChanged } = require("../../io");
const { PACKAGE_ROOT } = require("../../support/paths");
const { readBundle } = require("../[config]");
const { NOTES, walk, routeFor } = require("./routes");

/** Re-add the Tailwind directives the web pass strips, keeping the import on top. */
function restoreDirectives(content) {
  if (/@tailwind\s+(?:base|components|utilities)\b/.test(content)) return content;

  const lines = content.split("\n");
  let insertAt = 0;
  while (insertAt < lines.length && /^\s*@import\b/.test(lines[insertAt])) insertAt++;

  lines.splice(insertAt, 0, "@tailwind base;", "@tailwind components;", "@tailwind utilities;");
  return lines.join("\n");
}

/**
 * Write a template's bundle config back into the root bundle file.
 *
 * The root `package.json` / `tsconfig.json` hold one entry per target
 * (`react[]`, `expo[]`); the forward connector splits `expo[0]` out into
 * `template/expo/`. This is the inverse: the template's file becomes the
 * root's `<template>` entry, parsed through the same bundle format the forward
 * pass reads. Only that one key is rewritten — the sibling target's entry and
 * every other key in the shared file survive untouched.
 *
 * The bundle must already exist in root bundle form: when the root file has no
 * `<template>` key there is nothing to update in place, and overwriting the
 * whole file with a bare entry would destroy the other target's config. A
 * malformed template JSON is reported, not written.
 *
 * @param {string} from - the template's generated file (absolute)
 * @param {string} template - "react" | "expo"
 * @param {string} rootRel - root-relative path of the bundle ("package.json")
 * @param {string} packageRoot - Project root
 * @returns {boolean} true when the root bundle was actually rewritten
 */
function pullBundle(from, template, rootRel, packageRoot) {
  let entry;
  try {
    entry = JSON.parse(fs.readFileSync(from, "utf-8"));
  } catch (err) {
    console.error(`[pull/${template}] ${rootRel} is not valid JSON (${err.message}), skipping.`);
    return false;
  }

  const bundle = readBundle(rootRel, packageRoot);
  if (!bundle) {
    console.warn(
      `[pull/${template}] root ${rootRel} has no bundle format — nothing to write back into.`
    );
    return false;
  }

  const updated = { ...bundle, [template]: [entry] };
  return writeIfChanged(
    path.join(packageRoot, rootRel),
    `${JSON.stringify(updated, null, 2)}\n`
  );
}

/** Write a stylesheet back, re-adding directives, only when content changed. */
function pullStylesheet(from, to) {
  let content;
  try {
    content = fs.readFileSync(from, "utf-8");
  } catch (err) {
    console.error(`[pull] Failed to read ${from}: ${err.message}`);
    return false;
  }

  return writeIfChanged(to, restoreDirectives(content));
}

/**
 * Pull one template back into the root.
 *
 * @param {string} template - "react" | "expo"
 * @param {string} [packageRoot]
 * @returns {{pulled: number, identical: number, skipped: string[]}}
 *   `skipped` holds root paths that exist only in the template
 */
function pullTemplate(template, packageRoot = PACKAGE_ROOT) {
  const templateDir = path.join(packageRoot, "template", template);
  const skipped = [];
  let pulled = 0;
  let identical = 0;

  if (!fs.existsSync(templateDir)) {
    console.warn(`[pull/${template}] template/${template} not found, skipping.`);
    return { pulled, identical, skipped };
  }

  console.log(`[pull/${template}] template/${template} -> root — note: ${NOTES[template] ?? "verbatim copy"}.`);

  for (const file of walk(templateDir)) {
    const templateRel = path.relative(templateDir, file);
    const route = routeFor(template, templateRel);
    if (!route) continue;

    // An ambiguous route resolves to the root file the author already has.
    const rootRel =
      route.prefer && fs.existsSync(path.join(packageRoot, route.prefer))
        ? route.prefer
        : route.rootPath;

    const rootAbs = path.join(packageRoot, rootRel);

    // No counterpart means there is nothing to restore, and inventing one would
    // drag template scaffolding (or a generated entry) into src/.
    if (!fs.existsSync(rootAbs)) {
      skipped.push(rootRel);
      continue;
    }

    const wrote = route.bundle
      ? pullBundle(file, template, rootRel, packageRoot)
      : route.stylesheet
        ? pullStylesheet(file, rootAbs)
        : copyFileIfChanged(file, rootAbs);

    if (wrote) {
      pulled++;
      console.log(`[pull/${template}] template/${template}/${templateRel} -> ${rootRel}`);
    } else {
      identical++;
    }
  }

  console.log(
    `[pull/${template}] ${pulled} pulled, ${identical} already identical, ` +
      `${skipped.length} without a root counterpart.`
  );

  if (skipped.length > 0) {
    console.log(
      `[pull/${template}] skipped (create the root file first if you want it): ` +
        skipped.slice(0, 5).join(", ") +
        (skipped.length > 5 ? ` (+${skipped.length - 5})` : "")
    );
  }

  return { pulled, identical, skipped };
}

/**
 * Pull every requested template back into the root.
 *
 * @param {string[]} templates - template names, in order
 * @param {string} [packageRoot]
 */
function pullTemplates(templates, packageRoot = PACKAGE_ROOT) {
  const totals = { pulled: 0, identical: 0, skipped: 0 };

  for (const template of templates) {
    const result = pullTemplate(template, packageRoot);
    totals.pulled += result.pulled;
    totals.identical += result.identical;
    totals.skipped += result.skipped.length;
  }

  return totals;
}

module.exports = {
  pullTemplate,
  pullTemplates,
  restoreDirectives,
  pullBundle,
  pullStylesheet,
};
