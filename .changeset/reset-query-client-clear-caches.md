---
"@quilla-fe-kit/api-client-react-query": minor
---

`resetQueryClient` now flushes both the query cache and the mutation cache before dropping the singleton reference. Previously it only cleared the guard, leaving cached data and mutation observers alive on the abandoned instance.

`getQueryClient` has been removed from the public API. It exposed the raw `QueryClient`, giving consumers access to internal methods (`getMutationCache`, `getQueryCache`, etc.) that should never be needed directly. `resetQueryClient` is now the single teardown API for both HMR dispose handlers and test `beforeEach` setup.
