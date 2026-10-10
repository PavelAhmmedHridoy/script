/**
 * script/authoring/platform.ts — authoring-time platform macros.
 *
 * `useWeb` and `useApp` are BUILD-TIME macros, not runtime functions. They are
 * resolved by script/converter/platform-blocks.js while a source file is synced
 * into each template:
 *
 *   useWeb(() => { ... })   kept on web,   removed from the native output
 *   useApp(() => { ... })   kept on native, removed from the web output
 *
 * This module is never imported by anything that ships. The converter lifts the
 * import back out of every file it processes, so it cannot leak into a
 * template's dependencies, Metro's module graph, or a production bundle. It
 * exists purely so the editor and `tsc` can resolve and type the calls while you
 * author in `src/`.
 *
 * `classWeb(className)` and `classApp(className)` are the same idea for class
 * names, because the two dialects are not the same Tailwind:
 *
 *                          web output      native output
 *   classWeb("hover:x")    appended at     ""
 *                          the end of
 *                          className
 *   classApp("min-h-11")   ""              appended at the
 *                                          end of className
 *
 * Put a utility in `classWeb` when only a browser can honour it (`hover:`,
 * `cursor-pointer`, `transition-*`, `md:*`, `font-mono`, `min-h-screen`), and
 * in `classApp` when only a device can (a minimum touch target, a native-only
 * utility, a name the native dialect still spells the old way). On the kept
 * platform the class is compiled to the END of the enclosing className —
 * `className={`panel ${classWeb("hover:x")}`}` becomes
 * `className={`panel hover:x`}` — and the other platform receives no class at
 * all, so it never reaches a stylesheet that could not apply it.
 *
 * ## Usage
 *
 * ```tsx
 * import { useWeb, useApp, classWeb, classApp } from "../../script/authoring/platform";
 * // or, with the `script/*` path mapping in tsconfig.app.json:
 * import { useWeb, useApp, classWeb, classApp } from "script/authoring/platform";
 *
 * export default function Counter() {
 *   const [n, setN] = useState(0);
 *
 *   // Statement form: the body runs only on web, and is deleted from native.
 *   useWeb(() => {
 *     document.title = `Count ${n}`;
 *   });
 *
 *   // Expression form: substituted inline, or replaced with `null`.
 *   return (
 *     <div>
 *       {useWeb(() => <a href="/todos">Open the web backlog</a>)}
 *       {useApp(() => <Haptic />)}
 *     </div>
 *   );
 * }
 * ```
 *
 * ## Keeping a block
 *
 * A block-bodied callback becomes an immediately-invoked function so its scope
 * and `return` stay the callback's:
 *
 *   useWeb(() => { document.title = "x" })  ->  (() => { document.title = "x" })()
 *
 * An expression-bodied callback is inlined, which keeps the JSX form clean:
 *
 *   useWeb(() => <a href="/x">x</a>)        ->  (<a href="/x">x</a>)
 *
 * ## Removing a block
 *
 * The whole statement goes when the call is a statement, and `null` fills in
 * when it is used as an expression — which is what a JSX child needs.
 *
 * ```tsx
 * // Classes compose like any other string, so both forms mix with the tokens
 * // in @lib/format:
 * <div className={`${ui.panel} ${classWeb("hover:border-slate-700")}`} />
 * ```
 *
 * ## Platform-scoped imports
 *
 * An `import` declaration can't be wrapped in `useWeb`/`useApp` — imports are
 * hoisted, static declarations, not expressions, so nesting one inside a
 * callback is not valid JS/TS at all. Scope one to a platform with a trailing
 * directive comment instead:
 *
 * ```tsx
 * import RexpoLogoWeb from "./rexpo-logo.svg";        // useWeb
 * import RexpoLogoNative from "./rexpo-logo-native";  // useApp
 *
 * const RexpoLogo = useWeb(() => RexpoLogoWeb) ?? useApp(() => RexpoLogoNative);
 * ```
 *
 * The converter deletes the whole statement — comment included — on the
 * platform that doesn't keep it, before that platform's bundler or the
 * dependency scanner ever sees the specifier, so neither target is asked to
 * resolve a module that only exists for the other one.
 *
 * The two imports can share a local name in the *generated* file, since only
 * one survives per target — but not while authoring, when both lines are
 * live in the same file at once and a shared name is a real duplicate
 * declaration. Give them different names, as above, and resolve the single
 * binding you actually use with the ordinary expression form.
 *
 * ## The brace form: imports, exports, more than one statement
 *
 * The comment directive scopes exactly one `import`. When a platform needs
 * *several* statements together — more than one import, or an import plus
 * the `export` that uses it — write a brace block instead of a callback:
 *
 * ```tsx
 * useWeb {
 *   import Logo from "./logo.web";
 *   export const AppLogo = Logo;
 * }
 * useApp {
 *   import Logo from "./logo.native";
 *   export const AppLogo = Logo;
 * }
 * ```
 *
 * `useWeb{ A }:useApp{ B }` — either order — is one construct: the kept
 * half's body is spliced in exactly as written, with no wrapping function,
 * which is what lets it hold `import` / `export` declarations and not just
 * expressions or plain statements. The whole other half disappears before
 * either target's bundler or the dependency scanner ever sees it — same
 * guarantee as the comment-directive form, just for a whole group of
 * statements at once.
 *
 * Because each half only ever ships to one target, `Logo` above can be the
 * same local name in both blocks even though it comes from a different path
 * in each — unlike the comment-directive form, the two bodies are never both
 * live in the same top-level scope at once.
 *
 * This also covers exporting a platform-specific component under one shared
 * name ("the same tag either way"):
 *
 * ```tsx
 * useWeb {
 *   import { Logo } from "./logo.web";
 *   export function AppLogo() {
 *     return <img src={Logo} alt="" />;
 *   }
 * }
 * useApp {
 *   import { Logo } from "./logo.native";
 *   export function AppLogo() {
 *     return <Image source={Logo} />;
 *   }
 * }
 * ```
 *
 * A lone block (`useWeb{ A }` with no `:useApp{ B }` half) that doesn't
 * belong to the platform being generated is dropped whole, same as a lone
 * `useApp(() => { ... })` statement.
 *
 * The brace form is a statement, not a value — write it at the top level of
 * the file, the same place a real `import`/`export` would go. It isn't valid
 * to drop it inside JSX or wherever an expression is expected; the callback
 * form covers that instead. Because `import`/`export` are themselves only
 * valid at a module's top level, an editor's live TypeScript checking will
 * flag the statements inside the brace body while you're authoring — that's
 * expected and doesn't affect the sync: `rexpo doctor`'s typecheck runs
 * against the generated templates, after the macro is fully resolved, not
 * against `src/`.
 *
 * ## Constraints
 *
 * - The block argument must be a plain function. A call the converter cannot
 *   parse as a callback is left untouched and reported, so the build fails at a
 *   real unresolved identifier instead of silently dropping code.
 * - The class argument must be a single string literal for the className
 *   append to fire; an expression argument substitutes in place, which stays
 *   valid wherever a string is. Inside a className template literal the
 *   compiled class always lands at the end of the class list.
 * - A platform-scoped import's directive comment has to sit on the import
 *   statement's own line, trailing everything else on it.
 */

