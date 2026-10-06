# @quilla-fe-kit/api-client

Framework-agnostic HTTP API client for consuming `@quilla-be-kit` backends:

- **Layered transport** — `FetchHttpClient` (raw `fetch` wrapper) →
  `AuthenticatedHttpClient` (Bearer + 401-refresh-retry decorator) →
  `createHttpClient(config)` factory.
- **Single-flight token refresh** — concurrent 401s collapse onto one
  in-flight refresh promise. No stampedes.
- **Pluggable error parser** — default `EnvelopeHttpErrorParser` matches
  `@quilla-be-kit/http`'s wire envelope; consumers can override with any
  `HttpErrorParser` for non-quilla backends.
- **OCC via `If-Match` / `ETag`** — numeric aggregate `version`, RFC 7232
  headers, helpers for round-tripping. No body fields, no cache magic.
- **Configurable query-string serializer** — defaults match
  `@quilla-be-kit/persistence`'s parser (`__contains` suffix, `pageSize`
  pagination key).

Browser + Node + edge safe. Reads platform globals via `globalThis`.

Runtime deps: `@quilla-fe-kit/errors`, `@quilla-fe-kit/auth`. This package
re-exports everything from both, so their exports are also available from
`@quilla-fe-kit/api-client`.

## Install

```sh
pnpm add @quilla-fe-kit/api-client
```

Node 22+, ESM-only.

## Quick start

```ts
import {
  type PaginationResponse,
  UnauthorizedError,
  createHttpClient,
  localStorageTokenStorage,
} from '@quilla-fe-kit/api-client';

const client = createHttpClient({
  baseUrl: 'https://api.example.com',
  storage: localStorageTokenStorage(),
  refreshEndpoint: async (refreshToken) => {
    const res = await fetch('https://api.example.com/auth/refresh', {
      method: 'POST',
      headers: { Authorization: `Bearer ${refreshToken}` },
    });
    if (!res.ok) {
      throw new UnauthorizedError({
        message: 'refresh failed',
        httpStatus: res.status,
        requestUrl: res.url,
      });
    }
    return res.json(); // { access, refresh }
  },
});

// Authenticated GET
const me = await client.request<User>({ url: '/me' });

// List with pagination + search
const users = await client.request<PaginationResponse<User>>({
  url: '/users',
  params: {
    search: { name: 'ada' },          // name__contains=ada
    page: 1,                          // page=1
    limit: 20,                        // pageSize=20
    sort: 'createdAt:desc',           // sort=createdAt%3Adesc
  },
});

// Public endpoint — skip the auth decorator per-request
const csrf = await client.request<{ token: string }>({
  url: '/csrf',
  disabledAuth: true,
});
```

If `refreshEndpoint` is omitted, `createHttpClient` returns the bare
`FetchHttpClient` (no auth decorator, no token storage). Useful for tests
or fully-public APIs.

### Config

`createHttpClient(config: CreateHttpClientConfig)`:

| Field             | Type                                                 | Default                        |
| ----------------- | ---------------------------------------------------- | ------------------------------ |
| `baseUrl`         | `string`                                             | required                       |
| `storage`         | `TokenStorage`                                       | `memoryTokenStorage()`         |
| `refreshEndpoint` | `RefreshEndpoint`                                    | none → plain `FetchHttpClient` |
| `errorParser`     | `HttpErrorParser`                                    | `new EnvelopeHttpErrorParser()` |
| `querySerializer` | `QueryStringSerializer \| Partial<QueryConventions>` | `new RepeatParamsSerializer()` |
| `fetchImpl`       | `typeof fetch`                                       | `globalThis.fetch`             |

`storage` is only used when `refreshEndpoint` is set; without
`refreshEndpoint` no auth decorator is created and `storage` is ignored.

```ts
type RefreshEndpoint = (refreshToken: string) => Promise<TokenPair>;
type TokenPair = { access: string; refresh: string }; // from @quilla-fe-kit/auth
```

## How the layers compose

