---
'@quilla-fe-kit/auth-react': minor
---

Bootstrap `@quilla-fe-kit/auth-react`: React adapter for
`@quilla-fe-kit/auth`. Ships `<AuthProvider>` generic over JWT claim
shape with a required `fromClaims: ClaimsMapper<TClaims>` prop (no
default — toolkit owns no opinion about claim names, mirroring
`@quilla-kit/security`'s interface-only discipline). Plus `useAuth()`,
`<RequireAuth>` route guard, `<ScopeGuard>` + `useHasScope()` for
render-level RBAC. Router-agnostic (fallbacks are `ReactNode`s). Zero
external runtime deps — JWT decoded against `globalThis.atob`. React ≥ 18
as peer dep. Exposes `decodeJwtPayload<T>(token)` as a pure helper for
consumers writing their own `fromClaims`.
