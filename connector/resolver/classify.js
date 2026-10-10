/**
 * connector/resolver/classify.js — source path classification.
 *
 * Determines whether a source path is:
 *   - A reserved semantic path (@app.tsx, @layout.tsx, @pages/...)
 *   - An ordinary @folder path (@components/..., @hooks/..., @anything/...)
 *   - A non-@ path (global.css, assets/...)
 *
 * Only these are reserved:
 *   - @app.tsx       -> root app component
 *   - @layout.tsx    -> root layout shell
 *   - @pages/        -> page routes
 *
 * Everything else beginning with @ is an ordinary dynamic folder.
 * There is NO common folder registry. Any @segment is dynamically treated
 * as an ordinary folder.
 */

const path = require("path");

/** Reserved semantic @-segments (the only ones with special meaning). */
const RESERVED_SEMANTIC_SEGMENTS = new Set(["app", "layout", "pages"]);

/**
 * Classify a source file path relative to src/.
 */
function classifySourcePath(relativePath) {
  const normalized = relativePath.split(path.sep).join("/");
  const segments = normalized.split("/");

  if (segments.length === 0 || segments[0] === "") {
    return {
      type: "ordinary",
      segments: [],
      isSemantic: false,
      semanticKind: null,
      folderPath: null,
    };
  }

  const firstSegment = segments[0];

  if (firstSegment.startsWith("@")) {
    // Get the segment name without the @ and without extension
    const segmentWithExt = firstSegment.slice(1); // e.g., "app.tsx" or "components"
    const segmentName = segmentWithExt.split(".")[0]; // e.g., "app" or "components"

    if (RESERVED_SEMANTIC_SEGMENTS.has(segmentName)) {
      if (segments.length === 1) {
        // It's a file: @app.tsx or @layout.tsx
        return {
          type: `semantic-${segmentName}`,
          segments,
          isSemantic: true,
          semanticKind: segmentName,
          folderPath: null,
        };
      } else if (segmentName === "pages") {
        // It's @pages/... — semantic page routes
        return {
          type: "semantic-pages",
          segments,
          isSemantic: true,
          semanticKind: "pages",
          folderPath: null,
        };
      }
      // @app/ or @layout/ as folders are not semantic — treat as dynamic
    }

    // Dynamic @folder
    return {
      type: "dynamic-folder",
      segments,
      isSemantic: false,
      semanticKind: null,
      folderPath: resolveDynamicFolderPath(segments),
    };
  }

  return {
    type: "ordinary",
    segments,
    isSemantic: false,
    semanticKind: null,
    folderPath: null,
  };
}

/**
 * Resolve a dynamic @folder path to its ordinary folder equivalent.
 */
function resolveDynamicFolderPath(segments) {
  return segments
    .map((seg) => (seg.startsWith("@") ? seg.slice(1) : seg))
    .join("/");
}

function isSemanticPath(relativePath) {
  return classifySourcePath(relativePath).isSemantic;
}

function semanticKindOf(relativePath) {
  return classifySourcePath(relativePath).semanticKind;
}

function isDynamicFolderPath(relativePath) {
  return classifySourcePath(relativePath).type === "dynamic-folder";
}

function dynamicFolderName(relativePath) {
  const classification = classifySourcePath(relativePath);
  if (classification.type !== "dynamic-folder") return null;
  const firstSegment = classification.segments[0];
  return firstSegment.startsWith("@") ? firstSegment.slice(1) : null;
}

function resolvedDynamicPath(relativePath) {
  const classification = classifySourcePath(relativePath);
  if (classification.type !== "dynamic-folder") return null;
  return classification.folderPath;
}

module.exports = {
  classifySourcePath,
  isSemanticPath,
  semanticKindOf,
  isDynamicFolderPath,
  dynamicFolderName,
  resolvedDynamicPath,
  resolveDynamicFolderPath,
  RESERVED_SEMANTIC_SEGMENTS,
};
