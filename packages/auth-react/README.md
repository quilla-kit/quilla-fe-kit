# @quilla-fe-kit/auth-react

React adapter for [`@quilla-fe-kit/auth`](../auth):

- **`AuthProvider`** — single source of auth state. Reads the access token
  from a `TokenStorage` on mount, decodes it into a `Principal`, and exposes
  `signIn(tokens)` / `signOut()`.
- **`useAuth()`** — `{ principal, isAuthenticated, isLoading, signIn, signOut }`.
  Throws if no provider is found — fail-fast wiring.
- **`<RequireAuth>`** — route guard that renders `fallback` when unauthenticated
  and `forbiddenFallback` when authenticated but missing a required role.
  Router-agnostic: pass any `ReactNode` (e.g. `<Navigate to="/login" />`).
- **`<ScopeGuard>` + `useHasScope()`** — role-gated rendering for buttons,
  menu items, and inline pieces of UI.
- **`defaultClaimsParser`** — parses JWTs in the `@quilla-kit` BE convention
  (`{ u: userId, si: scopeId, s?: scopes[] }`) into a `Principal`. Pluggable
  for apps with a different claim shape.

Runtime deps: `@quilla-fe-kit/auth`, `@quilla-fe-kit/api-client` (for the
`AuthSession` wire shape that `Principal` extends).
Peer deps: `react` ≥ 18.

**Zero external runtime deps.** JWT decoding is hand-rolled against
`globalThis.atob` — no `jwt-decode` dependency. The package only *decodes*
claims; signature verification is the BE's job.

## Install

```sh
pnpm add @quilla-fe-kit/auth-react \
         @quilla-fe-kit/auth \
         @quilla-fe-kit/api-client \
         react
```

Node 22+, ESM-only.

## Quick start

```tsx
import { AuthProvider, RequireAuth, useAuth } from '@quilla-fe-kit/auth-react';
import { localStorageTokenStorage } from '@quilla-fe-kit/auth';
import { Navigate, Routes, Route } from 'react-router-dom';

const storage = localStorageTokenStorage();

export const App = () => (
  <AuthProvider storage={storage}>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/dashboard"
        element={
          <RequireAuth fallback={<Navigate to="/login" replace />}>
            <Dashboard />
          </RequireAuth>
        }
      />
    </Routes>
  </AuthProvider>
);
```

## `AuthProvider`

```tsx
<AuthProvider
  storage={localStorageTokenStorage()}
  parseClaims={myCustomClaimsParser} // optional override
>
  <App />
</AuthProvider>
```

On mount it reads the access token from `storage`, runs it through
`parseClaims` (defaults to the `@quilla-kit` BE claim shape), and seeds the
context. If decoding fails it clears storage and stays unauthenticated.

> **Note:** the `storage` and `parseClaims` props must be stable across
> renders. Construct `storage` once at the composition root (module scope
> or a `useMemo`) — passing a new instance each render will trigger
> re-hydration in a loop. Same for a custom `parseClaims`.

The provider deliberately **does not own login**. Your login flow calls the
API itself (likely via `@quilla-fe-kit/api-client-react-query`) and hands the
returned tokens to `signIn`:

```tsx
const LoginPage = () => {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const loginMutation = usePostMutationBase<TokenPair, LoginBody>('/auth/login', {
    disabledAuth: true,
  });

  const onSubmit = async (creds: LoginBody) => {
    const tokens = await loginMutation.mutateAsync(creds);
    await signIn(tokens);
    navigate('/dashboard');
  };
  // ... form
};
```

This keeps credential shapes, error mapping, and refresh-token semantics out
of the toolkit. Apps with email/password login, magic links, or OAuth
callbacks all use the same primitive.

## `useAuth()`

```ts
const { principal, isAuthenticated, isLoading, signIn, signOut } = useAuth();

// principal: Principal | undefined
//   { userId: string; scopeId: string; scopes: readonly string[] }
```

Throws if called outside an `AuthProvider`.

## `<RequireAuth>` — route-level guard

Router-agnostic. Pass whatever your router uses as the fallback node:

```tsx
<RequireAuth
  fallback={<Navigate to="/login" replace state={{ from: location }} />}
  forbiddenFallback={<Navigate to="/forbidden" replace />}
  loadingFallback={<Spinner />}
  scopes={['admin', 'auditor']}
>
  <AdminPage />
</RequireAuth>
```

