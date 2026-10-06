# @quilla-fe-kit/errors

Typed error primitives for FE projects: `QuillaFeError` abstract base with a
cross-realm-safe brand, `QuillaFeHttpError` subclass for HTTP-derived errors,
plus concrete classes consumers throw or pattern-match against.

Zero runtime dependencies. Universal runtime (browser, Node, edge, Deno).

## Why this package exists

Every FE project that talks to a backend ends up reinventing the same shape:
"is this error from the API?", "what status code did it carry?", "did the
request even reach the server?". This package ships those primitives once:

- A `QuillaFeError` abstract base with `code`, `context`, `cause`, structured
  JSON serialization, and a `Symbol.for`-branded `is()` check.
- A `QuillaFeHttpError` subclass that adds first-class `httpStatus` and
  `requestUrl` for any error derived from an HTTP response.
- Seven standard HTTP classes covering the 4xx/5xx categories, two
  domain-specific leaves (`CrossScopeAccessError`, `OptimisticLockError`),
  plus `BusinessRuleError` for domain-rule failures the BE returns by name.
- A `NetworkError` for transport-level failures (offline, timeout, abort) —
  the request never reached HTTP, so it doesn't carry a status.
- A `QuerySerializationError`, raised by `@quilla-fe-kit/api-client`'s query
  serializer when a param can't be serialized (e.g. a nested object).

Reusable independently of `@quilla-fe-kit/api-client` — pull this if you
want a structured error model with any HTTP layer (axios, ky, your own).

## Install

```sh
pnpm add @quilla-fe-kit/errors
```

Node 22+, ESM-only.

## Hierarchy

```
QuillaFeError                          (abstract — base for all kit errors)
├── QuillaFeHttpError                  (abstract — adds httpStatus, requestUrl?)
│   ├── BadRequestError                code: 'BAD_REQUEST'
│   ├── UnauthorizedError              code: 'UNAUTHORIZED'
│   ├── ForbiddenError                 code: 'FORBIDDEN'
│   ├── NotFoundError                  code: 'NOT_FOUND'
│   │   └── CrossScopeAccessError      code: 'CROSS_SCOPE_ACCESS'
│   ├── ConflictError                  code: 'CONFLICT'      (409 + 412)
│   │   └── OptimisticLockError        code: 'OPTIMISTIC_LOCK'
│   ├── ValidationError                code: 'VALIDATION'
│   ├── BusinessRuleError              code: 'BUSINESS_RULE' (status varies)
│   └── InternalServerError            code: 'INTERNAL_SERVER'
├── NetworkError                       code: 'NETWORK'        (transport failures)
└── QuerySerializationError            code: 'QUERY_SERIALIZATION'
```