```
createHttpClient(config)
    │
    ▼
AuthenticatedHttpClient
    ├─ attaches "Authorization: Bearer <accessToken>" from TokenStorage
    ├─ on 401 → SingleFlightTokenRefresher.refresh() → retry once
    └─ delegates to FetchHttpClient
            │
            ▼
        FetchHttpClient
            ├─ composes URL: baseUrl + path + querySerializer.serialize(params)
            ├─ JSON-stringifies plain-object bodies; passes FormData/Blob through
            ├─ AbortSignal.timeout(timeoutMs) composed with caller's signal
            └─ HttpErrorParser:
                    fromTransportError → NetworkError
                    fromResponse       → typed error class (4xx/5xx)
```

Each layer is a class that implements `HttpClient`:

```ts
interface HttpClient {
  request<T = unknown>(config: HttpRequest): Promise<HttpResponse<T>>;
}
```

You can compose your own decorators by wrapping any inner `HttpClient`.

## OCC (optimistic concurrency control)

The kit speaks the `@quilla-be-kit/ddd` aggregate-version model:

- **Token shape:** numeric `version` (BE convention), wire header `If-Match`.
- **Send:** the consumer formats the version with `formatOCCHeaderValue(version)`
  and sets it on the request. The React Query adapter does this automatically
  via the mutation hooks' `versionKey` resolver.
- **Receive:** the server returns the new version in the `ETag` response
  header. Read it with `parseETagHeaderValue(response.headers.etag)`.
- **Conflict:** the server returns `412 Precondition Failed`, which the
  default parser maps to `ConflictError`.

```ts
import { OCC_HEADER, formatOCCHeaderValue, parseETagHeaderValue } from '@quilla-fe-kit/api-client';

// Reading: extract version from a previous response
const version = parseETagHeaderValue(response.headers.etag); // number | null

// Writing: send If-Match
await client.request({
  method: 'PUT',
  url: '/users/1',
  body: { name: 'Ada' },
  headers: { [OCC_HEADER]: formatOCCHeaderValue(version!) },
});
```

`If-Match` values are quoted per RFC 7232 (`"<version>"`). The helpers do
the quoting + parsing for you.

## Error model

The default parser dispatches by `error.name` first, then by status code:

| Source                                        | Class                  |
| --------------------------------------------- | ---------------------- |
| `error.name === 'BadRequestError'` (any code) | `BadRequestError`      |
| 400 (no name match)                           | `BadRequestError`      |
| 401                                           | `UnauthorizedError`    |
| 403                                           | `ForbiddenError`       |
| 404                                           | `NotFoundError`        |
| 409 / 412                                     | `ConflictError`        |
| 422                                           | `ValidationError`      |
| 500                                           | `InternalServerError`  |
| (custom `error.name`, e.g. `BusinessRuleError`, `OptimisticLockError`, `CrossScopeAccessError`) | matching FE class |
| transport failure (offline, abort, TypeError) | `NetworkError`         |
| anything else                                 | `InternalServerError`  |

The quilla BE has no built-in `BusinessRuleError`. If your backend throws an
error named `BusinessRuleError`, name-first dispatch round-trips it: the class
name arrives in `envelope.error.name` regardless of status and the FE picks it
up. Name-first dispatch is also how domain-specific
subtypes of a generic HTTP error survive the round trip: `@quilla-be-kit/persistence`'s
`OptimisticLockError` (`extends ConflictError`) and `CrossScopeAccessError`
(`extends NotFoundError`) each serialize their own class name, so the parser
resolves them to the matching FE subclass instead of the generic
`ConflictError` / `NotFoundError` a status-only lookup would produce.

To plug a non-quilla error envelope:

```ts
import {
  type HttpErrorParser,
  createHttpClient,
} from '@quilla-fe-kit/api-client';

const myParser: HttpErrorParser = {
  fromResponse(status, statusText, body, url) { /* ... */ },
  fromTransportError(error) { /* ... */ },
};

const client = createHttpClient({
  baseUrl: 'https://api.example.com',
  errorParser: myParser,
});
```

## Handling errors

With the default error parser, HTTP failures and transport failures are
`QuillaFeError` subclasses from `@quilla-fe-kit/errors`. Two exceptions:

- A failed token refresh clears token storage and rethrows whatever
  `refreshEndpoint` threw (when no refresh token is stored, an
  `UnauthorizedError` is thrown instead).
