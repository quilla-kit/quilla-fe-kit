---
'@quilla-fe-kit/api-client-react-query': patch
---

Fix OCC version lookup for `useQueryBase` reads without query options. `useQueryBase` caches at `[...baseKey, params]`, with `params` as `{}` when the read has no query options, so the documented `versionKey: ({ id }) => keys.detail(id)` never found the version and the mutation rejected with `[OCC] Could not resolve version…`. When nothing is cached at the exact key (and no custom `extractVersion` is supplied), the OCC lookup now also tries `[...key, {}]`. Existing `versionKey`s that return the full key keep resolving exactly as before, and no cache keys change. The error now lists every key it tried.

The README documents the `useQueryBase` cache-key rule and how the cached version is refreshed (`invalidate` refetches active reads; the mutation response's `ETag` is not written to the cache).
