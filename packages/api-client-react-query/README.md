# @quilla-fe-kit/api-client-react-query

React Query adapter for [`@quilla-fe-kit/api-client`](../api-client):

- **`createHooks(httpClient, config?)`** — binds all hooks to an `HttpClient` instance
  and optionally configures default response transformers for all queries and mutations.
  The client is an infrastructure detail: it never leaks into the component tree.
- **`createQueryClient(config?)`** — initialises the singleton `QueryClient`
  and returns it. Throws on a second call, and when `window` is undefined
  (CSR/SPA only). Typed-error retry policy, optional
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
- **Query meta module augmentation** — typed, app-extensible `meta: { showSuccess }`
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
  void queryInvalidator.invalidate([userKeys.detail(id), userKeys.lists()])
);
```

## `createQueryClient`

Initialises the singleton `QueryClient` and returns it. **Throws if called
more than once** — this is the singleton guard that prevents accidental
double-instantiation and the cache conflicts that follow.

**Throws when `window` is undefined** (`[quilla-fe-kit] createQueryClient is
CSR/SPA only…`) — i.e. during SSR, or in tests running without a DOM
environment such as jsdom. See [CSR / SPA only](#csr--spa-only).

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

  // Optional app-wide cache/refetch policy — see "Query defaults" below
  queryDefaults?: {
    staleTime?, gcTime?,
    refetchOnWindowFocus?, refetchOnReconnect?, refetchOnMount?,
    networkMode?,
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

`resetQueryClient()` clears both the query cache and mutation cache of the
active instance, then drops the internal reference. If your tests mount a
`QueryClientProvider`, tear down the component tree before or after calling it.

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
  // A useQueryBase read without query options is cached at [...baseKey, {}]
  queryClient.setQueryData([...userKeys.detail(1), {}], { data: {}, version: 5 });

  await act(() => result.current.mutateAsync({ id: 1, body: {} }));
  // invalidation also hits the singleton — consistent
});
```

### Retry policy

| Error class                                                  | Retries           |
| ------------------------------------------------------------ | ----------------- |
| `BadRequest`, `Unauthorized`, `Forbidden`, `NotFound`, `Validation`, `BusinessRule`, `Conflict`, `QuerySerializationError` | never (terminal client-side errors) |
| `NetworkError`                                               | up to `networkMaxAttempts` (default 1) |
| Other (incl. `InternalServerError`, unknown thrown values)   | up to `maxAttempts` (default 2)        |

Mutations never retry. (React Query default — preserved here.)

### Query defaults

Without `queryDefaults`, every query keeps TanStack's defaults — notably
`staleTime: 0`, so cached data is refetched on every remount, window refocus
and `enabled: false → true` change. Set the app-wide policy once:

```ts
export const queryClient = createQueryClient({
  queryDefaults: { staleTime: 30_000, refetchOnWindowFocus: false },
});
```

`queryDefaults` accepts cache/refetch options only (`staleTime`, `gcTime`,
`refetchOnWindowFocus`, `refetchOnReconnect`, `refetchOnMount`,
`networkMode`). It is merged with the kit's retry policy, which is configured
through `retry` and is never replaced. Options you leave out keep TanStack's
values.

**Precedence** — later wins:

1. `queryDefaults` (global)
2. `queryClient.setQueryDefaults(keyPrefix, options)` (per key family)
3. Options passed to the hook

Per key family is the natural fit for data that never changes — every query
under the prefix inherits it, including `useInfiniteQueryBase` queries on the
same base key:

```ts
const snapshotKeys = createQueryKeys('snapshots');
queryClient.setQueryDefaults(snapshotKeys.all(), { staleTime: Infinity });
```

Per hook, `staleTime` may be a function of the query. `query.state.data` is
the `QueryBaseResult<TModel>` (after transformer and mapper) — for
`useInfiniteQueryBase`, an `InfiniteData<QueryBaseResult<TModel>>`:

```ts
useQueryBase<Snapshot>(snapshotKeys.detail(id), `/snapshots/${id}`, {
  // Cache a successful read forever; keep an "unavailable" result refetchable.
  staleTime: (query) => (query.state.data?.data.available ? Infinity : 0),
});
```

