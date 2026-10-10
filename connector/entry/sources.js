/**
 * connector/entry/sources.js — what the author's tree contains.
 *
 * The generated entry is only worth writing if it knows which of the author's
 * files exist: whether src/@app and src/@layout are there decides whether the
 * mount is wrapped and which extension to import, and the pages folder is what
 * turns the web entry into a real router.
 */

const fs = require("fs");
const path = require("path");

/** Extensions checked, in order, when looking for the author's source files. */
const SOURCE_EXTENSIONS = ["tsx", "jsx", "ts", "js"];

/**
 * The author's entry files, if present. Controls which wrapper is generated.
 * @returns {{app: string|null, layout: string|null}}
 */
function detectSources(packageRoot) {
  const srcDir = path.join(packageRoot, "src");
  const found = { app: null, layout: null };

  for (const key of Object.keys(found)) {
    for (const ext of SOURCE_EXTENSIONS) {
      if (fs.existsSync(path.join(srcDir, `@${key}.${ext}`))) {
        found[key] = ext;
        break;
      }
    }
  }

  return found;
}

/**
 * Web route entries from src/@pages — the web mirror of expo-router's file
 * routes. `@pages/index.tsx` -> path "/", `@pages/about.tsx` -> "/about",
 * `@pages/[id].tsx` -> "/:id". Files with no page component are skipped.
 *
 * @param {string} packageRoot
 * @returns {Array<{routePath: string, importPath: string}>}
 */
function detectWebPages(packageRoot) {
  const pagesDir = path.join(packageRoot, "src", "@pages");
  if (!fs.existsSync(pagesDir)) return [];

  const pages = [];
  for (const entry of fs.readdirSync(pagesDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).slice(1); // "tsx"
    if (!SOURCE_EXTENSIONS.includes(ext)) continue;

    const base = entry.name.slice(0, -(ext.length + 1));
    const routePath =
      base === "index" ? "/" : base.startsWith("[") ? `/:${base.replace(/\[|\]/g, "")}` : `/${base}`;
    pages.push({ routePath, importPath: `./pages/${base}` });
  }

  pages.sort((a, b) => a.routePath.localeCompare(b.routePath));
  return pages;
}

/** Component name for a generated route import: ./pages/about -> AboutPage. */
function routeName(page) {
  const slug = page.importPath.split("/").pop() || "Page";
  const name = slug.replace(/[^\w]/g, "");
  return `${name.charAt(0).toUpperCase()}${name.slice(1)}Page`;
}

module.exports = { SOURCE_EXTENSIONS, detectSources, detectWebPages, routeName };
