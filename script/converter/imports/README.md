# script/converter/imports

The import-statement utilities — the **leaf** of the converter: nothing here requires anything else from `converter/`, which is what lets the converter, the macro passes and `deps/scan.js` share them without a require cycle. `imports.js` one level up is the single require path.

| File | Job |
| --- | --- |
| `scan.js` | Reading JavaScript the way JavaScript means it. `looksLikeStringStart()` decides whether a quote opens a string or is an apostrophe in JSX text (`Don't`) — getting this wrong in the permissive direction is what makes a naive scanner swallow the rest of the file. `maskCode()` marks which offsets are real code, so passes that rewrite specifiers never touch a `from "pkg"` inside a comment or string. `packageNameOf()` reduces a specifier to the package that would actually be installed (`lodash/fp` → `lodash`, `@scope/pkg/sub` → `@scope/pkg`). |
| `statements.js` | Finding import statements and editing them. `findImports()` returns absolute offsets of every top-level import plus, for named ones, the offsets of the braces' contents — so a merge is an in-place splice. `applyEdits()` sorts splices back-to-front so a whole batch computed against the original string applies at once. `injectImports()` is the tag pass's front door: merge the components a rewrite needs into an existing named import of the same package, else append a new import after the last one. |

Everything that adds, removes or rewrites a specifier anywhere in the codebase goes through these two files.