**`Infinity` vs `'static'`.** A query with `staleTime: Infinity` still honours
invalidation — the mutation `invalidate` option refetches it when active, or
on its next mount. A `'static'` query (where your TanStack version supports
it) is never stale: invalidation does not refetch it, nor do mount, focus or
reconnect, so the `invalidate` option has no effect on it. Use `'static'`
per hook or per key family for truly immutable data — never as
`queryDefaults.staleTime`.

#### Changing defaults after `createQueryClient`

Prefer `queryDefaults` whenever the values are known at startup. If you must
change them at runtime, note that TanStack's `setDefaultOptions` **replaces**
the whole defaults object — a bare call silently drops the kit's retry policy
and `mutations.retry: false`. Always merge:

```ts
const defaults = queryClient.getDefaultOptions();
queryClient.setDefaultOptions({
  ...defaults,
  queries: { ...defaults.queries, staleTime: 30_000 },
});
```

`resetQueryClient()` discards the client, so runtime changes must be
re-applied after the next `createQueryClient` (tests, HMR). `queryDefaults`
is re-applied automatically because it travels with the config.

### Wiring meta-driven UX

The package augments React Query's `Register` interface so query / mutation
`meta` is typed with a default vocabulary:

```ts
meta: {
  showSuccess?: boolean;
  showWarning?: boolean;
  customSuccessMessage?: string;
  customErrorMessage?: string;
  showError?: boolean;          // mutations only
}
```

The kit never reads `meta`; your `createQueryClient` callbacks give each
field its meaning:

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

### Adding your own meta fields

Add app-specific fields by merging them into `MutationMetaExtensions` (or
`QueryMetaExtensions` for queries). They are typed everywhere `meta` is —
at the call site and in your global callbacks — alongside the default
vocabulary:

```ts
// src/lib/query-meta.ts
import '@quilla-fe-kit/api-client-react-query';

declare module '@quilla-fe-kit/api-client-react-query' {
  interface MutationMetaExtensions {
    successDetail?: string; // second line for a success notification
    trackEvent?: string;    // analytics event to record on success
  }
}
```

```ts
const update = usePutMutationBase<User, UpdateUserBody>('/users', {
  meta: { showSuccess: true, successDetail: 'Changes are visible to your team.', trackEvent: 'user.updated' },
});

export const queryClient = createQueryClient({
  onMutationSuccess: (_data, mutation) => {
    const meta = mutation.meta;
    if (meta?.showSuccess) {
      toast.success(meta.customSuccessMessage ?? 'Saved', { description: meta.successDetail });
    }
    if (meta?.trackEvent) analytics.track(meta.trackEvent);
  },
});
```

Query and mutation extensions are independent: a field you need on both
sides is declared in both interfaces.

- The file holding the `declare module` block must be a module (it has an
  `import` or `export`) and be included by your `tsconfig`. Otherwise the
  extension can be silently ignored.
- Extend through these interfaces; don't redeclare `Register.queryMeta` /
  `Register.mutationMeta` yourself — it won't compile.
- Don't redeclare a default-vocabulary key with a different type — `meta`
  stops compiling. Add a new key instead.
- Unknown keys in a `meta` literal are still compile errors, so typos are
  caught.
- To type your own helpers that receive meta, use `QueryMeta` /
  `MutationMeta` from `@tanstack/react-query`. They resolve to the registered
  types, extensions included.

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
  void queryInvalidator.invalidate([userKeys.lists(), userKeys.detail(id)])
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

Before `createQueryClient`, both fail with a clear message:
`getQueryInvalidator()` and `queryInvalidator.clear()` throw synchronously,
while `queryInvalidator.invalidate()` returns a rejected promise.

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

### `query.extra` — arbitrary parameters

`search`, `filter`, `page`, `limit` and `sort` are the shapes the serializer
understands (see *Query-string conventions* in `@quilla-fe-kit/api-client`).
Anything else goes in `extra`, which is merged flat into the query string:

```ts
query: { page: 1, extra: { includeArchived: true, projection: 'summary' } },
// → page=1&includeArchived=true&projection=summary
```

The typed fields **win** on a key collision: `extra: { page: 99 }` alongside
`page: 1` sends `page=1`. `extra` still supplies any key the typed fields leave
unset. To change the *names* of the paging parameters on the wire, configure
`paginationKeys` / `searchSuffix` on the client's `querySerializer` rather than
routing around them through `extra`.

