/**
 * converter/direction.js — which way a target converts, from `source`.
 *
 * `rexpo.config.js` declares two orthogonal things:
 *
 *   source   the dialect `src/` is authored in — `react` (`<div>`, `onClick`)
 *            or `expo` (strict React Native primitives — `<View>`, `onPress`)
 *   deploy   the templates to generate — `react` (`template/react`) and
 *            `expo` (`template/expo`)
 *
 * A target only needs a dialect transform when the two disagree:
 *
 *   source.react + deploy.expo    -> react to expo   (the React Native pass)
 *   source.expo  + deploy.react   -> expo to react   (the web pass)
 *   same dialect on both sides    -> no dialect pass at all
 *
 * Every connector used to decide this from the template alone
 * (`applyRNTransform = template === "expo"`), which made the expo -> react
 * direction accidental: the web target only ran its pass when the converter's
 * content heuristic happened to spot a quoted `react-native` / `expo-router`
 * specifier, so a native-authored file without one reached `template/react`
 * untransformed. The flags in the config are the source of truth, so the
 * decision lives here and the connectors hand the result to `convertFile`.
 *
 * `source` with both flags set (or neither) is ambiguous: the caller gets the
 * historical behaviour — the native target converts, the web target falls back
 * to the converter's per-file heuristic — rather than a guess.
 */

/**
 * The authoring dialect `source` declares, or null when it declares none.
 *
 * @param {object} [source] - rexpo.config.js's `source` block
 * @returns {"react"|"expo"|null}
 */
function sourceDialect(source) {
  if (!source || typeof source !== "object") return null;

  const react = source.react === true;
  const expo = source.expo === true;

  // Neither set, or both: no single dialect to convert from.
  if (react === expo) return null;
  return expo ? "expo" : "react";
}

/**
 * The `convertFile` / `transform` options for one target.
 *
 * `platform` is the *target's*, never the source's: the platform macros
 * (`useWeb` / `useApp`) have to resolve against the template being written,
 * including when no dialect pass runs — an expo-authored file still keeps its
 * `useApp` blocks in the native output.
 *
 * @param {object} [source] - rexpo.config.js's `source` block
 * @param {"react"|"expo"} template - the template being generated
 * @returns {{platform:"web"|"native", applyRNTransform:boolean,
 *   useWebTransform?:boolean}}
 */
function directionOptions(source, template) {
  const nativeTarget = template === "expo";
  const options = { platform: nativeTarget ? "native" : "web" };

  const dialect = sourceDialect(source);
  if (dialect === null) {
    // Undeclared or ambiguous source mode: convert on the native target as
    // before, and leave the web target's content heuristic in charge (omitted
    // `useWebTransform`, not `false`).
    options.applyRNTransform = nativeTarget;
    return options;
  }

  const converts = nativeTarget ? dialect === "react" : dialect === "expo";

  options.applyRNTransform = nativeTarget && converts;
  // Explicit on the web target, so `false` switches the content heuristic off
  // as well: a react-authored file must not be re-tagged on its way to web.
  options.useWebTransform = !nativeTarget && converts;
  return options;
}

module.exports = { directionOptions, sourceDialect };
