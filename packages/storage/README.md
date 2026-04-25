# @quilla-fe-kit/storage

Pluggable token-storage abstraction for FE auth flows: a `TokenStorage`
interface plus three default adapters — memory, localStorage, and cookie.

Zero runtime dependencies. Browser-only globals are guarded; missing
`localStorage` / `document` throw a clear error at call time, never at
module load.

## Why this package exists

Every FE app that handles auth tokens picks one of: localStorage (XSS-prone
but easy), HttpOnly cookies (set by the server, secure but rigid), or
in-memory (SSR-safe but lost on reload). Each comes with trade-offs and
each app eventually wants to swap between them — for tests, for SSR, for
multi-storage migrations. This package ships:

- A 4-method `TokenStorage` interface (`getAccessToken`, `getRefreshToken`,
  `setTokens`, `clear`) that's small enough to implement in 10 lines.
- Three production-ready adapters covering the common cases.
- A "no surprises" runtime model: factories return immediately, errors
  surface only when consumers actually call into a missing platform global.

Reusable independently of `@quilla-fe-kit/api-client` — drop it into a
project that uses axios, ky, or any other HTTP client. The interface is
the contract.

## Install

```sh
pnpm add @quilla-fe-kit/storage
```

Node 22+, ESM-only.

## The interface

```ts
type TokenPair = {
  readonly access: string;
  readonly refresh: string;
};

interface TokenStorage {
  getAccessToken(): Promise<string | null>;
  getRefreshToken(): Promise<string | null>;
  setTokens(tokens: TokenPair): Promise<void>;
  clear(): Promise<void>;
}
```

Async by design — the interface fits localStorage (sync), cookies (sync),
in-memory (sync), and future async backends (IndexedDB, native secure
keystore wrappers) without breaking changes.

## Adapters

### `memoryTokenStorage()`

In-process storage. SSR-safe (no global access). Lost on page reload.
Good defaults for tests and Node-side integrations.

```ts
import { memoryTokenStorage } from '@quilla-fe-kit/storage';

const storage = memoryTokenStorage();
await storage.setTokens({ access: 'a', refresh: 'r' });
```

### `localStorageTokenStorage(options?)`

Persists across reloads. Throws a clear error if `globalThis.localStorage`
is missing (SSR, Node, edge). Customize the keys if you have a key-naming
convention or want to namespace per-app.

```ts
import { localStorageTokenStorage } from '@quilla-fe-kit/storage';

const storage = localStorageTokenStorage({
  accessKey: 'myapp:access',     // default: 'quilla-fe-kit:access-token'
  refreshKey: 'myapp:refresh',   // default: 'quilla-fe-kit:refresh-token'
});
```

**Security note:** any script on the page can read localStorage. Prefer
`cookieTokenStorage` with `Secure` + `HttpOnly` *server-set* cookies for
hostile-network apps (banking, healthcare) — but `HttpOnly` cookies are
not readable by JS and don't fit this interface anyway. Use this adapter
when the threat model accepts XSS-readable tokens.

### `cookieTokenStorage(options?)`

Browser document.cookie wrapper. Defaults to `Secure` + `SameSite=Lax`,
which is the right default for production but **breaks on
`http://localhost`**. Override `secure: false` in dev configs.

```ts
import { cookieTokenStorage } from '@quilla-fe-kit/storage';

const storage = cookieTokenStorage({
  // sensible production defaults
  secure: true,
  sameSite: 'Lax',
  path: '/',
  // optional
  domain: '.example.com',
  accessMaxAgeSeconds: 15 * 60,
  refreshMaxAgeSeconds: 30 * 24 * 60 * 60,
  // custom keys
  accessKey: 'myapp:access',
  refreshKey: 'myapp:refresh',
});
```

Throws a clear error if `globalThis.document` is missing (SSR, Node, edge).

This adapter only works for cookies that JavaScript writes — i.e., not
`HttpOnly`. If your auth flow uses server-set `HttpOnly` cookies, the
browser sends them automatically; you don't need a token-storage abstraction
on the client at all.

## Picking an adapter

| Adapter         | Survives reload | SSR-safe | XSS-readable | Best for                                 |
| --------------- | --------------- | -------- | ------------ | ---------------------------------------- |
| memory          | no              | yes      | no¹          | tests, SSR, short-lived sessions         |
| localStorage    | yes             | no²      | yes          | typical SPAs, dev environments           |
| cookie          | yes             | no²      | yes³         | apps that prefer cookie-bound auth       |

¹ Tokens never leave the JS heap.
² Throws when called server-side without a guard. Use memory in SSR contexts.
³ JS-writeable cookies are XSS-readable. Use server-set `HttpOnly` if you
need otherwise — but then you don't need this package on the client.

## Writing your own adapter

The interface is small. To implement IndexedDB, native keychain, encrypted
file storage, or anything else, ship a class or factory that returns
`TokenStorage`:

```ts
import type { TokenStorage } from '@quilla-fe-kit/storage';

export const myAdapter = (): TokenStorage => ({
  async getAccessToken() {
    /* read from your backend */
  },
  async getRefreshToken() { /* ... */ },
  async setTokens({ access, refresh }) { /* ... */ },
  async clear() { /* ... */ },
});
```

The convention used by the bundled adapters: validate platform globals
lazily (at call time, not construction), throw a clear `Error` with a
remediation hint. This keeps factory calls cheap and lets SSR code path
construct the adapter without crashing if it never actually reads from it.

## Default key namespace

`localStorageTokenStorage` and `cookieTokenStorage` default to keys
`quilla-fe-kit:access-token` and `quilla-fe-kit:refresh-token` so they can
coexist without collision if a consumer mounts both. Always override both
keys together when customizing — silent drift between the two adapters
strands tokens after a migration.