Most concrete classes declare `code` as a literal type, but
`QuillaFeError.code` is typed `string`, so checking `code` on a value typed
`QuillaFeError` narrows nothing. Literal `code` narrows only over a union you
declare yourself; otherwise use `instanceof` — see [Discriminated union on
`code`](#discriminated-union-on-code).

### Option types

```ts
type QuillaFeErrorOptions = {
  message: string;
  context?: Record<string, unknown>;
  cause?: unknown;
};

type QuillaFeHttpErrorOptions = QuillaFeErrorOptions & {
  httpStatus: number;
  requestUrl?: string;
};
```

Both are exported. `QuillaFeError` subclasses (`NetworkError`,
`QuerySerializationError`) take `QuillaFeErrorOptions`; `QuillaFeHttpError`
subclasses take `QuillaFeHttpErrorOptions`.

## Usage

Throw a class, or extend one for a domain-specific leaf:

```ts
import { ConflictError, NotFoundError } from '@quilla-fe-kit/errors';

// Direct throw
throw new ConflictError({
  message: 'Email already in use',
  context: { email },
  httpStatus: 409,
  requestUrl: '/users',
});

// Domain-specific leaf
class UserNotFoundError extends NotFoundError {
  override readonly code = 'USER_NOT_FOUND';
  constructor(opts: { id: string; httpStatus: number; requestUrl: string }) {
    super({
      message: `User ${opts.id} not found`,
      context: { id: opts.id },
      httpStatus: opts.httpStatus,
      requestUrl: opts.requestUrl,
    });
  }
}
```

The kit ships two such leaves — `OptimisticLockError extends ConflictError`
and `CrossScopeAccessError extends NotFoundError` — mirroring the
domain-specific errors `@quilla-be-kit/persistence` throws on the backend.
They need no custom constructor since their parent's options shape already
fits; overriding `code` is enough:

```ts
import { ConflictError } from '@quilla-fe-kit/errors';

export class OptimisticLockError extends ConflictError {
  override readonly code = 'OPTIMISTIC_LOCK';
}
```

### Chaining causes

Use the native `cause` property to preserve the underlying failure:

```ts
import { NetworkError } from '@quilla-fe-kit/errors';

try {
  await fetch(url);
} catch (cause) {
  throw new NetworkError({ message: 'Could not reach API', cause });
}
```

`cause` flows through to `toJSON()` for structured logs.

## Classification

Use `QuillaFeError.is()` as the cross-realm-safe boundary check, then
`instanceof` for category matching:

```ts
import {
  BusinessRuleError,
  ConflictError,
  NetworkError,
  QuillaFeError,
  QuillaFeHttpError,
  ValidationError,
} from '@quilla-fe-kit/errors';

function classify(e: unknown) {
  if (!QuillaFeError.is(e)) return 'unknown';

  // Coarse split: HTTP vs transport
  if (e instanceof QuillaFeHttpError) {
    if (e instanceof BusinessRuleError) return 'business-rule';
    if (e instanceof ValidationError)   return 'invalid-input';
    if (e instanceof ConflictError)     return 'conflict';
    return `http-${e.httpStatus}`;
  }
  if (e instanceof NetworkError) return 'transport';
  return 'unknown';
}
```

- `QuillaFeError.is()` uses `Symbol.for('quilla-fe-kit.error')` — works
  across realms (e.g. duplicate package copies under monorepo hoisting).
- `instanceof` works within a single realm and is inheritance-aware.
- `instanceof` needs a single copy of `@quilla-fe-kit/errors` in your app.
  `@quilla-fe-kit/api-client` depends on it and re-exports every class, so
  in an app that uses the client, import error classes from
  `@quilla-fe-kit/api-client`. If you also install `@quilla-fe-kit/errors`
  directly, keep it on a version compatible with the client's so the
  package manager resolves one copy. Libraries you publish on top of this
  package should declare it as a `peerDependency`.

## Discriminated union on `code`

`QuillaFeError.code` is typed `string`, so a `switch` on `e.code` for a value
typed `QuillaFeError` narrows nothing. Most concrete classes declare
`readonly code = '...'` as a literal, so `code` narrows only over a union you
declare:

```ts
type AppError = ValidationError | NetworkError | BadRequestError;

function handle(e: AppError) {
  switch (e.code) {
    case 'VALIDATION':  return showValidation(e.context); // e: ValidationError
    case 'NETWORK':     return showOfflineBanner();       // e: NetworkError
    case 'BAD_REQUEST': return showBadRequest(e.httpStatus);
  }
}
```

Outside such a union, use `instanceof`.

`ConflictError` and `NotFoundError` type `code` as plain `string` (their
subclasses `OptimisticLockError` and `CrossScopeAccessError` override it), so
they don't narrow by `code` even inside a union — `e.code === 'CONFLICT'`
still works at runtime. Use `instanceof` to match them, and to distinguish
`OptimisticLockError` / `CrossScopeAccessError` from their generic parent.

## Serialization

```ts
err.toJSON();
// QuillaFeError:
//   { name, code, message, context?, cause? }
// QuillaFeHttpError:
//   { name, code, message, httpStatus, requestUrl?, context?, cause? }
```

Safe for structured logging. `message` is the public, end-user-safe string;
internal debug detail lives in `context`. Optional fields are omitted when
absent — your log query can target `httpStatus:401` without false-matching
`null`s.

## When `requestUrl` is omitted

`requestUrl` is optional on `QuillaFeHttpError` because some HTTP-shaped
errors are synthesized client-side before a request is sent (e.g. an auth
layer detects no refresh token and raises `UnauthorizedError` without ever
calling the server). Callers can rely on `httpStatus` always being present
on HTTP errors; `requestUrl` is present only when the error originates from
an actual HTTP response.