`transformer` overrides the factory-level `queryTransformer` for this specific
call. Use it when one endpoint returns a different envelope shape than the rest.
See [Response transformers](#response-transformers) for the full pattern.

### Request cancellation

`useQueryBase` forwards TanStack's `AbortSignal` to the HTTP client, so React
Query's built-in cancellation now reaches the network: a superseded query (key
change), an inactive one, and `queryClient.cancelQueries(...)` all abort the
in-flight request instead of merely discarding its result.

This matters for read-heavy screens where a user switches targets faster than
the server responds — previously every superseded request stayed in flight and
occupied a connection slot.

An aborted request surfaces as `NetworkError`, but React Query settles the query
as cancelled first, so the default retry policy does **not** retry it. If you
call `client.request` directly with your own signal, pass `timeoutMs` too if you
want both: `composeSignal` merges them with `AbortSignal.any`.

## `useInfiniteQueryBase`

The accumulating counterpart to `useQueryBase`, for walking successive pages of
**one** query key — a catalogue, a feed, a result set — so the accumulation lives
in the query cache instead of a store you maintain yourself. It carries the same
mapper, transformer, envelope, debounce and cancellation handling.

It is not a general merge layer. Assembling a single view from *heterogeneous*
request shapes — different endpoints, different payload shapes, joined into a
tree — is not page accumulation: each shape wants its own cache entry, and the
joining is application state that belongs in your own store. Use this hook for
the paging parts and keep the assembly outside it.

```ts
type PagedFrames = { items: Frame[]; pagination: { totalPages: number } };

const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
  hooks.useInfiniteQueryBase<PagedFrames, PagedFrames, Error, { page: number }>(
    frameKeys.lists(),
    '/frames',
    {
      query: { limit: 20, filter: { status: 'active' } },
      initialPageParam: { page: 1 },
      getNextPageParam: (page, allPages, pageParam) =>
        allPages.length < page.pagination.totalPages ? { page: pageParam.page + 1 } : undefined,
    },
  );

const frames = data?.pages.flatMap((p) => p.data.items) ?? [];
```

`getNextPageParam` / `getPreviousPageParam` receive each page's `TModel` — the
value after transformer and `mapper` — not the raw envelope or the
`{ data, version }` wrapper. Whatever the callback needs (pagination block,
cursor) must survive the mapper.

`data.pages` is an array of `QueryBaseResult<TModel>` — the same `{ data, version }`
shape `useQueryBase` returns, one per page. Flattening is yours to do, because
only you know whether pages concatenate, merge or dedupe.

### Choosing the backend's param name

The kit does not impose a pagination vocabulary. There are three routes to the
param name your API expects:

| Route | Page param | Wire result |
|---|---|---|
| Canonical dimensions | `{ page: 2, limit: 20 }` | `page=2&pageSize=20` (renamed by `paginationKeys`) |
| Any other name | `{ cursor: 'c2' }` | `cursor=c2` (verbatim) |
| Explicit bag | `{ extra: { after: 'x' } }` | `after=x` (verbatim) |

**Canonical** — `page`, `limit` and `sort` are the kit's internal names, remapped
on the wire by the client's `paginationKeys`:

```ts
createHttpClient({ baseUrl, querySerializer: { paginationKeys: { page: 'p', limit: 'size', sort: 'order' } } });

hooks.useInfiniteQueryBase<Paged>(keys.lists(), '/frames', {
  initialPageParam: { page: 1, limit: 20 },
  getNextPageParam: (page, all, param) => ({ page: (param.page ?? 1) + 1 }),
});
// → /frames?p=1&size=20, then /frames?p=2&size=20
```

**Any other name** — cursor-based or non-English vocabularies are first-class and
need no `extra` wrapper:

```ts
hooks.useInfiniteQueryBase<CursorPage>(keys.lists(), '/graph', {
  initialPageParam: { cursor: null as string | null },
  getNextPageParam: (page) => (page.next ? { cursor: page.next } : undefined),
});
// → /graph (null params are omitted), then /graph?cursor=c2

hooks.useInfiniteQueryBase<Paged>(keys.lists(), '/frames', {
  initialPageParam: { pagina: 1 },
  getNextPageParam: (page) => ({ pagina: page.pagina + 1 }),
});
// → /frames?pagina=1, then /frames?pagina=2
```

