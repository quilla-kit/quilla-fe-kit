# quilla-fe-kit

A composable TypeScript toolkit for consuming substrate-grade APIs from the
frontend. Sibling to [`quilla-kit`](https://github.com/quilla-kit/quilla-kit) —
the two halves agree on HTTP wire contracts but share zero code.

## Packages

- **`@quilla-fe-kit/errors`** — typed error hierarchy. `QuillaFeError`
  base + 9 subclasses (`BadRequestError`, `UnauthorizedError`,
  `ForbiddenError`, `NotFoundError`, `ConflictError`, `ValidationError`,
  `BusinessRuleError`, `InternalServerError`, `NetworkError`) with `code`,
  `context`, `cause`, JSON serialization, and a cross-realm `Symbol.for`
  brand. Zero runtime dependencies. Reusable in any FE project that
  wants a structured error model — independent of HTTP.
- **`@quilla-fe-kit/storage`** — `TokenStorage` interface plus three
  default adapters: `memoryTokenStorage()` (SSR-safe), `localStorageTokenStorage()`,
  `cookieTokenStorage()` (Secure / SameSite). Zero runtime dependencies.
  Reusable in any FE auth flow — independent of HTTP client.
- **`@quilla-fe-kit/api-client`** — framework-agnostic HTTP API client.
  Layered fetch wrapper, single-flight token refresh, pluggable error
  parser, configurable query-string serializer. Browser + Node + edge
  safe. Depends on `@quilla-fe-kit/errors` + `@quilla-fe-kit/storage`.
  Owns the BE wire-contract types internally and re-exports them for
  consumer ergonomics.
- **`@quilla-fe-kit/api-client-react-query`** — React Query adapter.
  QueryClient factory, `useQueryBase`, mutation base hooks, callback-shaped
  notification surface. Depends on `@quilla-fe-kit/api-client` +
  `@quilla-fe-kit/errors`; `@tanstack/react-query` and `react` are peer deps.

Per-package READMEs cover usage. This index will grow as adapters land
(`api-client-swr`, `api-client-vue-query`, `api-client-solid-query` are
deferred but on the roadmap).

## Status

Pre-1.0. Independent versioning per package via Changesets.
