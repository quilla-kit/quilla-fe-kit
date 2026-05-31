# @quilla-fe-kit/api-client-react-query

React Query adapter for [`@quilla-fe-kit/api-client`](../api-client):

- **`createHooks(httpClient)`** — binds all hooks to an `HttpClient` instance.
  The client is an infrastructure detail: it never leaks into the component tree.
- **`createQueryClient(config)`** — typed-error retry policy, optional
  callback hooks for global UX (no toast lib coupling).
- **`useQueryBase`** — wraps `useQuery` with debounced search filters,
  pagination + sort state, stable cache keys, and ETag-based version
  extraction.
- **`usePostMutationBase` / `usePutMutationBase` / `usePatchMutationBase` /
  `useDeleteMutationBase`** — HTTP-method-specific mutation helpers with
  explicit OCC `versionKey` resolution and built-in cache invalidation.
- **`createQueryKeys(domain)`** — standardized query key factory for
  prefix-based cache invalidation.
- **Query meta module augmentation** — declarative `meta: { showSuccess }`
  routed via your callbacks. The package never imports a toast library.

Runtime deps: `@quilla-fe-kit/api-client`, `@quilla-fe-kit/errors`.
Peer deps: `@tanstack/react-query` ≥ 5, `react` ≥ 18.

## Install

```sh
pnpm add @quilla-fe-kit/api-client-react-query \
         @quilla-fe-kit/api-client \
         @quilla-fe-kit/errors \
         @tanstack/react-query react
```

Node 22+, ESM-only. The peer-dep approach means your app pins the React
Query version it wants — the adapter doesn't ship a duplicate.

## Quick start

```ts
// lib/api.ts — configure once, outside the component tree
import { createHttpClient } from '@quilla-fe-kit/api-client';
import { createHooks, createQueryKeys } from '@quilla-fe-kit/api-client-react-query';
import { localStorageTokenStorage } from '@quilla-fe-kit/auth';

const httpClient = createHttpClient({
  baseUrl: 'https://api.example.com',
  storage: localStorageTokenStorage(),
  refreshEndpoint: async (refreshToken) => { /* ... */ },
});

// Destructure so hooks are imported by name, same as any other hook.
// The HttpClient never touches React context — it's bound here, at module level.
export const {
  useQueryBase,
  usePostMutationBase,
  usePutMutationBase,
  usePatchMutationBase,
  useDeleteMutationBase,
} = createHooks(httpClient);

export const userKeys = createQueryKeys('users');
```

```tsx
// app.tsx — wire up React Query's own cache provider
import { createQueryClient } from '@quilla-fe-kit/api-client-react-query';
import { QueryClientProvider } from '@tanstack/react-query';

const queryClient = createQueryClient({
  onQueryError: (err) => myToast.error(err.message),
  onMutationSuccess: (_data, mutation) => {
    if (mutation.meta?.showSuccess) myToast.success('Saved');
  },
});

export const App = () => (
  <QueryClientProvider client={queryClient}>
    <Routes />
  </QueryClientProvider>
);
```

```tsx
// UserProfile.tsx — hooks look and feel like any other hook
import { useQueryBase, usePutMutationBase, userKeys } from '@/lib/api';

const UserProfile = ({ id }: { id: number }) => {
  const { data, isLoading } = useQueryBase<User>(userKeys.detail(id), `/users/${id}`);
  const updateUser = usePutMutationBase<User, UpdateUserBody>('/users', {
    occ: { versionKey: ({ id }) => userKeys.detail(id) },
    invalidate: ({ id }) => [userKeys.detail(id), userKeys.lists()],
  });

  if (isLoading) return <Spinner />;

  return (
    <Form
      initial={data?.data}
      onSubmit={(body) => updateUser.mutate({ id, body })}
    />
  );
};
```

## `createQueryClient`

Returns a `QueryClient` with sensible retry defaults wired to the typed
errors from `@quilla-fe-kit/errors`:

