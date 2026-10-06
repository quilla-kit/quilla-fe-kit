# @quilla-fe-kit/auth-react

## 0.2.4

### Patch Changes

- 3cc8ed6: Documentation accuracy pass: READMEs re-audited against the source.

  - Backend references now use the real `@quilla-be-kit/*` package scope.
  - `api-client-react-query`: corrected `useInfiniteQueryBase` examples (page-param callbacks receive the mapped `TModel`), the cursor wire example, the retry table (`QuerySerializationError`), `createQueryClient`'s throw outside the browser, `queryInvalidator` failure modes, and DELETE OCC vars; documented `applyMutationTransformer`, the event-handler types and `resolveMutationUrl` edge cases.
  - `api-client`: scoped which errors extend `QuillaFeError` (a failed refresh rethrows what `refreshEndpoint` threw), documented every `createHttpClient` option, the re-export of `errors`/`auth`, `downloadFile` options and the escape-hatch constructors; corrected the `ValidationError`/`BusinessRuleError`/`OptimisticLockError` notes.
  - `api-client` / `errors`: install and import guidance aligned with the packaging — `api-client` re-exports `errors` and `auth`, so apps import error classes and token storage from `@quilla-fe-kit/api-client` to keep a single `errors` copy for `instanceof`.
  - `errors`: `code` narrowing only works over a union you declare; added `QuerySerializationError` and the option types; fixed the class count.
  - `auth`: decoder implementation, `JwtHeader` shape, exported option types.
  - `auth-react`: built-in expiry check, `signIn` failure, empty-`scopes` behaviour, `AuthContext`, and the `createHooks` origin of `usePostMutationBase` in the login example.

- Updated dependencies [3cc8ed6]
  - @quilla-fe-kit/api-client@0.4.2
  - @quilla-fe-kit/auth@0.2.1

## 0.2.3

### Patch Changes

- Updated dependencies [cd5e39c]
  - @quilla-fe-kit/api-client@0.4.0

## 0.2.2

### Patch Changes

- Updated dependencies [b71745f]
  - @quilla-fe-kit/api-client@0.3.0

## 0.2.1

### Patch Changes

- Updated dependencies [3463bd1]
  - @quilla-fe-kit/api-client@0.2.0

## 0.2.0

### Minor Changes

- aeb2a49: Add optional `decodeToken?: TokenDecoder<TClaims> | undefined` prop to
  `AuthProvider`. The built-in default checks token expiry (exp + nbf) and
  decodes claims in a single parse, so expired tokens are rejected at both
  hydration and `signIn` without any extra wiring. `decode` is stabilized
  with `useMemo`, preventing effect and callback churn when consumers pass
  a stable `decodeToken` reference. Consumers who need custom decode
  behavior (different format, clock-skew tolerance, added validation) pass
  `decodeToken` as a prop. `TokenDecoder<TClaims>` type is exported. The
  internal `jwt.parser.ts` re-export shim is removed — import JWT utilities
  from `@quilla-fe-kit/auth` directly.

### Patch Changes

- Updated dependencies [aeb2a49]
  - @quilla-fe-kit/auth@0.2.0
  - @quilla-fe-kit/api-client@0.1.2

## 0.1.1

### Patch Changes

- ba25ee0: test: smoke-test CI release via Trusted Publishers (OIDC) across all packages
- Updated dependencies [ba25ee0]
  - @quilla-fe-kit/api-client@0.1.1
  - @quilla-fe-kit/auth@0.1.1

## 0.1.0

### Minor Changes

- 504ca49: Bootstrap `@quilla-fe-kit/auth-react`: React adapter for
  `@quilla-fe-kit/auth`. Ships `<AuthProvider>` generic over JWT claim
  shape with a required `fromClaims: ClaimsMapper<TClaims>` prop (no
  default — toolkit owns no opinion about claim names, mirroring
  `@quilla-kit/security`'s interface-only discipline). Plus `useAuth()`,
  `<RequireAuth>` route guard, `<ScopeGuard>` + `useHasScope()` for
  render-level RBAC. Router-agnostic (fallbacks are `ReactNode`s). Zero
  external runtime deps — JWT decoded against `globalThis.atob`. React ≥ 18
  as peer dep. Exposes `decodeJwtPayload<T>(token)` as a pure helper for
  consumers writing their own `fromClaims`.

### Patch Changes

- Updated dependencies [4e00828]
  - @quilla-fe-kit/auth@0.1.0
  - @quilla-fe-kit/api-client@0.1.0
