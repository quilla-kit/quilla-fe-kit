# @quilla-fe-kit/api-client-react-query

React Query adapter for [`@quilla-fe-kit/api-client`](../api-client):

- **`createHooks(httpClient, config?)`** — binds all hooks to an `HttpClient` instance
  and optionally configures default response transformers for all queries and mutations.
  The client is an infrastructure detail: it never leaks into the component tree.
- **`createQueryClient(config)`** — initialises the singleton `QueryClient`
  and returns it. Throws on a second call. Typed-error retry policy, optional
  callback hooks for global UX (no toast lib coupling).
- **`queryInvalidator`** — stable proxy object for the singleton invalidator.
  Import at module scope and call it anywhere — defers the singleton lookup to
  call time, so module initialisation order doesn't matter.
- **`getQueryInvalidator()`** — explicit accessor; returns the `QueryInvalidator`
  bound to the singleton. Use when you need the reference itself (e.g. to pass
  to a function).
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
// lib/api.ts — the api layer owns all query infrastructure
import { createHttpClient } from '@quilla-fe-kit/api-client';
import {
  createQueryClient,
  createHooks,
  createQueryKeys,
} from '@quilla-fe-kit/api-client-react-query';

// createQueryClient is called once. The returned QueryClient is exported
// for QueryClientProvider. Everything that needs to invalidate imports
// queryInvalidator from the package — no extra exports needed.
export const queryClient = createQueryClient({
  onQueryError: (err) => myToast.error(err.message),
  onMutationSuccess: (_data, mutation) => {
    if (mutation.meta?.showSuccess) myToast.success('Saved');
  },
});

const httpClient = createHttpClient({ baseUrl: 'https://api.example.com', ... });

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
// app.tsx — mounts the provider, imports queryClient from the api layer
import { queryClient } from '@/lib/api';
import { QueryClientProvider } from '@tanstack/react-query';

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

```ts
// realtime.ts — imperative invalidation outside the mutation lifecycle
import { queryInvalidator } from '@quilla-fe-kit/api-client-react-query';
import { userKeys } from '@/lib/api';

// queryInvalidator is a stable proxy — safe to use at module scope.
// The singleton lookup happens when the handler fires, not at import time.
socket.on('user:updated', ({ id }) =>
  queryInvalidator.invalidate([userKeys.detail(id), userKeys.lists()])
);
```

## `createQueryClient`

Initialises the singleton `QueryClient` and returns it. **Throws if called
more than once** — this is the singleton guard that prevents accidental
double-instantiation and the cache conflicts that follow.

Call it once in your api layer and export the returned `QueryClient` for
`QueryClientProvider`. Everything that needs to invalidate the cache imports
`getQueryInvalidator()` from the package directly — no extra exports needed.

```ts
// lib/api.ts
export const queryClient = createQueryClient({
  // Optional callback hooks — not invoked unless you provide them.
  // The package never imports a toast library or pushes to global state.
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

### Testing

The singleton guard means tests that call `createQueryClient` must reset
the state between runs. Use `resetQueryClient()` in `beforeEach`:

```ts
import { resetQueryClient } from '@quilla-fe-kit/api-client-react-query';
import { beforeEach } from 'vitest';

beforeEach(() => {
  resetQueryClient();
});
```

`resetQueryClient()` drops the internal reference — it does not call
`queryClient.clear()`. If your tests mount a `QueryClientProvider`, tear
down the component tree before or after calling it.

When a hook under test uses `occ` or `invalidate`, both features read from
the singleton cache. You must pass the singleton `queryClient` to your
provider wrapper — otherwise OCC reads and cache invalidations will target
a different `QueryClient` than the one backing the provider:

```ts
import { createQueryClient, resetQueryClient } from '@quilla-fe-kit/api-client-react-query';
import { beforeEach, it } from 'vitest';

beforeEach(() => {
  resetQueryClient();
});

