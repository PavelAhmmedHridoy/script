/**
 * connector/entry/templates.js — the two generated bootstrap files.
 *
 * Nothing in an app should have to import main.tsx, and the expo layout is
 * expo-router's own convention, so neither is a route connector: this runs on
 * every full sync (before the servers start) and has no getTargetPath.
 *
 *   react -> template/react/src/main.tsx      mounts <Layout><App /></Layout>
 *   expo  -> template/expo/app/_layout.tsx    expo-router <Slot /> inside the
 *                                            author's layout component
 *
 * Why the expo layout is a wrapper rather than the author's file copied over
 * app/_layout.tsx: expo-router renders a `<Stack />`/`<Slot />` there and
 * passes no children, so a layout that only renders `{children}` shows a blank
 * screen. The author's component is synced to template/expo/components/
 * root-layout.tsx by [layout].js and wrapped around <Slot /> here, which keeps
 * both the shell and the router.
 */

const path = require("path");
const { writeIfChanged } = require("../../io");
const { detectSources, detectWebPages, routeName } = require("./sources");

/**
 * template/react/src/main.tsx.
 *
 * With src/@pages present, the author's pages become web Routes (wrapped in
 * the author's Layout when one exists) and App.tsx is the index route —
 * exactly the routing the expo target derives from the same folders. Without
 * pages, the entry is the plain single-screen mount it has always been.
 *
 * @param {{app: string|null, layout: string|null}} sources
 * @param {Array<{routePath: string, importPath: string}>} pages
 */
function reactEntry(sources, pages = []) {
  const appExt = sources.app || "tsx";
  const layoutExt = sources.layout || "tsx";

  const imports = [
    `import { StrictMode } from "react";`,
    `import { createRoot } from "react-dom/client";`,
    "",
    `import App from "./App.${appExt}";`,
  ];

  // The router is only mounted when the author has pages; importing it for a
  // single-screen app leaves every symbol unused and fails noUnusedLocals.
  if (pages.length > 0) {
    imports.splice(2, 0, `import { BrowserRouter, Routes, Route } from "react-router-dom";`);
  }

  // [layout].js writes the author's layout next to App.tsx for the web target.
  if (sources.layout) {
    imports.push(`import Layout from "./@layout.${layoutExt}";`);
  }

  // ./index.css is the template's Tailwind v4 entry; ./global.css is the
  // author's, and must come second so their rules win.
  imports.push(`import "./index.css";`, `import "./global.css";`);

  for (const page of pages) {
    imports.push(`import ${routeName(page)} from "${page.importPath}";`);
  }

  if (pages.length === 0) {
    const tree = sources.layout
      ? "    <Layout>\n      <App />\n    </Layout>\n"
      : "    <App />\n";

    return `${imports.join("\n")}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
${tree}  </StrictMode>
);
`;
  }

  const routes = pages
    .map((page) => `        <Route path="${page.routePath}" element={<${routeName(page)} />} />`)
    .join("\n");

  const layoutOpen = sources.layout ? "    <Layout>\n" : "";
  const layoutClose = sources.layout ? "    </Layout>\n" : "";

  return `${imports.join("\n")}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
${layoutOpen}      <Routes>
        {/* The author's home screen (src/@app) is the index route. */}
        <Route path="/" element={<App />} />
${routes}
      </Routes>
${layoutClose}    </BrowserRouter>
  </StrictMode>
);
`;
}

/**
 * template/expo/app/_layout.tsx — expo-router's root route.
 * @param {{app: string|null, layout: string|null}} sources
 */
function expoLayout(sources) {
  // Metro's NativeWind input is ./global.css relative to the app root, and
  // expo-router needs it imported from the root layout.
  const header = `import "../global.css";\nimport { Slot } from "expo-router";\n`;

  if (!sources.layout) {
    return `${header}
export default function Layout() {
  return <Slot />;
}
`;
  }

  return `${header}import RootLayout from "../components/root-layout";

export default function Layout() {
  return (
    <RootLayout>
      <Slot />
    </RootLayout>
  );
}
`;
}

/** Write a generated entry file, only when its content changed. */
function writeEntry(targetPath, content, packageRoot) {
  const dest = path.join(packageRoot, targetPath);

  try {
    if (!writeIfChanged(dest, content)) return;
    console.log(`[connector/entry] generated ${targetPath}`);
  } catch (err) {
    console.error(`[connector/entry] Failed to write ${targetPath}: ${err.message}`);
  }
}

/**
 * Generate the entry point(s) for every enabled template.
 * @param {object} config - rexpo.config.js
 * @param {string} packageRoot - Project root
 */
function sync(config, packageRoot) {
  const sources = detectSources(packageRoot);
  const pages = detectWebPages(packageRoot);

  if (config.deploy?.react) {
    writeEntry("template/react/src/main.tsx", reactEntry(sources, pages), packageRoot);
  }
  if (config.deploy?.expo) {
    // The expo root layout wraps the author's layout, so it is only useful
    // once [layout].js has written that component.
    writeEntry("template/expo/app/_layout.tsx", expoLayout(sources), packageRoot);
  }
}

module.exports = { reactEntry, expoLayout, writeEntry, sync };