/**
 * The signature is `(fn: () => T) => T` so that both forms type-check: the
 * statement form, where `fn` returns `void`, and the expression form, where it
 * returns JSX or any other value.
 *
 * The class macros are typed `(className: string) => string` for the same
 * reason: the call has to read like a plain string helper while authoring, even
 * though the converter replaces the call itself.
 */

function notTransformed(macro: string): never {
  throw new Error(
    `[rexpo] ${macro}() reached runtime. It is a build-time macro and should have ` +
      `been removed while syncing — reaching this means the file was not processed. ` +
      `Check that it lives in a scanned folder (deps.scanDirs in rexpo.config.js) ` +
      `and that the rexpo sync ran before the build.`
  );
}

export function useWeb<T>(fn: () => T): T {
  void fn;
  return notTransformed("useWeb");
}

export function useApp<T>(fn: () => T): T {
  void fn;
  return notTransformed("useApp");
}

/**
 * A class name only the web target keeps.
 *
 * Use it for utilities the browser implements and React Native does not —
 * `hover:*`, `cursor-pointer`, `transition-*`, `md:*` breakpoints, `font-mono`
 * (a CSS font stack is not an RN `fontFamily`), `min-h-screen`. On native the
 * call becomes `""`, so the class is never generated there either.
 */
export function classWeb(className: string): string {
  void className;
  return notTransformed("classWeb");
}

/**
 * A class name only the native target keeps.
 *
 * The mirror of {@link classWeb}: use it for a utility only a device can
 * honour — a minimum touch target, a native-only rule, or a spelling the
 * native dialect still uses. On web the call becomes `""`.
 */
export function classApp(className: string): string {
  void className;
  return notTransformed("classApp");
}