it('invalidates on success', async () => {
  // Create the singleton and capture it for provider + cache seeding
  const queryClient = createQueryClient();

  const { result } = renderHookWithProviders(
    () => hooks.usePutMutationBase('/users', {
      occ: { versionKey: ({ id }) => userKeys.detail(id) },
      invalidate: ({ id }) => [userKeys.detail(id), userKeys.lists()],
    }),
    { queryClient }, // ← must be the singleton, not a bare new QueryClient()
  );

  // Seed data on the singleton — OCC reads from here
  queryClient.setQueryData(userKeys.detail(1), { data: {}, version: 5 });

  await act(() => result.current.mutateAsync({ id: 1, body: {} }));
  // invalidation also hits the singleton — consistent
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
export const queryClient = createQueryClient({
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

## `queryInvalidator` and `getQueryInvalidator`

Both give access to the `QueryInvalidator` bound to the singleton. They differ
only in when the singleton lookup occurs.

**`queryInvalidator`** is a stable proxy — safe to capture at module scope.
The lookup happens when you call a method, not when the module loads:

```ts
import { queryInvalidator } from '@quilla-fe-kit/api-client-react-query';
import { userKeys } from '@/lib/api';

// Safe at module scope — no singleton lookup until the handler fires
socket.on('user:updated', () =>
  queryInvalidator.invalidate([userKeys.lists(), userKeys.detail(id)])
);
```

**`getQueryInvalidator()`** returns the invalidator directly. Use it when you
need to pass the reference to a function or store it locally within a
function body:

```ts
import { getQueryInvalidator } from '@quilla-fe-kit/api-client-react-query';

function buildLogoutHandler() {
  const inv = getQueryInvalidator(); // inside a function — safe
  return async () => {
    await authClient.signOut();
    inv.clear();
    router.replace('/login');
  };
}
```

Both throw with a clear message if called before `createQueryClient`.

### `invalidate(keys)`

Accepts `QueryKey[]` and fires all invalidations in parallel. The mutation
hooks (`usePostMutationBase` etc.) call this internally for their `invalidate`
option — call it directly only for imperative cases **outside** the mutation
lifecycle: WebSocket events, polling results, cross-domain side effects.

```ts
// After a polling tick resolves a background job
await pollUntilDone(jobId);
queryInvalidator.invalidate([jobKeys.detail(jobId)]);
```

### `clear()`

Drops the entire query cache. Suited for logout flows or hard session resets:

```ts
async function logout() {
  await authClient.signOut();
  queryInvalidator.clear();
  router.replace('/login');
}
```

### Why not `useQueryClient()`

`useQueryClient()` resolves the nearest `QueryClientProvider` in the React
tree. A second provider — common in test wrappers, nested islands, or
micro-frontend roots — silently returns a different instance. The singleton
accessors always return the same object bound at `createQueryClient` time,
usable inside or outside React with no provider dependency.

## `createHooks`

Binds all hooks to an `HttpClient` instance at module level, outside React.
The `HttpClient` is an infrastructure detail — it is never accessible through
the component tree, so no component can make raw HTTP calls by accident.

```ts
createHooks(httpClient, config?)
```

The optional `config` object accepts:

```ts
{
  // Applied to every useQueryBase call. Must return { data }.
  // Pagination and any other metadata should be included in data itself.
  queryTransformer?: (raw: unknown) => { data: unknown };

  // Applied to every mutation hook call. Returns the domain value.
  mutationTransformer?: (raw: unknown) => unknown;
}
```

Both transformers default to a no-op: without them, `response.data` is
returned as-is. See [Response transformers](#response-transformers) for the
full pattern including per-call overrides.

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
- **Optional response transformer** — a `transformer` option (or the factory-level
  `queryTransformer`) can unwrap any envelope shape. Must return `{ data }` where
  `data` is the complete domain value — including pagination if the backend
  returns it. Without a transformer, `response.data` is used as-is.

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
    transformer: (raw) => {
      const body = raw as { data: RawUser | RawUser[] };
      return { data: body.data };
    },
    // ...any UseQueryOptions field except queryKey/queryFn
  },
);

// data shape: { data: UserVm | UserVm[], version: number | null }
```

`transformer` runs first (extracts `data` from the envelope), then `mapper`
receives that value as its input. Both run once per fetch inside the `queryFn`
— not on every render.

`transformer` overrides the factory-level `queryTransformer` for this specific
call. Use it when one endpoint returns a different envelope shape than the rest.
See [Response transformers](#response-transformers) for the full pattern.

## Response transformers

Most real backends don't return bare domain objects — they wrap responses in
an envelope. Transformers let you normalise that shape once, at the factory
level, so every hook and every DTO stays clean.

### Why two separate transformers

Query and mutation responses differ structurally:

- **Queries** return domain data via `useQueryBase`, which surfaces it as
  `result.data.data`. The `queryTransformer` returns `{ data }` where `data`
  is the complete domain value — including pagination metadata if the backend
  sends it alongside the items array.
- **Mutations** return a single domain value (or nothing for `204 No Content`).
  `mutationTransformer` just returns the unwrapped value.

Collapsing them into one function would force it to inspect context it
shouldn't need to know about.

### Factory-level transformers (default for all hooks)

Set transformers once in `createHooks` and every hook call inherits them:

```ts
// lib/api.ts
import { createHooks } from '@quilla-fe-kit/api-client-react-query';

// Backend envelope shapes:
//   GET  → { payload: T,   metadata?: { pagination: { page, limit, total } } }
//   POST/PUT/PATCH → { payload: T }
//   DELETE         → 204 No Content (undefined)

type Envelope<T> = { payload: T; metadata?: { pagination?: unknown } };

export const {
  useQueryBase,
  usePostMutationBase,
  usePutMutationBase,
  usePatchMutationBase,
  useDeleteMutationBase,
} = createHooks(httpClient, {
  queryTransformer: (raw) => {
    const body = raw as Envelope<User[]>;
    return {
      data: {
        items: body.payload,
        pagination: body.metadata?.pagination as { page: number; limit: number; total: number } | undefined,
      },
    };
  },

  mutationTransformer: (raw) => {
    if (raw == null) return raw; // 204 No Content
    return (raw as Envelope<unknown>).payload;
  },
});
```

Define domain types that use domain language — no envelope fields leak through:

```ts
type PagedUsers = {
  items: User[];
  pagination?: { page: number; limit: number; total: number };
};

// TRaw = PagedUsers — useQueryBase surfaces the transformer output directly
const { data } = useQueryBase<PagedUsers>(userKeys.lists(), '/users', { query });
// data.data.items      → User[]
// data.data.pagination → { page, limit, total }
```

DTOs for mutation responses are plain domain types — no envelope awareness:

```ts
// Before: AuthTokensDto had to declare a `payload` field
type AuthTokensDto = { payload: { accessToken: string; refreshToken: string } };

// After: clean domain type
type AuthTokensDto = { accessToken: string; refreshToken: string };

const login = usePostMutationBase<AuthTokensDto, LoginBody>('/auth/login', {
  disabledAuth: true,
});
// login.data is AuthTokensDto directly — no .payload access
```

### Per-call transformer override

If one endpoint returns a shape that differs from the rest, pass `transformer`
in the hook's options. It takes precedence over the factory default:

```ts
// All other query hooks use the factory queryTransformer above.
// This endpoint returns { result: T } instead of { payload: T }.
const { data } = useQueryBase<StatsDto>(['stats'], '/stats', {
  transformer: (raw) => ({ data: (raw as { result: unknown }).result }),
});

// Similarly for mutations
const archive = usePostMutationBase<void, { id: string }>('/archive', {
  transformer: (raw) => raw, // endpoint returns 200 with no body wrapper
});
```

### Without a transformer

When no transformer is set at either level, `response.data` is returned
as-is. This is the right default for backends that already return bare
domain values with no wrapping:

```ts
// Backend returns { id: string, name: string } directly
const hooks = createHooks(httpClient); // no transformers

const { data } = useQueryBase<User>(['users', id], `/users/${id}`);
// data.data is { id, name } — response.data passed straight through
```

### Types

```ts
import type {
  QueryTransformer,
  MutationTransformer,
  QueryTransformResult,
  HooksConfig,
} from '@quilla-fe-kit/api-client-react-query';

// QueryTransformer<TData>   = (raw: unknown) => { data: TData }
// MutationTransformer       = (raw: unknown) => unknown
// QueryTransformResult<T>   = { data: T }
// HooksConfig               = { queryTransformer?: QueryTransformer; mutationTransformer?: MutationTransformer }
```

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
| `queryInvalidator.invalidate([userKeys.all()])` | every user query |
| `queryInvalidator.invalidate([userKeys.lists()])` | all list queries |
| `queryInvalidator.invalidate([userKeys.detail(42)])` | one detail entry |

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
`queryInvalidator.invalidate()` automatically on success, before the
per-hook `onSuccess` callback runs.

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

The invalidations are `await`-ed before the per-hook `onSuccess` fires, so
the cache is already fresh by the time your callback runs. If you provide
both `invalidate` and `onSuccess`, they compose: invalidations happen first,
then your callback.

Note: the global `onMutationSuccess` callback in `createQueryClient` fires
**before** invalidation — it is intended for global UX concerns (toasts,
logging) only. See [Constraints and known limitations](#onmutationsuccess-fires-before-cache-invalidation).

Internally the hooks call `queryInvalidator.invalidate()` — the same
singleton bound at `createQueryClient` time. No React context is involved
in the invalidation path.

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
  version: number | null; // populated from response ETag
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

The `buildOCCHeaders(resolver, vars)` helper is also exported if you need
to compose your own mutation hooks. It reads the version from the singleton
cache internally — no `QueryClient` argument needed.

## `useDebouncedValue`

Pure utility — no React Query or HTTP-client dependency. Exported as a direct
named export only — it is not part of the `createHooks` return object, since it
has no HTTP-client dependency and including it there would muddy the factory's
contract.

```ts
import { useDebouncedValue } from '@quilla-fe-kit/api-client-react-query';

const debounced = useDebouncedValue(searchInput, 500);
```

## API surface

### Factories and accessors
- `createHooks(httpClient, config?)` → `Hooks`
- `createQueryClient(config)` → `QueryClient` _(throws on second call — singleton guard)_
- `getQueryClient()` → `QueryClient` _(throws if called before `createQueryClient`)_
- `queryInvalidator` — stable proxy; safe to import at module scope
- `getQueryInvalidator()` → `QueryInvalidator` _(throws if called before `createQueryClient`)_
- `resetQueryClient()` — clears the singleton guard; use in `beforeEach` in tests
- `createQueryKeys(domain)` → `QueryKeyFactory`

### Hooks (returned by `createHooks`, destructure and import by name)
- `useQueryBase<TRaw, TModel?, TError?>(baseKey, url, options?)`
- `usePostMutationBase<TData, TVars?, TError?>(url, options?)`
- `usePutMutationBase<TData, TBody?, TError?>(basePath, options?)`
- `usePatchMutationBase<TData, TBody?, TError?>(basePath, options?)`
- `useDeleteMutationBase<TData?, TVars?, TError?>(basePath, options?)`

### Helpers
- `buildOCCHeaders(resolver, vars)` — for custom mutations; reads from the singleton cache

### Types
- `QueryBaseResult<T>`, `QueryBaseInput`, `QueryBaseTuning`, `UseQueryBaseOptions<...>`
- `QueryInvalidator`
- `CreateQueryClientConfig`, plus the four event-handler aliases
- `IdAndBody<TBody>`, `VersionResolver<TVars>`, `InvalidateKeys<TVars, TData>`
- `QueryKeyFactory`
- Per-hook option types (`UsePostMutationOptions`, etc.)
- `HooksConfig`, `QueryTransformer`, `MutationTransformer`, `QueryTransformResult`

## Constraints and known limitations

### CSR / SPA only

The singleton `QueryClient` is safe because a browser process serves exactly
one user. It is **not** safe for server-side rendering, where a Node.js
process handles concurrent requests and a shared singleton would leak one
user's cache into another user's response.

If your app uses Next.js App Router, Remix, or any other SSR framework that
runs React Query on the server, do not use this package's singleton — create
`QueryClient` instances directly with `new QueryClient()` per request as
React Query's own SSR guide recommends.

The rest of this package (auth, token storage, `HttpClient`) is also built
around browser primitives (localStorage, cookies, token refresh), so the
CSR-only constraint is shared across the whole `@quilla-fe-kit` surface.

### One React root per process

The singleton guard allows exactly one `QueryClient` per JS module scope.
Two independently mounted React roots in the same page sharing the same
bundle would fight over the singleton — the second call to `createQueryClient`
throws. If your architecture requires two independent caches in the same
page, use Webpack or Vite module federation (each federated unit gets its
own module scope and its own singleton), or create `QueryClient` instances
directly without the factory.

### Vite HMR — hot-reloading the api layer

When Vite hot-replaces `lib/api.ts`, the module is re-evaluated and
`createQueryClient` runs again. If the factory module is not also replaced,
`_instance` is still set from the previous run and the second call throws.

Add a Vite HMR disposal hook to `lib/api.ts` to clear the guard before the
module is replaced:

```ts
export const queryClient = createQueryClient({ ... });

if (import.meta.hot) {
  import.meta.hot.dispose(() => resetQueryClient());
}
```

For Webpack, the equivalent is:
```ts
if (module.hot) {
  module.hot.dispose(() => resetQueryClient());
}
```

### `onMutationSuccess` fires before cache invalidation

The `onMutationSuccess` callback in `createQueryClient` is a
`MutationCache`-level handler. It fires in this order:

1. HTTP response received
2. `onMutationSuccess` ← fires here
3. `buildMutationOnSuccess` → `queryInvalidator.invalidate()` ← fires here

This means `onMutationSuccess` is not the right place for side effects that
depend on fresh cache data — the cache is still stale when it runs. Use the
`onSuccess` option on individual mutation hooks instead; it runs **after**
invalidation completes.

```ts
// onMutationSuccess: global UX only (toasts, logging) — cache is still stale
createQueryClient({
  onMutationSuccess: () => toast.success('Saved'), // fine
});

// onSuccess per-hook: runs after invalidation — cache is fresh
hooks.usePutMutationBase('/users', {
  invalidate: ({ id }) => [userKeys.detail(id)],
  onSuccess: () => router.push('/users'), // safe — cache already refreshed
});
```

## Module augmentation

Importing this package once anywhere in your app augments
`@tanstack/react-query`'s `Register` interface, giving you typed
`meta: { showSuccess, showWarning, customSuccessMessage, customErrorMessage }`
on queries (and `showError` on mutations).

You don't need to do anything to opt in beyond the import. If you want
explicit control, the augmentation is published in
[`src/query-meta.d.ts`](src/query-meta.d.ts) — copy it into your own
`*.d.ts` and customize the field shape.
