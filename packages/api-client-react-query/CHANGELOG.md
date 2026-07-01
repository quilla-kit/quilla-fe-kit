# @quilla-fe-kit/api-client-react-query

## 0.5.2

### Patch Changes

- b723f7c: Fix `Register` meta augmentation not shipping to consumers.

  `src/query-meta.d.ts` was an ambient declaration file — TypeScript used it
  locally but never emitted it to `dist/`, so installed packages had no
  `queryMeta` / `mutationMeta` typing on `@tanstack/react-query`'s `Register`.

  Renamed to `query-meta.ts` with `export type` on `SharedMeta` and
  `QuillaMutationMeta`, and re-exported both from the package index. TypeScript
  now emits `dist/query-meta.d.ts` (including the `declare module` augmentation),
  and the re-export from `index` ensures the augmentation is active whenever the
  package is imported.

## 0.5.1

### Patch Changes

- Updated dependencies [3463bd1]
  - @quilla-fe-kit/api-client@0.2.0

## 0.5.0

### Minor Changes

- 8e72ee9: `resetQueryClient` now flushes both the query cache and the mutation cache before dropping the singleton reference. Previously it only cleared the guard, leaving cached data and mutation observers alive on the abandoned instance.

  `getQueryClient` has been removed from the public API. It exposed the raw `QueryClient`, giving consumers access to internal methods (`getMutationCache`, `getQueryCache`, etc.) that should never be needed directly. `resetQueryClient` is now the single teardown API for both HMR dispose handlers and test `beforeEach` setup.

## 0.4.0

### Minor Changes

- 9cc440c: Add `queryTransformer` and `mutationTransformer` options to `createHooks` for backend envelope unwrapping.

  Backends that wrap responses in a custom envelope (e.g. `{ payload, metadata }`) previously required either leaking envelope fields into DTOs or writing a full `HttpClient` decorator. Both transformers can now be set once in `createHooks` so every hook call normalises responses automatically, with a per-call `transformer` option available for endpoints that differ from the rest.

  The previous built-in `{ data, pagination }` auto-detection in `useQueryBase` has been removed in favour of this explicit opt-in — without a transformer, `response.data` is returned as-is.

## 0.3.0

### Minor Changes

- 48da26e: Singleton `QueryClient` guard and `getQueryInvalidator()` accessor.

  **Breaking: `createQueryClient` return type changed**

  Previously returned a `QueryClient` directly (v0.1) then a `QueryClientBundle`
  (intermediate). Now returns `QueryClient` again — but stores the instance
  internally as a singleton. The api layer exports only what `QueryClientProvider`
  needs:

  ```ts
  // lib/api.ts — owns all query infrastructure config
  export const queryClient = createQueryClient({
    onQueryError: (err) => toast.error(err.message),
    onMutationSuccess: (_data, mutation) => {
      if (mutation.meta?.showSuccess) toast.success("Saved");
    },
  });
  ```

  ```tsx
  // app.tsx — mounts the provider, no config knowledge
  import { queryClient } from '@/lib/api';

  <QueryClientProvider client={queryClient}>
  ```

  **Singleton guard — throws on double instantiation**

  `createQueryClient` throws on a second call:

  ```
  [quilla-fe-kit] createQueryClient was already called.
  Call resetQueryClient() between test runs to obtain a fresh instance.
  ```

  This prevents accidental double-instantiation (two independent caches,
  mismatched invalidations) without relying on consumers remembering to export
  a single reference.

  `createQueryClient` also throws in non-browser environments (`typeof window === 'undefined'`):

  ```
  [quilla-fe-kit] createQueryClient is CSR/SPA only.
  In SSR environments, construct QueryClient per request directly.
  ```

  **`getQueryInvalidator()` — package-level invalidator accessor**

  Returns the `QueryInvalidator` bound to the singleton at creation time.
  Import it anywhere in the api layer — no need to export the invalidator from
  `lib/api.ts` or thread it across module boundaries:

  ```ts
  import { getQueryInvalidator } from "@quilla-fe-kit/api-client-react-query";

  // WebSocket event handler, polling callback, logout flow — works anywhere
  socket.on("user:updated", () =>
    getQueryInvalidator().invalidate([userKeys.lists(), userKeys.detail(id)])
  );

  async function logout() {
    await authClient.signOut();
    getQueryInvalidator().clear();
  }
  ```

  Throws with a clear message if called before `createQueryClient`.

  **`resetQueryClient()` — test escape hatch**

  Clears the singleton guard so tests can create a fresh instance per run:

  ```ts
  import { resetQueryClient } from "@quilla-fe-kit/api-client-react-query";
  import { beforeEach } from "vitest";

  beforeEach(() => {
    resetQueryClient();
  });
  ```

  **`queryInvalidator` — stable proxy (Gap 3 fix)**

  A pre-bound proxy object that defers the singleton lookup to call time. Safe
  to import at module scope — avoids the "called before createQueryClient" error
  caused by import order:

  ```ts
  import { queryInvalidator } from "@quilla-fe-kit/api-client-react-query";

  // Module-level — safe, lookup deferred until the handler fires
  socket.on("user:updated", () =>
    queryInvalidator.invalidate([userKeys.lists()])
  );
  ```

  **`getQueryClient()` — singleton client accessor (Gap 1 fix)**

  Returns the `QueryClient` managed by the singleton. Used internally by
  `buildOCCHeaders` so OCC reads and cache invalidations both hit the same
  instance regardless of which `QueryClientProvider` is in the React tree.

  **`buildOCCHeaders` signature change (breaking)**

  The `queryClient` parameter is removed. The helper now reads from the
  singleton via `getQueryClient()` internally:

  ```ts
  // before
  buildOCCHeaders(queryClient, resolver, vars);

  // after
  buildOCCHeaders(resolver, vars);
  ```

  **All mutation hooks now fully singleton — no `useQueryClient()` dependency**

  `useQueryClient()` is removed from all four mutation hooks. Both cache reads
  (OCC) and cache invalidation now go through the singleton. The React context
  `QueryClient` is no longer involved in the mutation path.

  **New exports**

  - `queryInvalidator` — stable proxy object
  - `getQueryClient()` → `QueryClient`
  - `QueryInvalidator` — type of the bound invalidator (`invalidate` + `clear`)

  **Removed exported types**

  - `QueryClientBundle` — no longer part of the public API

