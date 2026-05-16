# @quilla-fe-kit/auth-react

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
