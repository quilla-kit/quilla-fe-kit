---
'@quilla-fe-kit/api-client-react-query': minor
---

Query and mutation `meta` are now app-extensible. Merge fields into `QueryMetaExtensions` / `MutationMetaExtensions` with `declare module '@quilla-fe-kit/api-client-react-query'` and they are typed at the call site and in the `createQueryClient` callbacks, alongside the default vocabulary (`showSuccess`, `customSuccessMessage`, …). Previously the kit's `Register` augmentation left no way to add fields. Without extensions, meta typing is unchanged.

`SharedMeta` and `QuillaMutationMeta` remain the default vocabulary only. Type helpers that should see your extensions with TanStack's `QueryMeta` / `MutationMeta` instead.

The README also documents that typed `meta` requires an ESM-typed project: under `NodeNext`/`Node16` without `"type": "module"`, TypeScript resolves TanStack's CommonJS declarations and `meta` silently falls back to an untyped record.
