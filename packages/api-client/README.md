# @quilla-fe-kit/api-client

Framework-agnostic HTTP API client for consuming `@quilla-kit` backends:

- **Layered transport** — `FetchHttpClient` (raw `fetch` wrapper) →
  `AuthenticatedHttpClient` (Bearer + 401-refresh-retry decorator) →
  `createHttpClient(config)` factory.
- **Single-flight token refresh** — concurrent 401s collapse onto one
  in-flight refresh promise. No stampedes.
- **Pluggable error parser** — default `EnvelopeHttpErrorParser` matches
  `@quilla-kit/http`'s wire envelope; consumers can override with any
  `HttpErrorParser` for non-quilla backends.
- **OCC via `If-Match` / `ETag`** — numeric aggregate `version`, RFC 7232
  headers, helpers for round-tripping. No body fields, no cache magic.
- **Configurable query-string serializer** — defaults match
  `@quilla-kit/persistence`'s parser (`__contains` suffix, `pageSize`
  pagination key).

Browser + Node + edge safe. Reads platform globals via `globalThis`.

Runtime deps: `@quilla-fe-kit/errors`, `@quilla-fe-kit/auth`.

## Install

```sh
pnpm add @quilla-fe-kit/api-client @quilla-fe-kit/errors @quilla-fe-kit/auth
```

Node 22+, ESM-only.

## Quick start

```ts
import { createHttpClient } from '@quilla-fe-kit/api-client';
import { localStorageTokenStorage } from '@quilla-fe-kit/auth';

const client = createHttpClient({
  baseUrl: 'https://api.example.com',
  storage: localStorageTokenStorage(),
  refreshEndpoint: async (refreshToken) => {
    const res = await fetch('https://api.example.com/auth/refresh', {
      method: 'POST',
      headers: { Authorization: `Bearer ${refreshToken}` },
    });
    if (!res.ok) throw new Error('refresh failed');
    return res.json(); // { access, refresh }
  },
});

// Authenticated GET
const me = await client.request<User>({ url: '/me' });

// List with pagination + search
const users = await client.request<{ data: User[]; pagination: Pagination }>({
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

The kit speaks the `@quilla-kit/ddd` aggregate-version model:

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
| (custom `error.name`, e.g. `BusinessRuleError`)| matching FE class      |
| transport failure (offline, abort, TypeError) | `NetworkError`         |
| anything else                                 | `InternalServerError`  |

Name-first dispatch is what makes `BusinessRuleError` round-trip — it has
no unique HTTP status, but the BE serializes the class name into
`envelope.error.name` and the FE picks it up.

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

All errors thrown by the client extend `QuillaFeError` from
`@quilla-fe-kit/errors`. Use `instanceof` to narrow to a specific class:

```ts
import {
  NetworkError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
  BusinessRuleError,
  ConflictError,
} from '@quilla-fe-kit/errors';

try {
  const user = await client.request<User>({ url: '/users/42' });
} catch (e) {
  if (e instanceof NetworkError) {
    // transport failure — offline, timeout, abort
  } else if (e instanceof NotFoundError) {
    // 404
  } else if (e instanceof UnauthorizedError) {
    // 401 — tokens expired and refresh failed
  } else if (e instanceof ValidationError) {
    // 422 — field-level validation; details in e.context
  } else if (e instanceof BusinessRuleError) {
    // domain rejection from the BE (any status); details in e.context
  } else if (e instanceof ConflictError) {
    // 409 / 412 — stale version (OCC)
  } else {
    throw e; // re-throw unexpected errors
  }
}
```

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
import { QuillaFeError } from '@quilla-fe-kit/errors';

if (QuillaFeError.is(e) && e.code === 'NOT_FOUND') { /* ... */ }
```

## Query-string conventions

The default `RepeatParamsSerializer` matches `@quilla-kit/persistence`'s
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

`downloadFile` GETs the resource as a `Blob` through the client, then hands it
to `saveBlobAsFile(blob, filename)`, which creates an object URL, clicks a
synthetic `<a download>`, and revokes the URL. Both are **browser-only** — they
throw a clear error if `document` / `URL.createObjectURL` is unavailable (SSR,
Node, edge). The binary fetch (`responseType`) itself stays environment-agnostic;
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

These exist solely to keep the FE in sync with `@quilla-kit/http`'s wire
format. Drift is prevented by docs (the BE README is the source of truth),
not by a code dependency — the FE has zero `@quilla-kit/*` imports.

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
- `downloadFile(client, options: DownloadFileOptions): Promise<void>` — authenticated binary GET → "Save as"
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
- `FetchHttpClient` — bare transport
- `AuthenticatedHttpClient` — auth decorator
- `SingleFlightTokenRefresher` — concurrent-safe refresh
- `EnvelopeHttpErrorParser` — default error parser
- `RepeatParamsSerializer` — default query serializer

You typically only need `createHttpClient`. The classes are exposed for
consumers writing custom decorators or factory variants.
