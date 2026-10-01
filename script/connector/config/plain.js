/**
 * connector/config/plain.js — config files copied verbatim into a template.
 *
 * The second half of the config connector: files that belong to exactly one
 * template and mean nothing in the other. Only files a template can actually
 * use are mapped — a tailwind.config.js with the NativeWind preset is
 * meaningless to the web template, which is on Tailwind v4's CSS-first setup,
 * and index.html has no meaning on native.
 *
 * These are copies, not converts, so `writeIfChanged` is what keeps a rebuild
 * from being triggered by a sync that changed nothing.
 */

const fs = require("fs");
const path = require("path");
const { copyFileIfChanged } = require("../../io");

/** Plain config files, per template. */
const MAPPINGS = {
  react: [
    { from: "index.html", to: "template/react/index.html" },
    { from: "vite.config.ts", to: "template/react/vite.config.ts" },
    { from: "eslint.config.js", to: "template/react/eslint.config.js" },
    { from: "tsconfig.app.json", to: "template/react/tsconfig.app.json" },
    { from: "tsconfig.node.json", to: "template/react/tsconfig.node.json" },
  ],
  expo: [
    { from: "app.json", to: "template/expo/app.json" },
    { from: "babel.config.js", to: "template/expo/babel.config.js" },
    { from: "metro.config.js", to: "template/expo/metro.config.js" },
    { from: "tailwind.config.js", to: "template/expo/tailwind.config.js" },
    { from: "nativewind-env.d.ts", to: "template/expo/nativewind-env.d.ts" },
    { from: "eslint.config.js", to: "template/expo/eslint.config.js" },
  ],
};

/** Copy a plain config file into its template. */
function copyFile(packageRoot, mapping) {
  const src = path.join(packageRoot, mapping.from);
  const dest = path.join(packageRoot, mapping.to);

  if (!fs.existsSync(src)) {
    console.warn(`[connector/config] Source not found: ${mapping.from}`);
    return;
  }

  if (copyFileIfChanged(src, dest)) {
    console.log(`[connector/config] ${mapping.from} -> ${mapping.to}`);
  }
}

module.exports = { MAPPINGS, copyFile };
