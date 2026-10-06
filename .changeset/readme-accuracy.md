---
'@quilla-fe-kit/api-client-react-query': patch
'@quilla-fe-kit/api-client': patch
'@quilla-fe-kit/errors': patch
'@quilla-fe-kit/auth': patch
'@quilla-fe-kit/auth-react': patch
---

Documentation accuracy pass: READMEs re-audited against the source.

- Backend references now use the real `@quilla-be-kit/*` package scope.
- `api-client-react-query`: corrected `useInfiniteQueryBase` examples (page-param callbacks receive the mapped `TModel`), the cursor wire example, the retry table (`QuerySerializationError`), `createQueryClient`'s throw outside the browser, `queryInvalidator` failure modes, and DELETE OCC vars; documented `applyMutationTransformer`, the event-handler types and `resolveMutationUrl` edge cases.
- `api-client`: scoped which errors extend `QuillaFeError` (a failed refresh rethrows what `refreshEndpoint` threw), documented every `createHttpClient` option, the re-export of `errors`/`auth`, `downloadFile` options and the escape-hatch constructors; corrected the `ValidationError`/`BusinessRuleError`/`OptimisticLockError` notes.
- `api-client` / `errors`: install and import guidance aligned with the packaging — `api-client` re-exports `errors` and `auth`, so apps import error classes and token storage from `@quilla-fe-kit/api-client` to keep a single `errors` copy for `instanceof`.
- `errors`: `code` narrowing only works over a union you declare; added `QuerySerializationError` and the option types; fixed the class count.
- `auth`: decoder implementation, `JwtHeader` shape, exported option types.
- `auth-react`: built-in expiry check, `signIn` failure, empty-`scopes` behaviour, `AuthContext`, and the `createHooks` origin of `usePostMutationBase` in the login example.