**Explicit bag** — use `extra` when a key would collide with a canonical name, or
when the page param is built dynamically.

### Precedence

Later wins:

```
query.extra  <  query.{search,filter,page,limit,sort}  <  pageParam.extra  <  pageParam.{named keys}
```

The page param beating the seed query is the point of paging: `query: { page: 1 }`
with `initialPageParam: { page: 7 }` requests page 7.

### `version` is per page

Each page carries the `version` parsed from that response's ETag. There is no
aggregate version — N ETags have no meaningful join. Note that setting `maxPages`
lets React Query evict pages, and an evicted page takes its `version` with it, so
don't treat `pages[i].version` as a durable OCC token for a row.

### Query keys

The hook appends an `'infinite'` segment to whatever `baseKey` you pass, so an
infinite query and a `useQueryBase` list sharing a base key cannot collide on one
cache entry with two incompatible shapes. Pass the same key you would give
`useQueryBase` — typically `keys.lists()` — and the cache entry becomes
`[domain, 'list', 'infinite', params]`.

Because the segment is appended rather than replacing anything, existing prefix
invalidation keeps working: `all()` and `lists()` both still match. To target only
the infinite queries, build the prefix yourself:

```ts
queryInvalidator.invalidate([[...userKeys.lists(), INFINITE_KEY_SEGMENT]]);
```

### What you supply, what the kit owns

You supply `initialPageParam`, `getNextPageParam` (optionally
`getPreviousPageParam`), a transformer that folds your envelope — pagination block
included — into `TRaw`, a `TModel` (after any `mapper`) that still carries what the
page-param callbacks read, and the flattening of `data.pages`.

The kit owns debounce and search gating, `enabled` inference, the precedence rules
above, query-key construction, mapping the page param onto flat wire fields, the
per-page ETag `version`, `AbortSignal` forwarding, and transformer resolution. It
never inspects your envelope.

**Known limitation:** a cursor delivered in a *response header* (`Link`,
`X-Next-Cursor`) is not visible to `getNextPageParam` — only the ETag is read from
headers. Cursors must be in the response body.

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

### How the request URL is built

PUT, PATCH and DELETE take a `basePath` and resolve the URL in this order:

1. **`resolveUrl(vars)`**, if supplied — its result is used **verbatim**.
2. **Placeholders in `basePath`** — any `/:name/` segment is substituted.
3. **Neither** — the id is appended: `` `${basePath}/${id}` ``.

Substituted values are percent-encoded by the kit. `resolveUrl` output is not
touched — the caller built the string, so the caller owns its encoding.

Placeholder names are free-form and are resolved against the mutation variables
themselves, with `params` taking precedence:

```ts
// 3. Append (the default)
usePutMutationBase<User, UpdateUserBody>('/users');
mutate({ id: 42, body });                      // → PUT /users/42

// 2a. Identifier mid-path
usePutMutationBase<Claim, SettleBody>('/claims/:id/settle');
mutate({ id: 42, body });                      // → PUT /claims/42/settle

// 2b. Free-form names, several of them
useDeleteMutationBase<void, { orgId: string; seatId: number }>(
  '/orgs/:orgId/seats/:seatId',
);
mutate({ orgId: 'acme', seatId: 9 });          // → DELETE /orgs/acme/seats/9

// 2c. Free-form name alongside an id (PUT/PATCH vars are always `{ id, body?, params? }`)
usePutMutationBase<Claim, SettleBody>('/claims/:claimId/settle');
mutate({ id: 42, params: { claimId: 42 }, body });

// 1. Anything the template can't express
usePutMutationBase<Claim, SettleBody>('/claims', {
  resolveUrl: ({ id }) => `/claims/${id};v=2/settle`,
});
```

`occ`, `invalidate`, `headers` and `transformer` are unaffected by which branch
builds the URL — they all receive the same `vars`.

A placeholder that resolves to `undefined`, `null` or `''` throws a `[url]`
error naming it, and so does an appended id that is missing. The throw happens
inside `mutationFn`, so it surfaces as a rejected mutation, not a render error.

