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
- Eight HTTP-derived classes covering the standard 4xx/5xx categories plus
  `BusinessRuleError` for domain-rule failures the BE returns by name.
- A `NetworkError` for transport-level failures (offline, timeout, abort) —
  the request never reached HTTP, so it doesn't carry a status.

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
│   ├── ConflictError                  code: 'CONFLICT'      (409 + 412)
│   ├── ValidationError                code: 'VALIDATION'
│   ├── BusinessRuleError              code: 'BUSINESS_RULE' (status varies)
│   └── InternalServerError            code: 'INTERNAL_SERVER'
└── NetworkError                       code: 'NETWORK'        (transport failures)
```

`code` is a literal type per class — `error.code === 'CONFLICT'` narrows the
class via discriminated union without `instanceof`.

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
- To keep `instanceof` reliable, downstream packages should declare
  `@quilla-fe-kit/errors` as a `peerDependency`.

## Discriminated union on `code`

Because each subclass declares `readonly code = '...'` without a widening
annotation, `code` is the literal type, not `string`:

```ts
function handle(e: QuillaFeError) {
  switch (e.code) {
    case 'CONFLICT':       return retry();
    case 'VALIDATION':     return showValidation(e.context);
    case 'NETWORK':        return showOfflineBanner();
    default:               return rethrow();
  }
}
```

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