- A custom `errorParser` may return any `Error`.

Use `instanceof` to narrow to a specific class:

```ts
import {
  NetworkError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
  BusinessRuleError,
  ConflictError,
  OptimisticLockError,
} from '@quilla-fe-kit/api-client';

try {
  const user = await client.request<User>({ url: '/users/42' });
} catch (e) {
  if (e instanceof NetworkError) {
    // transport failure — offline, timeout, abort
  } else if (e instanceof NotFoundError) {
    // 404 (covers CrossScopeAccessError too — check that first if you
    // need to tell scope-boundary 404s apart from plain not-found)
  } else if (e instanceof UnauthorizedError) {
    // 401 with no refresh token stored, or whatever your refreshEndpoint
    // throws on failure (an UnauthorizedError in the Quick start example)
  } else if (e instanceof ValidationError) {
    // matched by error name (the quilla BE sends it as 400); 422 is the
    // status fallback for other backends; details in e.context
  } else if (e instanceof BusinessRuleError) {
    // domain rejection from the BE (any status); details in e.context
  } else if (e instanceof OptimisticLockError) {
    // matched by error name — lost a concurrent write race;
    // e.context is { entity, id, key? }
  } else if (e instanceof ConflictError) {
    // any other 409 / 412
  } else {
    throw e; // re-throw unexpected errors
  }
}
```

`instanceof` checks for a subclass (`OptimisticLockError`,
`CrossScopeAccessError`) must come before the check for its generic parent
(`ConflictError`, `NotFoundError`) — the parent check would otherwise match
first and swallow the more specific branch.

Every `QuillaFeError` carries:

| Property   | Type                            | Description                                        |
| ---------- | ------------------------------- | -------------------------------------------------- |
| `message`  | `string`                        | Human-readable description                         |
| `code`     | `string`                        | Stable discriminant (`'NOT_FOUND'`, `'CONFLICT'`, …) |
| `context`  | `Record<string, unknown> \| undefined` | Structured metadata from `envelope.error.details` |
| `cause`    | `unknown`                       | Underlying transport error (set on `NetworkError`) |

HTTP-derived errors (`QuillaFeHttpError` subclasses) additionally expose
`httpStatus: number` and `requestUrl: string | undefined`.

**Cross-realm safety.** `instanceof` is reliable within a single bundle. If
you need to detect quilla errors across module realms (micro-frontends, iframes,
error boundaries that re-throw across bundle boundaries), use
`QuillaFeError.is(e)` from `@quilla-fe-kit/errors` — it uses a `Symbol.for`
brand rather than the prototype chain — then discriminate by `e.code`:

```ts
import { QuillaFeError } from '@quilla-fe-kit/api-client';

if (QuillaFeError.is(e) && e.code === 'NOT_FOUND') { /* ... */ }
```

## Query-string conventions

The default `RepeatParamsSerializer` matches `@quilla-be-kit/persistence`'s
`createQueryParametersSchema`:

| Input                                 | Output                              |
| ------------------------------------- | ----------------------------------- |
| `{ search: { name: 'ada' } }`         | `name__contains=ada`                |
| `{ filter: { status: 'active' } }`    | `status=active`                     |
| `{ page: 2, limit: 50, sort: 'x:asc' }` | `page=2&pageSize=50&sort=x%3Aasc` |
| `{ tags: ['a', 'b'] }`                | `tags=a&tags=b` (repeat convention) |

Override the conventions at factory time:

```ts
const client = createHttpClient({
  baseUrl,
  querySerializer: {
    searchSuffix: '_like',                                       // default: '__contains'
    paginationKeys: { page: 'p', limit: 'size', sort: 'order' }, // default: { page, pageSize, sort }
  },
});
```

### Migration: nested objects now throw

Values that are plain objects used to stringify to `[object Object]` and travel
to the server as a meaningless query param. They now raise
`QuerySerializationError` at the call site instead:

```ts
client.request({ url: '/frames', params: { expand: { frameId: 'f1' } } });
// QuerySerializationError: Query param "expand" is a nested object; ...
```

This applies wherever a plain object reaches a value position — at the top
level, inside `search` or `filter` (reported as `filter.age`), and inside an
array (reported as `tags[1]`).