POST takes a fixed `url` rather than a `basePath` (there is no id yet), but it
accepts `resolveUrl` for routes that interpolate something from the body.

### POST

```ts
const create = usePostMutationBase<CreatedUser, CreateUserBody>('/users');
create.mutate({ name: 'Ada' });

// Nested creation: derive the path from the variables
const addMember = usePostMutationBase<Member, { orgId: string; email: string }>('/members', {
  resolveUrl: ({ orgId }) => `/orgs/${orgId}/members`,
});

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

```ts
usePatchMutationBase<User, PartialUserBody>('/users');
// PATCH /users/123

usePatchMutationBase<Seat, SeatBody>('/orgs/:id/seats');
// PATCH /orgs/acme/seats
```

### DELETE

```ts
// Variables can be a primitive id...
const remove = useDeleteMutationBase<void, string>('/users');
remove.mutate('user-1');

// ...or { id } for OCC
const safeRemove = useDeleteMutationBase<void, { id: number }>('/users', {
  occ: { versionKey: ({ id }) => userKeys.detail(id) },
});
safeRemove.mutate({ id: 1 });

// ...or any shape at all, when the path names its own placeholders
const removeSeat = useDeleteMutationBase<void, { orgId: string; seatId: number }>(
  '/orgs/:orgId/seats/:seatId',
);
removeSeat.mutate({ orgId: 'acme', seatId: 9 });
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

`useInfiniteQueryBase` appends an `'infinite'` segment to the key you give it, so
passing `lists()` yields `['users', 'list', 'infinite', params]` — still matched by
both `all()` and `lists()`.

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

Every `useQueryBase` read is cached under `[...baseKey, params]`. `params` is
`{}` when the read's query options add nothing, so a plain detail read
`useQueryBase(userKeys.detail(id), …)` lives at `[...userKeys.detail(id), {}]`.
Beyond that, the shape of `params` is unspecified — target these entries
with a `baseKey` prefix rather than rebuilding `params`.

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

PUT, PATCH and DELETE hooks accept `occ: { versionKey }`. `versionKey`
returns the key of one cache entry shaped as `QueryBaseResult<T>` (the
result of `useQueryBase`); it is never prefix-matched:

```ts
type QueryBaseResult<T> = {
  data: T;
  version: number | null; // populated from response ETag
};
```

The OCC helper reads `version` from that entry and stamps
`If-Match: "<version>"` on the mutation request.

