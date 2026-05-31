---
"@quilla-fe-kit/api-client-react-query": minor
---

Singleton `QueryClient` guard and `getQueryInvalidator()` accessor.

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
    if (mutation.meta?.showSuccess) toast.success('Saved');
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
import { getQueryInvalidator } from '@quilla-fe-kit/api-client-react-query';

// WebSocket event handler, polling callback, logout flow — works anywhere
socket.on('user:updated', () =>
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
import { resetQueryClient } from '@quilla-fe-kit/api-client-react-query';
import { beforeEach } from 'vitest';

beforeEach(() => {
  resetQueryClient();
});
```

**`queryInvalidator` — stable proxy (Gap 3 fix)**

A pre-bound proxy object that defers the singleton lookup to call time. Safe
to import at module scope — avoids the "called before createQueryClient" error
caused by import order:

```ts
import { queryInvalidator } from '@quilla-fe-kit/api-client-react-query';

// Module-level — safe, lookup deferred until the handler fires
socket.on('user:updated', () => queryInvalidator.invalidate([userKeys.lists()]));
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
buildOCCHeaders(queryClient, resolver, vars)

// after
buildOCCHeaders(resolver, vars)
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
