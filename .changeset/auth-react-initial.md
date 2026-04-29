---
'@quilla-fe-kit/auth-react': minor
---

Bootstrap `@quilla-fe-kit/auth-react`: React adapter for
`@quilla-fe-kit/auth`. Ships `<AuthProvider>` with pluggable JWT-claim →
`Principal` decoding (default shape matches `@quilla-kit` BE claims:
`u` = userId, `si` = scopeId, `s` = scopes), `useAuth()`,
`<RequireAuth>` route guard, `<ScopeGuard>` + `useHasScope()` for
render-level RBAC. Router-agnostic (fallbacks are `ReactNode`s). Zero
external runtime deps — JWT decoded against `globalThis.atob`. React ≥ 18
as peer dep.