**Lookup.** The key is tried exactly first. If nothing is cached there (and
you haven't supplied `extractVersion`), the kit tries `[...key, {}]` once —
the key of a `useQueryBase` read without query options (see
[Wiring with `useQueryBase`](#wiring-with-usequerybase)). So for a plain
detail read both forms work:

```ts
useQueryBase<User>(userKeys.detail(id), `/users/${id}`);

occ: { versionKey: ({ id }) => userKeys.detail(id) }            // resolves via [...key, {}]
occ: { versionKey: ({ id }) => [...userKeys.detail(id), {}] }   // resolves exactly
```

If the read passes query options, `versionKey` must return that read's full
key. In practice, guard writes with a detail read that has no query options.

**No version, no request.** If the entry is missing, still loading, or its
`version` is `null`, the mutation rejects with
`[OCC] Could not resolve version from cache for key …` (listing every key it
tried) before the request is sent.

**Refreshing the version.** The cached version changes only when the entry
is refetched — a mutation response's `ETag` is not written to the cache.
Pass `invalidate` with the entry's key (or a prefix of it): an active read is
refetched before `mutateAsync` resolves. Inactive entries, and reads with
`staleTime: 'static'`, keep the old version until they are next fetched. A
stale version is rejected by the server and surfaces as `ConflictError` (or
its subclass `OptimisticLockError`).

For cache entries that are not `QueryBaseResult`-shaped, supply
`extractVersion`. With a custom extractor only the exact key is read — there
is no `[...key, {}]` fallback:

```ts
useDeleteMutationBase<void, { id: number }>('/users', {
  occ: {
    versionKey: ({ id }) => userKeys.detail(id),
    extractVersion: (cached) => (cached as { rev: number } | undefined)?.rev ?? null,
  },
});
```

The `buildOCCHeaders(resolver, vars)` helper is also exported if you need
to compose your own mutation hooks. It applies the same lookup and reads the
version from the singleton cache internally — no `QueryClient` argument
needed.

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
- `createQueryClient(config?)` → `QueryClient` _(throws on second call — singleton guard — and when `window` is undefined)_
- `queryInvalidator` — stable proxy; safe to import at module scope
- `getQueryInvalidator()` → `QueryInvalidator` _(throws if called before `createQueryClient`)_
- `resetQueryClient()` — clears both caches and the singleton guard; use in `beforeEach` in tests and in HMR `dispose` handlers
- `createQueryKeys(domain)` → `QueryKeyFactory`

### Hooks (returned by `createHooks`, destructure and import by name)
- `useQueryBase<TRaw, TModel?, TError?>(baseKey, url, options?)`
- `useInfiniteQueryBase<TRaw, TModel?, TError?, TPageParam?>(baseKey, url, options)`
- `usePostMutationBase<TData, TVars?, TError?>(url, options?)`
- `usePutMutationBase<TData, TBody?, TError?>(basePath, options?)`
- `usePatchMutationBase<TData, TBody?, TError?>(basePath, options?)`
- `useDeleteMutationBase<TData?, TVars?, TError?>(basePath, options?)`

### Helpers
- `buildOCCHeaders(resolver, vars)` — for custom mutations; reads from the singleton cache
- `resolveMutationUrl(basePath, vars)` — the placeholder/append URL ladder, for custom mutations. A primitive `vars` is treated as the id; an object-valued placeholder throws `[url] … resolved to a non-scalar value`; trailing slashes on `basePath` are trimmed before the id is appended
- `applyMutationTransformer<TData>(data, transformer)` — applies a `MutationTransformer` (or passes `data` through when it is `undefined`), for custom mutations

### Types
- `QueryBaseResult<T>`, `QueryBaseInput`, `QueryBaseTuning`, `UseQueryBaseOptions<...>`
- `QueryBasePageParam`, `QueryBasePageParamFn<...>`, `UseInfiniteQueryBaseOptions<...>`
- `QueryInvalidator`
- `CreateQueryClientConfig`, `QueryDefaults`
- `QueryEventHandler`, `QuerySuccessHandler`, `MutationEventHandler`, `MutationSuccessHandler` — the `onQueryError` / `onQuerySuccess` / `onMutationError` / `onMutationSuccess` callback types
- `IdAndBody<TBody>`, `VersionResolver<TVars>`, `InvalidateKeys<TVars, TData>`, `UrlResolver<TVars>`
- `QueryKeyFactory`, `INFINITE_KEY_SEGMENT`
- Per-hook option types (`UsePostMutationOptions`, etc.)
- `HooksConfig`, `QueryTransformer`, `MutationTransformer`, `QueryTransformResult`
- `SharedMeta`, `QuillaMutationMeta`, `QueryMetaExtensions`, `MutationMetaExtensions`

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

`createQueryClient` enforces this: it throws
`[quilla-fe-kit] createQueryClient is CSR/SPA only…` when `window` is
undefined. That also applies to tests — run them in a DOM environment
(e.g. Vitest's `environment: 'jsdom'`).

The rest of the `@quilla-fe-kit` packages (auth, token storage, `HttpClient`) are also built
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

You don't need to do anything to opt in beyond the import. To add your own
fields, merge them into `QueryMetaExtensions` / `MutationMetaExtensions` —
see [Adding your own meta fields](#adding-your-own-meta-fields).

`SharedMeta` and `QuillaMutationMeta` are exported if you want to reference
the default vocabulary explicitly. TanStack's `QueryMeta` / `MutationMeta`
are the full registered types, including your extensions.

**Requires an ESM-typed project.** The augmentation targets
`@tanstack/react-query`'s ESM type declarations. If TypeScript treats your
files as CommonJS — `"moduleResolution": "NodeNext"` (or `"Node16"`) without
`"type": "module"` in your `package.json` — it resolves TanStack's CommonJS
declarations instead, and `meta` falls back to an untyped
`Record<string, unknown>`, with no compile error. Use
`"moduleResolution": "Bundler"` (the usual choice for bundled frontends) or
add `"type": "module"`.