```ts
const queryClient = createQueryClient({
  // Optional callback hooks. Not invoked unless you provide them — the
  // package never imports a toast library or pushes to global state.
  onQueryError?: (error: Error, query: Query) => void,
  onQuerySuccess?: (data: unknown, query: Query) => void,
  onMutationError?: (error: Error, mutation: Mutation) => void,
  onMutationSuccess?: (data: unknown, mutation: Mutation) => void,

  // Optional retry tuning
  retry?: {
    maxAttempts?: number,        // default 2 (other errors)
    networkMaxAttempts?: number, // default 1 (NetworkError only)
  },
});
```

### Retry policy

| Error class                                                  | Retries           |
| ------------------------------------------------------------ | ----------------- |
| `BadRequest`, `Unauthorized`, `Forbidden`, `NotFound`, `Validation`, `BusinessRule`, `Conflict` | never (terminal client-side errors) |
| `NetworkError`                                               | up to `networkMaxAttempts` (default 1) |
| Other (incl. `InternalServerError`, unknown thrown values)   | up to `maxAttempts` (default 2)        |

Mutations never retry. (React Query default — preserved here.)

### Wiring meta-driven UX

The package augments React Query's `Register` interface so query / mutation
`meta` is typed:

```ts
meta: {
  showSuccess?: boolean;
  showWarning?: boolean;
  customSuccessMessage?: string;
  customErrorMessage?: string;
  showError?: boolean;          // mutations only
}
```

Consumers wire UX in their `createQueryClient` callbacks:

```ts
const queryClient = createQueryClient({
  onQuerySuccess: (_data, query) => {
    if (query.meta?.showSuccess) toast.success(query.meta.customSuccessMessage ?? 'Loaded');
  },
  onMutationError: (err, mutation) => {
    if (mutation.meta?.showError !== false) toast.error(err.message);
  },
});
```

This is deliberate. The toolkit doesn't know whether you use Sonner,
Mantine, your own `<Snackbar>`, or `console.warn` for failures. You decide.

## `createHooks`

Binds all hooks to an `HttpClient` instance at module level, outside React.
The `HttpClient` is an infrastructure detail — it is never accessible through
the component tree, so no component can make raw HTTP calls by accident.

Destructure the returned object so each hook is exported by name and imported
like any other hook — no dot-access, no new API to learn:

```ts
// lib/api.ts
import { createHttpClient } from '@quilla-fe-kit/api-client';
import { createHooks } from '@quilla-fe-kit/api-client-react-query';

const httpClient = createHttpClient({ baseUrl: '/api', ... });

export const {
  useQueryBase,
  usePostMutationBase,
  usePutMutationBase,
  usePatchMutationBase,
  useDeleteMutationBase,
} = createHooks(httpClient);
```

```tsx
// In any component
import { useQueryBase } from '@/lib/api';

const { data } = useQueryBase(['users'], '/users');
```

Apps with multiple backends create multiple `createHooks(...)` instances and
export them from different modules — no React context nesting needed. The
`Hooks` type (exported) is available if you need to type a custom hook factory:

```ts
import type { Hooks } from '@quilla-fe-kit/api-client-react-query';

function createDomainHooks(base: Hooks) { ... }
```

## `useQueryBase`

A typed `useQuery` wrapper for the common list / detail GET shape. Adds:

- **Debounced search** — search keys are debounced (default 500ms) and the
  query stays disabled until search input meets the min length (default 3).
- **Stable cache keys** — input is structurally normalized so callers can
  pass inline literals each render without thrashing the cache.
- **Version extraction** — reads the `ETag` response header into
  `result.data.version` for downstream OCC mutations.
- **Response unwrapping** — accepts both `{ data, pagination }` envelope
  shape and bare-data responses.

```ts
const { data, isLoading } = useQueryBase<RawUser, UserVm>(
  ['users'],            // base queryKey; params get appended for cache-key stability
  '/users',             // request path
  {
    query: {
      search: { name: query },          // → name__contains=query (debounced)
      filter: { status: 'active' },     // → status=active
      page,
      limit: 20,
      sort: 'createdAt:desc',
    },
    tuning: { debounceMs: 300, minSearchLength: 2 },
    mapper: (raw) => toUserVm(raw),     // optional raw → vm transform
    headers: { 'X-Trace-Id': traceId }, // optional per-call headers
    // ...any UseQueryOptions field except queryKey/queryFn
  },
);

// data shape: { data: UserVm | UserVm[], version: number | null, pagination?: {...} }
```