To keep the previous lenient behaviour, or to encode nested objects your own
way, override `encodeValue` rather than reimplementing the serializer:

```ts
class DottedSerializer extends RepeatParamsSerializer {
  protected override encodeValue(value: unknown, keyPath: string): string {
    if (this.isPlainObject(value)) {
      return Object.entries(value).map(([k, v]) => `${k}:${v}`).join(',');
    }
    return super.encodeValue(value, keyPath);
  }
}

createHttpClient({ baseUrl, querySerializer: new DottedSerializer() });
```

`encodeValue`, `conventions` and `isPlainObject` are `protected`, so a subclass
inherits search, filter, pagination and array-repeat handling unchanged.

Scope an override to a **convention, not to a param name**. The serializer sits
in the transport layer, which every request in the app passes through, so rules
that hold app-wide belong here — "nested objects encode as `k:v` pairs", "dates
serialize as ISO". A rule keyed to one parameter does not:

```ts
// Don't: puts one feature's vocabulary into a shared foundation layer.
if (keyPath.startsWith('expand')) { /* ... */ }
```

That is feature vocabulary, and encoding it here makes the transport depend on
the shape of a single feature. Flatten those params at the call site instead,
where the vocabulary already lives.

`Date` and other class instances are deliberately untouched — they still go
through `String(value)`, which for a `Date` yields `Date.prototype.toString()`
output (e.g. `Tue Oct 06 2026 10:00:00 GMT+0000 (…)`), not ISO. Choosing ISO instead is
a wire convention, so `encodeValue` is the place to make it.

Or pass an entire custom `QueryStringSerializer` instance for non-flat
encoding (bracket convention, comma-joined arrays, etc.).

## Token storage

The factory accepts any `TokenStorage` implementation from
`@quilla-fe-kit/auth` (or your own). Defaults to `memoryTokenStorage()`
when omitted, which is SSR-safe but loses tokens on reload.

## Multipart / file upload

`FetchHttpClient` accepts `FormData` and `Blob` bodies directly — no
separate upload client. The browser sets `Content-Type: multipart/form-data`
with the boundary automatically; the client doesn't override it.

```ts
const fd = new FormData();
fd.append('avatar', file);
fd.append('userId', '1');

await client.request({ method: 'POST', url: '/avatar', body: fd });
```

For upload progress, use a custom `HttpClient` that wraps XHR — `fetch`
doesn't expose progress events for request bodies. (A separate
upload-progress decorator is on the roadmap; not implemented today.)

## Binary downloads

By default the client decodes response bodies as text/JSON, which corrupts
binary. For a zip export, PDF, or image, set `responseType` so the body is
read with the right decoder:

```ts
const { data: zip } = await client.request<Blob>({
  url: '/exports/report.zip',
  responseType: 'blob',
});
```

`responseType` accepts `'json'`, `'text'`, `'blob'`, `'arrayBuffer'`, or
`'stream'` (the raw `ReadableStream` from `response.body`). Error responses
are always parsed as the JSON envelope regardless of `responseType`, so a
failing binary request still throws the typed error class — and because the
request flows through the normal layers, it carries the Bearer token and gets
the 401 silent-refresh + retry that a hand-rolled `fetch` would miss.

To fetch an authenticated file and trigger a browser "Save as" in one call:

```ts
import { downloadFile } from '@quilla-fe-kit/api-client';

await downloadFile(client, {
  url: '/exports/report.zip',
  filename: 'report.zip',
});
```

`DownloadFileOptions`:

| Field       | Type              | Required |
| ----------- | ----------------- | -------- |
| `url`       | `string`          | yes      |
| `filename`  | `string`          | yes      |
| `params`    | `HttpQueryParams` | no       |
| `headers`   | `HttpHeaders`     | no       |
| `signal`    | `AbortSignal`     | no       |
| `timeoutMs` | `number`          | no       |

`downloadFile` GETs the resource as a `Blob` through the client, then hands it
to `saveBlobAsFile(blob, filename)`, which creates an object URL, clicks a
synthetic `<a download>`, and revokes the URL. Both are **browser-only** — they
throw a clear error if `document` / `URL.createObjectURL` is unavailable (SSR,
Node, edge). `downloadFile` performs the request before checking for the DOM,
so outside a browser it fetches the file and then throws. The binary fetch (`responseType`) itself stays environment-agnostic;
only the save-to-disk step needs the DOM.

