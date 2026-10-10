# script/converter/macro

The platform macros — `useWeb` / `useApp` and `classWeb` / `classApp` — which are **build-time constructs, not runtime functions**. They are resolved while a source file is synced into each template, so one file in `src/` holds platform-specific code and classes with no runtime branching.

`platform-blocks.js` one level up is the public surface; the work is one concern per file here, and `macro/table.js` is data every pass reads without a cycle.

## The four macro forms

| Form | Example | Behaviour |
| --- | --- | --- |
| Call, block body | `useWeb(() => { … })` | kept side → IIFE `(() => { … })()`; dropped side → whole statement removed (or `null` in expression position, incl. declaration initialisers — which is why "is this a statement" is not decided by the trailing `;` alone) |
| Call, expression body | `useWeb(() => expr)` | kept side → `(expr)`; dropped side → `null` / removed |
| Brace block | `useWeb{ A }` / `useWeb{ A }:useApp{ B }` | ONE construct, either order; the kept half's body is spliced in **verbatim, no wrapping function** — the only form that can hold `import` / `export` declarations. A lone block for the other platform is dropped whole. |
| Bare attribute | `<span classWeb="hover:x">` | attribute removed on the dropped platform; on the kept platform its class is appended into that element's own `className` (plain string or hole-free template only — anything else is left and reported) |

Class macros (the call form) append the compiled class at the **end of the enclosing className** — `` className={`panel ${classWeb("hover:x")}`} `` → `` className={`panel hover:x`} `` — while the dropped platform gets `""` and no append, so the class never reaches a stylesheet that could not apply it. Several macros in one className settle in one pass (independent splices against original offsets).

Platform-scoped **static imports** (`import X from "y"; // useWeb`) are handled by `import-scope.js`: the whole statement — comment included — is deleted on the platform that does not keep it, before that platform's bundler or the dependency scanner ever sees the specifier.

## Files

| File | Job |
| --- | --- |
| `table.js` | What a macro *is*: `MACROS` (name → keeping platform; membership is what makes an identifier a macro at all), `VALUE_MACROS` (the class macros), `BRACE_PAIR` (the `useWeb` ↔ `useApp` brace complement), and the authoring-module regex the import lifter matches. Data only. |
| `scan.js` | Finding calls and brace blocks: character walks that skip strings and comments, descend into `${ … }` holes of template literals (a hole is code; the literal's text is prose), and keep the two forms exclusive (`useWeb(` is a call, `useWeb{` is a block). Hole visits carry the literal's bounds, because a kept class appends at the literal's closing backtick. |
| `callback.js` | Reading the function a block macro takes — a plain arrow (block or expression body) or function expression. Anything else (a call, a variable, a spread) is deliberately not guessed at: the call is left untouched and reported, so the build fails at a real unresolved identifier instead of silently dropping code. |
| `build.js` | The splices: per-call and per-block edits, applied back-to-front; the fixed-point loop so nested macros settle (`MAX_PASSES` guards non-convergence); className-tail appends with confirmation that the hole really belongs to the nearest className; and `liftAuthoringImport()`, which removes the `script/authoring/platform` import and drops just the specifiers no longer referenced. |
| `attrs.js` | The bare-attribute shorthand (`classWeb="…"` as a plain JSX prop), its own pass because it must find the element's *own* className rather than the nearest one in the file. |
| `import-scope.js` | The trailing `// useWeb` / `// useApp` import directives. |

## Guarantees

- The output contains **zero** macro references and zero authoring-module imports on either target (doctor's `generated-files` check enforces this).
- A call that cannot be parsed as a callback is left alone and reported once per file — never silently dropped.
- Idempotent: a second pass is a no-op.