`mapper` runs once per fetch (inside the `queryFn`) — not on every render.

## Mutation hooks

Four method-specific hooks. POST is for creation (no version yet);
PUT/PATCH/DELETE accept an optional `occ` resolver for `If-Match` headers.

### POST

```ts
const create = usePostMutationBase<CreatedUser, CreateUserBody>('/users');
create.mutate({ name: 'Ada' });

// Login / refresh: skip the auth decorator
const login = usePostMutationBase<TokenPair, LoginBody>('/auth/login', {
  disabledAuth: true,
});
```

### PUT (replace)

```ts
const replace = usePutMutationBase<User, UpdateUserBody>('/users', {
  occ: { versionKey: ({ id }) => userKeys.detail(id) },
});
replace.mutate({ id: userId, body: { name: 'Ada' } });
// → PUT /users/{id} with If-Match: "<version>" pulled from cache
```

### PATCH (partial)

`basePath` can include `:id` (substituted) or be a plain prefix (id is appended):

```ts
// Plain prefix
usePatchMutationBase<User, PartialUserBody>('/users');
// PATCH /users/123

// Templated
usePatchMutationBase<Seat, SeatBody>('/orgs/:id/seats');
// PATCH /orgs/acme/seats
```

### DELETE

```ts
// Variables can be a primitive id...
const remove = useDeleteMutationBase<void, string>('/users');
remove.mutate('user-1');

// ...or { id, body? } for OCC
const safeRemove = useDeleteMutationBase<void, { id: number }>('/users', {
  occ: { versionKey: ({ id }) => userKeys.detail(id) },
});
safeRemove.mutate({ id: 1 });
```

## `createQueryKeys`

`createQueryKeys(domain)` returns a typed factory that produces a consistent
key hierarchy for a domain. Pass the returned keys to `useQueryBase` as
`baseKey` and to `invalidate` on mutation hooks.

```ts
const userKeys = createQueryKeys('users');

userKeys.all()            // ['users']
userKeys.lists()          // ['users', 'list']
userKeys.list({ page: 2 }) // ['users', 'list', { page: 2 }]
userKeys.detail(42)       // ['users', 'detail', 42]
```

### Key hierarchy and prefix matching

React Query invalidates everything whose key starts with the given prefix:

| Invalidate call | Keys cleared |
|---|---|
| `queryClient.invalidateQueries({ queryKey: userKeys.all() })` | every user query |
| `queryClient.invalidateQueries({ queryKey: userKeys.lists() })` | all list queries |
| `queryClient.invalidateQueries({ queryKey: userKeys.detail(42) })` | one detail entry |

`lists()` is the right invalidation target after a create or delete; `detail(id)`
after an update.

A note on `list(params?)`: it returns a 3-tuple even without params —
`['users', 'list', undefined]`. This makes it useful for exact-key targeting
(e.g. passing to `useQueryBase` directly), but it **does not** prefix-match
`lists()` — use `lists()` for broad list invalidation.

### Wiring with `useQueryBase`

Pass the factory key as `baseKey`; `useQueryBase` appends the normalized
params itself, so cache entries land at `['users', 'list', { ... }]`:

```ts
const { data } = useQueryBase<RawUser>(
  userKeys.lists(),   // → ['users', 'list', <params>] in cache
  '/users',
  { query: { filter: { status: 'active' } } },
);
```

## `invalidate` option on mutation hooks

All four mutation hooks accept an `invalidate` option that calls
`queryClient.invalidateQueries` automatically on success, before any
consumer `onSuccess` callback runs.

Pass a static array of keys, or a function that receives the mutation
variables and response data:

```ts
// Static — always invalidate the list after creating a user
const create = usePostMutationBase<User, CreateUserBody>('/users', {
  invalidate: [userKeys.lists()],
});

// Dynamic — invalidate the detail AND the list after updating
const update = usePutMutationBase<User, UpdateUserBody>('/users', {
  occ: { versionKey: ({ id }) => userKeys.detail(id) },
  invalidate: ({ id }) => [userKeys.detail(id), userKeys.lists()],
});

// Multiple static targets
const remove = useDeleteMutationBase<void, { id: number }>('/users', {
  occ: { versionKey: ({ id }) => userKeys.detail(id) },
  invalidate: [userKeys.lists(), userKeys.all()],
});
```

The invalidations are `await`-ed before `onSuccess` fires, so the cache is
already fresh by the time your callback runs. If you provide both `invalidate`
and `onSuccess`, they compose: invalidations happen first, then your callback.

### Type

```ts
type InvalidateKeys<TVars, TData> =
  | QueryKey[]                              // static list of keys
  | ((vars: TVars, data: TData) => QueryKey[]); // dynamic resolver
```

## OCC: how `versionKey` works

The locked design rejects prefix-matching cache lookups (the substrate's
fragile pattern). Instead, mutations require an **explicit** `versionKey`
builder that returns the React Query queryKey of a cache entry shaped as
`QueryBaseResult<T>` (i.e., a result of `useQueryBase`):

```ts
type QueryBaseResult<T> = {
  data: T;
  version: number | null;     // populated from response ETag
  pagination?: { page, limit, total };
};
```

The OCC helper reads `cache.version` and stamps `If-Match: "<version>"`
on the mutation request. If the cache entry is missing or `version` is
null, the mutation throws a clear error before the request fires —
explicit-over-magic.

For non-`useQueryBase` cache shapes, override the extractor:

```ts
useDeleteMutationBase<void, { id: number }>('/users', {
  occ: {
    versionKey: ({ id }) => userKeys.detail(id),
    extractVersion: (cached) => (cached as { rev: number } | undefined)?.rev ?? null,
  },
});
```

The `buildOCCHeaders(queryClient, resolver, vars)` helper is also exported
if you need to compose your own mutation hooks.

## `useDebouncedValue`

Pure utility — no React Query or HTTP-client dependency. Included in the
`createHooks` return object and also exported as a direct named export.

```ts
import { useDebouncedValue } from '@quilla-fe-kit/api-client-react-query';

const debounced = useDebouncedValue(searchInput, 500);
```

## API surface

### Factories
- `createHooks(httpClient)` → `Hooks`
- `createQueryClient(config)`
- `createQueryKeys(domain)` → `QueryKeyFactory`

### Hooks (returned by `createHooks`, destructure and import by name)
- `useQueryBase<TRaw, TModel?, TError?>(baseKey, url, options?)`
- `usePostMutationBase<TData, TVars?, TError?>(url, options?)`
- `usePutMutationBase<TData, TBody?, TError?>(basePath, options?)`
- `usePatchMutationBase<TData, TBody?, TError?>(basePath, options?)`
- `useDeleteMutationBase<TData?, TVars?, TError?>(basePath, options?)`

### Helpers
- `buildOCCHeaders(queryClient, resolver, vars)` — for custom mutations

### Types
- `QueryBaseResult<T>`, `QueryBaseInput`, `QueryBaseTuning`, `UseQueryBaseOptions<...>`
- `CreateQueryClientConfig`, plus the four event-handler aliases
- `IdAndBody<TBody>`, `VersionResolver<TVars>`, `InvalidateKeys<TVars, TData>`
- `QueryKeyFactory`
- Per-hook option types (`UsePostMutationOptions`, etc.)

## Module augmentation

Importing this package once anywhere in your app augments
`@tanstack/react-query`'s `Register` interface, giving you typed
`meta: { showSuccess, showWarning, customSuccessMessage, customErrorMessage }`
on queries (and `showError` on mutations).

You don't need to do anything to opt in beyond the import. If you want
explicit control, the augmentation is published in
[`src/query-meta.d.ts`](src/query-meta.d.ts) — copy it into your own
`*.d.ts` and customize the field shape.
