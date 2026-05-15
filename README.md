# quilla-fe-kit

**A TypeScript toolkit for consuming substrate-grade APIs from the frontend, designed to pair with [`quilla-kit`](https://github.com/quilla-kit/quilla-kit) on the backend.**

If `quilla-kit` is the keel — the structural backbone the backend is built around — then `quilla-fe-kit` is the rigging: small, composable pieces a frontend project picks from to talk to that backbone without boilerplate.

**Status:** pre-1.0. APIs are allowed to break on minor bumps. Independent versioning per package.

---

## Why quilla-fe-kit

- **Wire-aligned with `quilla-kit`, but not coupled to it.** The two halves agree on HTTP envelopes, error codes, OCC headers, and pagination conventions. They share *zero code* — no `@quilla-kit/*` runtime dep on the FE side. Drift is prevented by docs, not by a coupled lifecycle.
- **Toolkit pick-and-mix.** Errors, auth, and HTTP transport are separate packages because they're useful in isolation. Use `@quilla-fe-kit/auth`'s cookie adapter with axios. Use `@quilla-fe-kit/errors` as your domain-error base, with no HTTP client at all. Take the pieces you need.
- **No framework lock-in.** The HTTP client is framework-agnostic. The React Query adapter is a separate package; SWR, Vue Query, and Solid Query adapters follow the same pattern when they ship. Frameworks are peer dependencies, never bundled.
- **Browser, Node, and edge-safe.** Reads `globalThis.fetch` / `globalThis.crypto`. No module-load env reads. No singletons. Multiple clients per app supported.
- **Extracted from real production code.** Every piece earned its seat by recurring across production frontends — single-flight refresh, OCC-via-`If-Match`, debounced search, and explicit-over-magic cache resolution for mutations.

## Who this is for

Senior frontend engineers building production SPAs, SSR apps, or React-Native clients against `@quilla-kit` backends — especially apps with multi-tenant scope (`scopeId`), DDD-aligned aggregates with optimistic concurrency, or auth flows that need rotating refresh tokens. If you've built one frontend on top of a custom HTTP client, single-flight refresher, and React Query base hook, you've already converged on the shape of this toolkit.

## 30-second example

A typical authenticated app:

```tsx
import { createHttpClient } from '@quilla-fe-kit/api-client';
import {
  HttpClientProvider,
  createQueryClient,
  useQueryBase,
  usePutMutationBase,
} from '@quilla-fe-kit/api-client-react-query';
import { localStorageTokenStorage } from '@quilla-fe-kit/auth';
import { QueryClientProvider } from '@tanstack/react-query';

const httpClient = createHttpClient({
  baseUrl: 'https://api.example.com',
  storage: localStorageTokenStorage(),
  refreshEndpoint: async (refreshToken) => {
    const res = await fetch('/auth/refresh', {
      method: 'POST',
      headers: { Authorization: `Bearer ${refreshToken}` },
    });
    return res.json(); // { access, refresh }
  },
});

const queryClient = createQueryClient({
  onMutationSuccess: (_data, mutation) => {
    if (mutation.meta?.showSuccess) toast.success('Saved');
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <HttpClientProvider client={httpClient}>
      <UserProfile id={1} />
    </HttpClientProvider>
  </QueryClientProvider>
);

const UserProfile = ({ id }: { id: number }) => {
  const { data, isLoading } = useQueryBase<User>(['users', id], `/users/${id}`);
  const update = usePutMutationBase<User, UpdateUserBody>('/users', {
    occ: { versionKey: ({ id }) => ['users', id] },
    meta: { showSuccess: true },
  });

  if (isLoading) return <Spinner />;

  return (
    <Form
      initial={data?.data}
      onSubmit={(body) => update.mutate({ id, body })}
    />
  );
};
```

End-to-end: `Authorization: Bearer` attached automatically, single-flight refresh on 401 retry, `If-Match` header attached automatically on PUT (via the cached version from the previous GET), `412 → ConflictError` mapping, mutation-meta-routed toast — wired from primitives, not inherited from a framework.

## Packages

Four packages, organized as toolkit building blocks. Pick what you need.

**Foundation — independent of HTTP**
- [`@quilla-fe-kit/errors`](packages/errors) — `QuillaFeError` base + `QuillaFeHttpError` subclass + 9 concrete classes (`BadRequestError`, `UnauthorizedError`, `ForbiddenError`, `NotFoundError`, `ConflictError`, `ValidationError`, `BusinessRuleError`, `InternalServerError`, `NetworkError`). `Symbol.for`-branded `is()` for cross-realm safety, JSON serialization, native `cause` chaining.
- [`@quilla-fe-kit/auth`](packages/auth) — `TokenStorage` interface plus three default adapters: `memoryTokenStorage()`, `localStorageTokenStorage()`, `cookieTokenStorage()` (with `Secure` / `SameSite` defaults). Browser-only globals are guarded.

**HTTP client**
- [`@quilla-fe-kit/api-client`](packages/api-client) — framework-agnostic, layered. `FetchHttpClient` + `AuthenticatedHttpClient` + `createHttpClient` factory. Single-flight token refresh, pluggable `HttpErrorParser`, configurable `QueryStringSerializer`, OCC helpers. Owns the BE wire-contract types internally.

**Framework adapters**
- [`@quilla-fe-kit/api-client-react-query`](packages/api-client-react-query) — React Query adapter. `createQueryClient` with typed-error retry policy, `HttpClientProvider`, `useQueryBase`, four mutation base hooks with explicit OCC `versionKey` resolution. No baked-in toast library — `onError`/`onSuccess` callbacks.

Future framework adapters (`api-client-swr`, `api-client-vue-query`, `api-client-solid-query`) follow the same pattern: separate packages, each with its own framework peer dep.

## Architectural invariants

These are the contracts the toolkit guarantees:

1. **Zero `@quilla-kit/*` runtime dependencies.** Wire types are re-declared inside `@quilla-fe-kit/api-client`. The BE `@quilla-kit/http` README is the source of truth for the wire format; FE↔BE drift is prevented by docs, never by a code dependency.
2. **No module-load env reads.** All configuration arrives via `createHttpClient(config)` / `createQueryClient(config)` factories. No `process.env.X` at module scope. No singletons.
3. **Auth is a decorator, not baked in.** `AuthenticatedHttpClient` wraps any `HttpClient`. Per-request `disabledAuth: true` skips it for login / refresh / public endpoints. Want a different transport? Swap the inner client.
4. **Adapters are separate packages.** A team that uses Vue Query gets zero React code on disk. Each adapter has its own framework peer dep and evolves on its own cadence.
5. **OCC uses numeric `version` via RFC-7232 headers.** `If-Match` on requests, `ETag` on responses. No body fields, no prefix-matching cache lookups. Mutations require an explicit `versionKey` resolver — no magic.
6. **Browser + Node + edge safe.** Platform globals read via `globalThis`. Browser-only adapters (`localStorage`, `cookie`) throw a clear error on missing globals — at call time, not module load.

## Install

All packages publish under `@quilla-fe-kit/*` on npm. ESM-only. Node 22+.

```sh
# HTTP client + auth + errors (the common starting point)
pnpm add @quilla-fe-kit/api-client @quilla-fe-kit/errors @quilla-fe-kit/auth

# React Query adapter
pnpm add @quilla-fe-kit/api-client-react-query @tanstack/react-query react

# Or just the building blocks you need
pnpm add @quilla-fe-kit/errors           # error hierarchy only
pnpm add @quilla-fe-kit/auth             # token-storage adapters only
```

Every package has its own README with full API, design notes, and examples — start there once you've picked which pieces you need.

## Wire-format alignment with `@quilla-kit`

The FE serializer defaults match the BE parser exactly:

| Convention            | Default            | BE parser                            |
| --------------------- | ------------------ | ------------------------------------ |
| Search suffix         | `__contains`       | `field__contains` operator delimiter |
| Pagination — `page`   | `page=N`           | `page` query param                   |
| Pagination — `limit`  | `pageSize=N`       | `pageSize` query param               |
| Pagination — `sort`   | `sort=field:asc`   | `sort` query param, repeatable       |
| Filter equality       | bare key (`status=active`) | bare key                     |
| Default page size     | `20`               | `DEFAULT_PAGE_SIZE = 20`             |

All overridable per-client via `createHttpClient({ querySerializer })`.

The error envelope, OCC token shape (`number`), `If-Match` / `ETag` headers, and `AuthSession` `{ scopeId, userId }` shape all mirror their BE counterparts. See each package's README for the wire details.

## Contributing

```sh
pnpm install
pnpm build       # tsc -b across the workspace
pnpm typecheck   # typecheck tests/ against src/
pnpm test        # vitest
pnpm lint        # biome check
```

Every PR that changes published behavior of a `@quilla-fe-kit/*` package adds a changeset. Independent versioning per package; pre-1.0 features bump minor (`0.1.0 → 0.2.0`).

## License

[MIT](LICENSE)