| Prop | Description |
| --- | --- |
| `fallback` | Rendered when unauthenticated. Required. |
| `forbiddenFallback` | Rendered when authenticated but `scopes` check fails. Default: `null`. |
| `loadingFallback` | Rendered while the provider is hydrating from storage. Default: `null`. |
| `scopes` | Optional. User passes if they hold **any** of these scopes (`some` semantics — typical RBAC route check). |

## `<ScopeGuard>` — render-level guard

For showing/hiding individual UI pieces (a "Delete" button, an admin menu
item):

```tsx
<ScopeGuard scopes={['users:write']}>
  <DeleteButton />
</ScopeGuard>

<ScopeGuard scopes={['billing:read', 'billing:write']} mode="some" fallback={<UpgradeCta />}>
  <BillingPanel />
</ScopeGuard>
```

| Prop | Description |
| --- | --- |
| `scopes` | List of required scopes. |
| `mode` | `'every'` (default) — user must hold all. `'some'` — user must hold at least one. |
| `fallback` | Optional alternative content. Default: `null`. |

## `useHasScope()`

The same check as `<ScopeGuard>`, returned as a boolean for use in handlers
and conditionals:

```ts
const canEdit = useHasScope(['users:write']);
const canSeeAdmin = useHasScope(['admin', 'auditor'], 'some');
```

## JWT claims and `Principal`

`Principal` extends `AuthSession` (the BE wire shape from
`@quilla-fe-kit/api-client`) with a `scopes` array:

```ts
type Principal = {
  readonly userId: string;
  readonly scopeId: string;
  readonly scopes: readonly string[];
};
```

The default parser expects the `@quilla-kit` BE claim shape — short,
deliberately opaque names so tokens don't telegraph the BE schema:

```ts
type JwtClaims = {
  u: string;          // userId
  si: string;         // scopeId
  s?: string[];       // scopes (RBAC) — optional
};
```

For non-default claim shapes, plug in your own parser:

```ts
import { decodeJwtPayload, type ClaimsParser } from '@quilla-fe-kit/auth-react';

const parseClaims: ClaimsParser = (token) => {
  const claims = decodeJwtPayload<{ sub: string; org: string; perms: string[] }>(token);
  if (!claims) return null;
  return { userId: claims.sub, scopeId: claims.org, scopes: claims.perms ?? [] };
};

<AuthProvider storage={storage} parseClaims={parseClaims}>
  <App />
</AuthProvider>
```

`decodeJwtPayload<T>(token)` is exported standalone if you need it outside
the provider — it returns `null` on malformed input rather than throwing.

## API surface

### Components
- `<AuthProvider storage parseClaims? children>`
- `<RequireAuth fallback scopes? forbiddenFallback? loadingFallback? children>`
- `<ScopeGuard scopes mode? fallback? children>`

### Hooks
- `useAuth() → AuthContextValue`
- `useHasScope(scopes, mode?) → boolean`

### Helpers
- `decodeJwtPayload<T>(token) → T | null`
- `defaultClaimsParser` — the BE-shape claim parser used by `AuthProvider`
  unless overridden.

### Types
- `Principal`, `JwtClaims`, `ClaimsParser`, `HasScopeMode`
- `AuthContextValue`, `AuthProviderProps`, `RequireAuthProps`, `ScopeGuardProps`

## Design notes

- **Provider owns no credentials, no error mapping, no login mutation.** It
  exposes `signIn(tokens)` / `signOut()` — callers wire their own login
  against `api-client`. This keeps the package decoupled from how a given
  app shapes its login (email/password, magic link, OAuth, SSO).
- **Guards are router-agnostic.** Fallbacks are `ReactNode`, not paths. The
  package has zero `react-router-dom` dependency.
- **No app-specific flags** like `mustChangePassword`. Compose your own
  guard on top of `<RequireAuth>` if you need that flow.
- **`scopes` semantics in `<RequireAuth>` is `some` (any-of).** This matches
  typical RBAC route checks ("admin OR auditor can see this page"). For
  all-of semantics on a single piece of UI, use `<ScopeGuard mode="every">`.
- **Claim names are deliberately short and opaque** (`u`, `si`, `s`).
  Tokens travel through proxies, browser devtools, and error logs — full
  field names like `userId`/`scopeId` would broadcast BE schema details.
  The `Principal` shape is verbose; the wire is not.
