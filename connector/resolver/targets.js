/**
 * connector/resolver/targets.js — source path to React/Expo target resolution.
 *
 * This is the authoritative path resolver. Every subsystem must use this
 * instead of creating their own folder mapping logic.
 */

const path = require("path");
const { targetRoot, targetRootPath, destDepth } = require("./roots");
const {
  classifySourcePath,
  isDynamicFolderPath,
  resolvedDynamicPath,
} = require("./classify");

/**
 * Get the target path for a source file, for a specific template.
 */
function getTargetPath(relativePath, template, packageRoot) {
  const classification = classifySourcePath(relativePath);

  switch (classification.type) {
    case "semantic-app":
      return getAppTargetPath(template);
    case "semantic-layout":
      return getLayoutTargetPath(template);
    case "semantic-pages":
      return getPagesTargetPath(relativePath, template);
    case "dynamic-folder":
      return getDynamicFolderTargetPath(relativePath, template);
    case "ordinary":
      return getOrdinaryTargetPath(relativePath, template);
    default:
      return null;
  }
}

function getAppTargetPath(template) {
  if (template === "react") {
    return path.join(targetRoot(template), "App.tsx");
  }
  return path.join(targetRoot(template), "app", "index.tsx");
}

function getLayoutTargetPath(template) {
  if (template === "react") {
    return path.join(targetRoot(template), "@layout.tsx");
  }
  return path.join(targetRoot(template), "components", "root-layout.tsx");
}

function getPagesTargetPath(relativePath, template) {
  const segments = relativePath.split("/");
  const fileSegments = segments.slice(1);
  let relativeFile = fileSegments.join("/");

  if (template === "react") {
    return path.join(targetRoot(template), relativeFile);
  }

  // Expo router: if the page tree includes a layout file named
  // `layout.<ext>` it should become `app/<subpath>/_layout.<ext>`.
  relativeFile = relativeFile.replace(
    /\/?layout\.(tsx|ts|jsx|js)$/i,
    (m, ext) => `/_layout.${ext}`
  );

  return path.join(targetRoot(template), "app", relativeFile);
}

function getDynamicFolderTargetPath(relativePath, template) {
  const resolved = resolvedDynamicPath(relativePath);
  if (!resolved) return null;
  return path.join(targetRoot(template), resolved);
}

function getOrdinaryTargetPath(relativePath, template) {
  if (relativePath.startsWith("assets/") || relativePath === "assets") {
    return path.join(targetRoot(template), "assets", relativePath.replace(/^assets\//, ""));
  }
  if (relativePath === "global.css") {
    return path.join(targetRoot(template), "global.css");
  }
  return path.join(targetRoot(template), relativePath);
}

/**
 * Get the source path that corresponds to a target path (for pull direction).
 */
function getSourcePathFromTarget(templateRel, template) {
  const posix = templateRel.split(path.sep).join("/");
  const root = targetRoot(template);

  if (posix === root || !posix.startsWith(root + "/")) {
    return null;
  }

  const underRoot = posix.slice(root.length + 1);

  if (template === "react") {
    if (underRoot === "App.tsx") return "src/@app.tsx";
    if (underRoot === "@layout.tsx") return "src/@layout.tsx";
    if (underRoot.startsWith("pages/")) {
      return `src/@pages/${underRoot.slice(6)}`;
    }
    if (!underRoot.startsWith("app/") && !underRoot.startsWith("components/") && !underRoot.startsWith("assets/") && underRoot !== "App.tsx" && underRoot !== "@layout.tsx" && underRoot !== "main.tsx" && underRoot !== "global.css") {
      return `src/@pages/${underRoot}`;
    }
  } else {
    if (underRoot === "app/index.tsx") return "src/@app.tsx";
    if (underRoot === "components/root-layout.tsx") return "src/@layout.tsx";
    if (underRoot.startsWith("app/") && underRoot !== "app/_layout.tsx") {
      return `src/@pages/${underRoot.slice(4)}`;
    }
  }

  // Dynamic folder: add @ to first segment
  const segments = underRoot.split("/");
  if (segments.length > 0) {
    segments[0] = "@" + segments[0];
    return `src/${segments.join("/")}`;
  }

  return null;
}

function isGeneratedPath(templateRel, template) {
  const posix = templateRel.split(path.sep).join("/");
  if (template === "expo" && posix === "app/_layout.tsx") return true;
  if (template === "react" && posix === "src/main.tsx") return true;
  return false;
}

module.exports = {
  getTargetPath,
  getSourcePathFromTarget,
  isGeneratedPath,
  getAppTargetPath,
  getLayoutTargetPath,
  getPagesTargetPath,
  getDynamicFolderTargetPath,
  getOrdinaryTargetPath,
};
