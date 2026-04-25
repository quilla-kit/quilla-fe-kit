# @quilla-fe-kit/api-client-react-query

React Query adapter for [`@quilla-fe-kit/api-client`](../api-client):

- **`createQueryClient(config)`** — typed-error retry policy, optional
  callback hooks for global UX (no toast lib coupling).
- **`HttpClientProvider` + `useHttpClient`** — context that surfaces the
  `HttpClient` to every hook in the tree.
- **`useQueryBase`** — wraps `useQuery` with debounced search filters,
  pagination + sort state, stable cache keys, and ETag-based version
  extraction.
- **`usePostMutationBase` / `usePutMutationBase` / `usePatchMutationBase` /
  `useDeleteMutationBase`** — HTTP-method-specific mutation helpers with
  explicit OCC `versionKey` resolution.
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

```tsx
import { createHttpClient } from '@quilla-fe-kit/api-client';
import {
  HttpClientProvider,
  createQueryClient,
} from '@quilla-fe-kit/api-client-react-query';
import { localStorageTokenStorage } from '@quilla-fe-kit/auth';
import { QueryClientProvider } from '@tanstack/react-query';

// 1. Configure once, at the app composition root.
const httpClient = createHttpClient({
  baseUrl: 'https://api.example.com',
  storage: localStorageTokenStorage(),
  refreshEndpoint: async (refreshToken) => { /* ... */ },
});

const queryClient = createQueryClient({
  onQueryError: (err) => myToast.error(err.message),
  onMutationSuccess: (_data, mutation) => {
    if (mutation.meta?.showSuccess) myToast.success('Saved');
  },
});

// 2. Wrap your tree.
export const App = () => (
  <QueryClientProvider client={queryClient}>
    <HttpClientProvider client={httpClient}>
      <Routes />
    </HttpClientProvider>
  </QueryClientProvider>
);

// 3. Use the hooks.
import { useQueryBase, usePutMutationBase } from '@quilla-fe-kit/api-client-react-query';

const UserProfile = ({ id }: { id: number }) => {
  const { data, isLoading } = useQueryBase<User>(['users', id], `/users/${id}`);
  const updateUser = usePutMutationBase<User, UpdateUserBody>('/users', {
    occ: { versionKey: ({ id }) => ['users', id] },
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

## `HttpClientProvider` + `useHttpClient`

Surfaces a single `HttpClient` to every hook in the tree. `useHttpClient()`
throws if no provider is found — fail-fast wiring.

```tsx
<HttpClientProvider client={httpClient}>
  <App />
</HttpClientProvider>

// In any descendant
const client = useHttpClient(); // typed as HttpClient
```

Multiple clients can be supported by nesting providers, but each subtree
only sees one. Most apps want one provider at the root.

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
  occ: { versionKey: ({ id }) => ['users', id] },
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
  occ: { versionKey: ({ id }) => ['users', id] },
});
safeRemove.mutate({ id: 1 });
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
    versionKey: ({ id }) => ['users', id],
    extractVersion: (cached) => (cached as { rev: number } | undefined)?.rev ?? null,
  },
});
```

The `buildOCCHeaders(queryClient, resolver, vars)` helper is also exported
if you need to compose your own mutation hooks.

## `useDebouncedValue`

Re-exported because it's small and useful. Pure utility — no React Query
or HTTP-client dependency.

```ts
import { useDebouncedValue } from '@quilla-fe-kit/api-client-react-query';

const debounced = useDebouncedValue(searchInput, 500);
```

## API surface

### Factory + provider
- `createQueryClient(config)`
- `HttpClientProvider`, `useHttpClient`

### Hooks
- `useQueryBase<TRaw, TModel?, TError?>(baseKey, url, options?)`
- `usePostMutationBase<TData, TVars?, TError?>(url, options?)`
- `usePutMutationBase<TData, TBody?, TError?>(basePath, options?)`
- `usePatchMutationBase<TData, TBody?, TError?>(basePath, options?)`
- `useDeleteMutationBase<TData?, TVars?, TError?>(basePath, options?)`
- `useDebouncedValue<T>(value, delayMs)`

### Helpers
- `buildOCCHeaders(queryClient, resolver, vars)` — for custom mutations

### Types
- `QueryBaseResult<T>`, `QueryBaseInput`, `QueryBaseTuning`, `UseQueryBaseOptions<...>`
- `CreateQueryClientConfig`, plus the four event-handler aliases
- `IdAndBody<TBody>`, `VersionResolver<TVars>`
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
