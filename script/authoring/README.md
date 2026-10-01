# script/authoring

One file: `platform.ts` — the **authoring-only shim** for the platform macros.

`useWeb` / `useApp` / `classWeb` / `classApp` are build-time macros resolved by `script/converter/macro/` while a file is synced into each template. This module is never imported by anything that ships: the converter lifts the import back out of every file it processes, so it cannot leak into a template's dependencies, Metro's module graph, or a production bundle. It exists purely so the editor and `tsc` can resolve and type the calls while you author in `src/`.

```ts
export function useWeb<T>(fn: () => T): T;
export function useApp<T>(fn: () => T): T;
export function classWeb(className: string): string;
export function classApp(className: string): string;
```

The signatures are chosen so both macro forms type-check: the statement form (`fn` returns `void`) and the expression form (it returns JSX or any value); classes read like a plain string helper.

If one of these somehow reaches runtime, it throws immediately with a message naming the macro and the likely causes (file outside the scanned folders, sync never ran) — a loud failure instead of silently wrong behaviour. Doctor's `generated-files` check scans the templates for any macro or `authoring/platform` reference that leaked.

The doc comment on the module is the full authoring guide: call form, brace form (`useWeb{ A }:useApp{ B }` — the only form that can hold `import`/`export`), bare-attribute class shorthand, and the trailing-directive import form (`import X from "y"; // useWeb`).
