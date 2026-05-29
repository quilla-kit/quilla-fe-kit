# @quilla-fe-kit/auth-react

React adapter for [`@quilla-fe-kit/auth`](../auth):

- **`AuthProvider`** — single source of auth state. Reads the access token
  from a `TokenStorage` on mount, runs it through your `fromClaims` mapper
  to produce a `Principal`, and exposes `signIn(tokens)` / `signOut()`.
- **`useAuth()`** — `{ principal, isAuthenticated, isLoading, signIn, signOut }`.
  Throws if no provider is found — fail-fast wiring.
- **`<RequireAuth>`** — route guard that renders `fallback` when unauthenticated
  and `forbiddenFallback` when authenticated but missing a required scope.
  Router-agnostic: pass any `ReactNode` (e.g. `<Navigate to="/login" />`).
- **`<ScopeGuard>` + `useHasScope()`** — scope-gated rendering for buttons,
  menu items, and inline pieces of UI.

Runtime deps: `@quilla-fe-kit/auth`, `@quilla-fe-kit/api-client` (for the
`AuthSession` wire shape that `Principal` extends).
Peer deps: `react` ≥ 18.

**Zero external runtime deps.** JWT decoding is hand-rolled in
`@quilla-fe-kit/auth`. The package only *decodes* claims; signature
verification is the BE's job.

## Install

```sh
pnpm add @quilla-fe-kit/auth-react \
         @quilla-fe-kit/auth \
         @quilla-fe-kit/api-client \
         react
```

Node 22+, ESM-only.

## The `fromClaims` contract

`auth-react` ships **no opinion** about your JWT claim shape. You provide
a `fromClaims` mapper that turns decoded claims into a `Principal`. This
mirrors the discipline `@quilla-kit/security` applies on the BE side: the
package owns the interface, the consumer owns the encode/decode glue.

```ts
import type { ClaimsMapper, Principal } from '@quilla-fe-kit/auth-react';

// 1. Declare the wire shape you receive from your BE.
type TokenClaims = {
  u: string;        // userId
  si: string;       // scopeId
  s?: string[];     // scopes (RBAC)
};

// 2. Map claims → Principal. Return null when required fields are missing
//    so AuthProvider can clear storage and stay unauthenticated.
export const fromClaims: ClaimsMapper<TokenClaims> = (c) => {
  if (!c.u || !c.si) return null;
  return {
    userId: c.u,
    scopeId: c.si,
    scopes: c.s ?? [],
  };
};
```

Why this lives in your app and not the toolkit: claim names are part of
your BE's wire contract (see `@quilla-kit/security`'s `TokenClaims`). The
toolkit shouldn't ship a published type that pins those names — when the
BE evolves them, you'd need a coordinated FE toolkit release. Five lines
in your auth-setup module is the right boundary.

## Quick start

```tsx
import { AuthProvider, RequireAuth, useAuth } from '@quilla-fe-kit/auth-react';
import { localStorageTokenStorage } from '@quilla-fe-kit/auth';
import { Navigate, Routes, Route } from 'react-router-dom';
import { fromClaims } from './security/from-claims';

const storage = localStorageTokenStorage();

export const App = () => (
  <AuthProvider storage={storage} fromClaims={fromClaims}>
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
<AuthProvider storage={storage} fromClaims={fromClaims}>
  <App />
</AuthProvider>
```

On mount it reads the access token from `storage`, decodes it, runs it
through `fromClaims`, and seeds the context. If any step returns `null`,
it clears storage and stays unauthenticated.