## 0.2.0

### Minor Changes

- ce9afba: Replace `HttpClientProvider` with `createHooks(httpClient)`; add `createQueryKeys` and `invalidate`.

  **`createHooks(httpClient)` — new primary API**

  Hooks are now bound to an `HttpClient` at module level, not injected via
  React context. `HttpClientProvider` and `useHttpClient` are removed. The
  `HttpClient` is an infrastructure detail that no component can reach directly.

  ```ts
  // configure once — outside React
  export const hooks = createHooks(httpClient);

  // in components
  const { data } = hooks.useQueryBase(userKeys.lists(), "/users");
  ```

  **`createQueryKeys(domain)` — standardized cache key factory**

  Produces a consistent 4-level key hierarchy (`all → lists → list → detail`)
  that composes with `useQueryBase`'s key appending and react-query's prefix
  invalidation.

  ```ts
  const userKeys = createQueryKeys("users");
  userKeys.all(); // ['users']
  userKeys.lists(); // ['users', 'list']
  userKeys.detail(42); // ['users', 'detail', 42]
  ```

  **`invalidate` option on all mutation hooks**

  Pass a static `QueryKey[]` or a `(vars, data) => QueryKey[]` resolver. Cache
  invalidation runs before `onSuccess` — the cache is already fresh when your
  callback fires.

  ```ts
  hooks.usePutMutationBase("/users", {
    occ: { versionKey: ({ id }) => userKeys.detail(id) },
    invalidate: ({ id }) => [userKeys.detail(id), userKeys.lists()],
  });
  ```

## 0.1.1

### Patch Changes

- ba25ee0: test: smoke-test CI release via Trusted Publishers (OIDC) across all packages
- Updated dependencies [ba25ee0]
  - @quilla-fe-kit/api-client@0.1.1
  - @quilla-fe-kit/errors@0.1.1

## 0.1.0

### Minor Changes

- 4e00828: Initial release of `@quilla-fe-kit/errors`, `@quilla-fe-kit/auth`,
  `@quilla-fe-kit/api-client`, and `@quilla-fe-kit/api-client-react-query`.

### Patch Changes

- Updated dependencies [4e00828]
  - @quilla-fe-kit/errors@0.1.0
  - @quilla-fe-kit/api-client@0.1.0
