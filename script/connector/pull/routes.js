/**
 * connector/pull/routes.js — the inverse route table.
 *
 * Every forward connector builds a template path from a root path; pulling
 * needs the opposite, so the routes are written out by hand instead of
 * inverting those builders generically — that is guesswork, and a wrong guess
 * here overwrites authored source.
 *
 * Route fields:
 *   dir/file    where in the template to look
 *   match       optional file-name filter within that directory
 *   ignore      file is generated, never pulled (expo-router's layout)
 *   to          root path for a matched file
 *   prefer      root path that wins when it already exists (the expo template's
 *               `app/foo.tsx` can equally come from `src/@app/foo.tsx` or
 *               `src/@pages/foo.tsx`)
 *   stylesheet  re-add stripped Tailwind directives (see pull/run.js)
 *   bundle      file is a per-target config: write it back into the root
 *               bundle's entry, not verbatim (see pull/run.js)
 */

const fs = require("fs");
const path = require("path");

/** template-relative -> root-relative route table. */
const ROUTES = {
  react: [
    { dir: "src", match: /^App\.(tsx|ts|jsx|js)$/, to: (rel, match) => `src/@app.${match[1]}` },
    { dir: "src", match: /^@layout\.(tsx|ts|jsx|js)$/, to: (rel, match) => `src/@layout.${match[1]}` },
    { dir: "src", match: /^global\.css$/, to: () => "src/global.css", stylesheet: true },
    { dir: "src/pages", to: (rel) => `src/@pages/${rel}` },
    { dir: "src/components", to: (rel) => `src/@components/${rel}` },
    { dir: "src/hooks", to: (rel) => `src/@hooks/${rel}` },
    { dir: "src/lib", to: (rel) => `src/@lib/${rel}` },
    { dir: "src/utils", to: (rel) => `src/@utils/${rel}` },
    { dir: "src/styles", to: (rel) => `src/@styles/${rel}` },
    { dir: "assets", to: (rel) => `assets/${rel}` },
  ],
  expo: [
    { dir: "app", match: /^_layout\.(tsx|ts|jsx|js)$/, ignore: true },
    { dir: "app", match: /^index\.(tsx|ts|jsx|js)$/, to: (rel, match) => `src/@app.${match[1]}` },
    { dir: "app", to: (rel) => `src/@pages/${rel}`, prefer: (rel) => `src/@app/${rel}` },
    { dir: "components", match: /^root-layout\.tsx$/, to: () => "src/@layout.tsx" },
    { dir: "components", to: (rel) => `src/@components/${rel}` },
    { dir: "lib", to: (rel) => `src/@lib/${rel}` },
    { dir: "hooks", to: (rel) => `src/@hooks/${rel}` },
    { dir: "utils", to: (rel) => `src/@utils/${rel}` },
    { dir: "styles", to: (rel) => `src/@styles/${rel}` },
    { file: "global.css", to: () => "src/global.css", stylesheet: true },
    { dir: "assets", to: (rel) => `assets/${rel}` },
    { file: "package.json", bundle: true },
    { file: "tsconfig.json", bundle: true },
  ],
};

/** Printed once per template, because both directions are lossy in their own way. */
const NOTES = {
  react: "the web output is already converted and global.css is normalised",
  expo: "the native output is the generated dialect (RN components, no macros)",
};

/** Yield every file under `dir`, recursively. */
function walk(dir, files = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return files;
  }

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else files.push(full);
  }

  return files;
}

/**
 * Where a template file maps back to in the root, if anywhere.
 *
 * @param {string} template - "react" | "expo"
 * @param {string} templateRel - path relative to template/<template>
 * @returns {{rootPath: string, prefer?: string|null, stylesheet?: boolean}|null}
 *   null for files no route claims (template scaffolding, generated entries)
 */
function routeFor(template, templateRel) {
  const posix = templateRel.split(path.sep).join("/");

  for (const route of ROUTES[template] ?? []) {
    if (route.file) {
      if (posix !== route.file) continue;
      return {
        rootPath: route.to ? route.to(posix) : posix,
        stylesheet: route.stylesheet,
        bundle: route.bundle,
      };
    }

    if (posix !== route.dir && !posix.startsWith(`${route.dir}/`)) continue;

    const rel = posix === route.dir ? "" : posix.slice(route.dir.length + 1);
    const match = route.match ? route.match.exec(rel) : null;
    if (route.match && !match) continue;
    if (route.ignore) return null;

    return {
      rootPath: route.to(rel, match),
      prefer: route.prefer ? route.prefer(rel) : null,
      stylesheet: route.stylesheet,
    };
  }

  return null;
}

module.exports = { ROUTES, NOTES, walk, routeFor };
