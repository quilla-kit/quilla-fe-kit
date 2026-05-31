---
"@quilla-fe-kit/api-client-react-query": minor
---

Replace `HttpClientProvider` with `createHooks(httpClient)`; add `createQueryKeys` and `invalidate`.

**`createHooks(httpClient)` — new primary API**

Hooks are now bound to an `HttpClient` at module level, not injected via
React context. `HttpClientProvider` and `useHttpClient` are removed. The
`HttpClient` is an infrastructure detail that no component can reach directly.

```ts
// configure once — outside React
export const hooks = createHooks(httpClient);

// in components
const { data } = hooks.useQueryBase(userKeys.lists(), '/users');
```

**`createQueryKeys(domain)` — standardized cache key factory**

Produces a consistent 4-level key hierarchy (`all → lists → list → detail`)
that composes with `useQueryBase`'s key appending and react-query's prefix
invalidation.

```ts
const userKeys = createQueryKeys('users');
userKeys.all()          // ['users']
userKeys.lists()        // ['users', 'list']
userKeys.detail(42)     // ['users', 'detail', 42]
```

**`invalidate` option on all mutation hooks**

Pass a static `QueryKey[]` or a `(vars, data) => QueryKey[]` resolver. Cache
invalidation runs before `onSuccess` — the cache is already fresh when your
callback fires.

```ts
hooks.usePutMutationBase('/users', {
  occ: { versionKey: ({ id }) => userKeys.detail(id) },
  invalidate: ({ id }) => [userKeys.detail(id), userKeys.lists()],
});
```
