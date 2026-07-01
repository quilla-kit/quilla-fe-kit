---
'@quilla-fe-kit/api-client-react-query': patch
---

Fix `Register` meta augmentation not shipping to consumers.

`src/query-meta.d.ts` was an ambient declaration file — TypeScript used it
locally but never emitted it to `dist/`, so installed packages had no
`queryMeta` / `mutationMeta` typing on `@tanstack/react-query`'s `Register`.

Renamed to `query-meta.ts` with `export type` on `SharedMeta` and
`QuillaMutationMeta`, and re-exported both from the package index. TypeScript
now emits `dist/query-meta.d.ts` (including the `declare module` augmentation),
and the re-export from `index` ensures the augmentation is active whenever the
package is imported.