**Expiry is checked by default.** The built-in decoder calls
`isTokenExpired` before decoding claims, so a stored token that has
expired is treated as absent — no stale session is hydrated. Pass a
`decodeToken` prop to override this behavior (see [Custom token
decoder](#custom-token-decoder) below).

| Prop | Type | Description |
| --- | --- | --- |
| `storage` | `TokenStorage` | Required. Where tokens are read and written. |
| `fromClaims` | `ClaimsMapper<TClaims>` | Required. Maps decoded claims to a `Principal`. Return `null` to reject the token. |
| `decodeToken` | `TokenDecoder<TClaims>` | Optional. Custom decoder replacing the default. |
| `children` | `ReactNode` | Required. |

> **Note:** `storage`, `fromClaims`, and `decodeToken` must be stable
> across renders. Construct them once at the composition root (module
> scope or a `useMemo`) — passing new instances each render triggers
> re-hydration in a loop.

## Custom token decoder

The `decodeToken` prop lets you replace the default decode step entirely.
The function receives the raw access token string and returns decoded
claims (`TClaims`) or `null` to reject the token.

**1. Default — secure out of the box (no `decodeToken` needed):**

```tsx
// Expiry is checked automatically. Nothing extra to wire.
<AuthProvider storage={storage} fromClaims={fromClaims}>
  {children}
</AuthProvider>
```

**2. Adding clock-skew tolerance:**

```tsx
import { decodeJwtPayload, isTokenExpired } from '@quilla-fe-kit/auth';

const decodeToken = <TClaims,>(token: string): TClaims | null =>
  isTokenExpired(token, { clockSkewSeconds: 30 })
    ? null
    : decodeJwtPayload<TClaims>(token);

<AuthProvider storage={storage} fromClaims={fromClaims} decodeToken={decodeToken}>
  {children}
</AuthProvider>
```

**3. Non-JWT token format:**

```tsx
// Provide your own parser — return null to reject the token.
const decodeToken = <TClaims,>(token: string): TClaims | null => {
  try {
    return myCustomParser<TClaims>(token);
  } catch {
    return null;
  }
};
```

The provider deliberately **does not own login**. Your login flow calls
the API itself (likely via `@quilla-fe-kit/api-client-react-query`) and
hands the returned tokens to `signIn`:

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

This keeps credential shapes, error mapping, and refresh-token semantics
out of the toolkit. Apps with email/password login, magic links, or OAuth
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

## `Principal`

`Principal` extends `AuthSession` (the BE wire shape from
`@quilla-fe-kit/api-client`) with a `scopes` array:

```ts
type Principal = {
  readonly userId: string;
  readonly scopeId: string;
  readonly scopes: readonly string[];
};
```

This is the toolkit's canonical user-identity shape inside React. Your
`fromClaims` is the boundary that translates whatever your BE puts in the
JWT into this type.

## API surface

### Components
- `<AuthProvider storage fromClaims decodeToken? children>`
- `<RequireAuth fallback scopes? forbiddenFallback? loadingFallback? children>`
- `<ScopeGuard scopes mode? fallback? children>`

### Hooks
- `useAuth() → AuthContextValue`
- `useHasScope(scopes, mode?) → boolean`

### Types
- `Principal`, `ClaimsMapper<TClaims>`, `TokenDecoder<TClaims>`, `HasScopeMode`
- `AuthContextValue`, `AuthProviderProps<TClaims>`, `RequireAuthProps`,
  `ScopeGuardProps`

JWT utilities (`decodeJwtPayload`, `decodeJwtHeader`, `isTokenExpired`,
`getTokenExpiry`) live in `@quilla-fe-kit/auth` — import them from there
directly.

## Design notes

- **Provider owns no credentials, no error mapping, no login mutation.**
  It exposes `signIn(tokens)` / `signOut()` — callers wire their own login
  against `api-client`. This keeps the package decoupled from how a given
  app shapes its login (email/password, magic link, OAuth, SSO).
- **Toolkit owns no JWT claim shape.** `fromClaims` is required. Mirrors
  `@quilla-kit/security`'s "interface, not adapter" discipline — the BE
  side has the consumer provide `toClaims`/`fromClaims` inside their own
  `TokenService` adapter. FE applies the same boundary.
- **Guards are router-agnostic.** Fallbacks are `ReactNode`, not paths.
  The package has zero `react-router-dom` dependency.
- **No app-specific flags** like `mustChangePassword`. Compose your own
  guard on top of `<RequireAuth>` if you need that flow.
- **`scopes` semantics in `<RequireAuth>` is `some` (any-of).** This
  matches typical RBAC route checks ("admin OR auditor can see this
  page"). For all-of semantics on a single piece of UI, use
  `<ScopeGuard mode="every">`.