## Wire-contract types

`@quilla-fe-kit/api-client` re-exports the BE wire types (used internally
and useful for typing app-level code):

```ts
import {
  type ErrorEnvelope,        // { error: { name, message, details? } }
  type PaginationRequest,    // { page?, limit?, sort?, filter? }
  type PaginationResponse,   // { data, pagination: { page, limit, total } }
  type AuthSession,          // { scopeId, userId }
  type OCCToken,             // number
  OCC_HEADER,                // 'If-Match'
  ETAG_HEADER,               // 'ETag'
  formatOCCHeaderValue,
  parseETagHeaderValue,
} from '@quilla-fe-kit/api-client';
```

These exist solely to keep the FE in sync with `@quilla-be-kit/http`'s wire
format. Drift is prevented by docs (the BE README is the source of truth),
not by a code dependency — the FE has zero `@quilla-be-kit/*` imports.

## Multiple clients per app

Public endpoints, multiple environments, third-party APIs — call
`createHttpClient` as many times as you need:

```ts
const apiClient = createHttpClient({
  baseUrl: 'https://api.example.com',
  storage,
  refreshEndpoint,
});

const publicClient = createHttpClient({
  baseUrl: 'https://public.example.com',
  // no refreshEndpoint → unauthenticated FetchHttpClient
});

const partnerClient = createHttpClient({
  baseUrl: 'https://partner.example.com',
  errorParser: partnerEnvelopeParser, // their wire shape
});
```

No singletons, no module-load env reads — config is passed at construction.

## Headers contract

`HttpResponse.headers` keys are normalized to lowercase. Read them with
lowercase keys (`response.headers.etag`, `response.headers['content-type']`)
or via the `OCC_HEADER`/`ETAG_HEADER` constants by `.toLowerCase()`-ing them.

The constants stay in canonical case (`'If-Match'`, `'ETag'`) because that's
the right form for *setting* headers on a request; only response-side reads
are lowercase.

## API surface

### Factory
- `createHttpClient(config: CreateHttpClientConfig): HttpClient`

### Browser-only helpers
- `downloadFile(client, options: DownloadFileOptions): Promise<void>` — authenticated binary GET → "Save as" (fetches before the DOM check; throws after the request outside a browser)
- `saveBlobAsFile(blob: Blob, filename: string): void` — trigger a browser download from a `Blob`

### Interfaces
- `HttpClient` — `request<T>(config) => Promise<HttpResponse<T>>`
- `HttpErrorParser` — `fromResponse(...) => Error`, `fromTransportError(error) => Error`
- `QueryStringSerializer` — `serialize(params) => string`

### Types
- `HttpRequest`, `HttpResponse<T>`, `HttpHeaders`, `HttpQueryParams`,
  `HttpRequestBody`, `HttpMethod`, `HttpResponseType`
- `DownloadFileOptions`
- `CreateHttpClientConfig`, `QueryConventions`
- `RefreshEndpoint`, `TokenRefresher`

### Classes (escape hatches)
- `FetchHttpClient` — bare transport;
  `new FetchHttpClient({ baseUrl, querySerializer, errorParser, fetchImpl? })`
- `AuthenticatedHttpClient` — auth decorator;
  `new AuthenticatedHttpClient({ inner, storage, tokenRefresher })`
- `SingleFlightTokenRefresher` — concurrent-safe refresh;
  `new SingleFlightTokenRefresher({ storage, refreshEndpoint })`
- `EnvelopeHttpErrorParser` — default error parser; `new EnvelopeHttpErrorParser()`
- `RepeatParamsSerializer` — default query serializer;
  `new RepeatParamsSerializer(conventions?: Partial<QueryConventions>)`; override
  `encodeValue` to change how a value is encoded
- `DEFAULT_QUERY_CONVENTIONS` — the defaults `RepeatParamsSerializer` starts from

You typically only need `createHttpClient`. The classes are exposed for
consumers writing custom decorators or factory variants.
