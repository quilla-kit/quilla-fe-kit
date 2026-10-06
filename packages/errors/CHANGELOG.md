# @quilla-fe-kit/errors

## 0.3.1

### Patch Changes

- 3cc8ed6: Documentation accuracy pass: READMEs re-audited against the source.

  - Backend references now use the real `@quilla-be-kit/*` package scope.
  - `api-client-react-query`: corrected `useInfiniteQueryBase` examples (page-param callbacks receive the mapped `TModel`), the cursor wire example, the retry table (`QuerySerializationError`), `createQueryClient`'s throw outside the browser, `queryInvalidator` failure modes, and DELETE OCC vars; documented `applyMutationTransformer`, the event-handler types and `resolveMutationUrl` edge cases.
  - `api-client`: scoped which errors extend `QuillaFeError` (a failed refresh rethrows what `refreshEndpoint` threw), documented every `createHttpClient` option, the re-export of `errors`/`auth`, `downloadFile` options and the escape-hatch constructors; corrected the `ValidationError`/`BusinessRuleError`/`OptimisticLockError` notes.
  - `api-client` / `errors`: install and import guidance aligned with the packaging — `api-client` re-exports `errors` and `auth`, so apps import error classes and token storage from `@quilla-fe-kit/api-client` to keep a single `errors` copy for `instanceof`.
  - `errors`: `code` narrowing only works over a union you declare; added `QuerySerializationError` and the option types; fixed the class count.
  - `auth`: decoder implementation, `JwtHeader` shape, exported option types.
  - `auth-react`: built-in expiry check, `signIn` failure, empty-`scopes` behaviour, `AuthContext`, and the `createHooks` origin of `usePostMutationBase` in the login example.

## 0.3.0

### Minor Changes

- cd5e39c: Add `QuerySerializationError` for query-string serialization failures raised
  before a request leaves the client.

  It extends `QuillaFeError` (not `QuillaFeHttpError`) because it reports a
  client-side programming mistake rather than a server response, and carries the
  offending `keyPath` in `context`.

## 0.2.0

### Minor Changes

- b71745f: Add `OptimisticLockError` and `CrossScopeAccessError`, mirroring the domain-specific error subtypes `@quilla-be-kit/persistence` throws on the backend (`OptimisticLockError extends ConflictError`, `CrossScopeAccessError extends NotFoundError`).

  Previously `EnvelopeHttpErrorParser.fromResponse` only dispatched on the generic HTTP-semantic error names (`ConflictError`, `NotFoundError`, etc.). When a backend error's wire `name` was a more specific subtype the parser didn't know about, the lookup missed and fell through to the generic status-based class — losing the distinction entirely, with no trace of the original wire name left on the resulting error. Registering both classes in `NAME_DISPATCH` lets consumers write precise checks like `err instanceof OptimisticLockError` instead of matching on message text or guessing from the error's `context` shape.

## 0.1.1

### Patch Changes

- ba25ee0: test: smoke-test CI release via Trusted Publishers (OIDC) across all packages

## 0.1.0

### Minor Changes

- 4e00828: Initial release of `@quilla-fe-kit/errors`, `@quilla-fe-kit/auth`,
  `@quilla-fe-kit/api-client`, and `@quilla-fe-kit/api-client-react-query`.
