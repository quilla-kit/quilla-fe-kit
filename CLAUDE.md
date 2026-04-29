# Conventions for Claude working on this codebase

This file captures decisions that have been made on this project. Follow them
by default unless explicitly asked to revisit.

## Source-folder organization

**Do not create a subfolder unless it has a reason to exist.** A subfolder with
1–2 tiny files is not organization — it's proliferating tree noise.

Concretely:

- Start with fewer, bigger folders. A single folder with 10–15 focused files is
  usually easier to navigate than six folders with two files each.
- Only create a subfolder when a **sub-topic emerges** — a cluster of files that
  share an internal concern the rest of the folder doesn't, typically 3+ files.
- Nest sub-topics within their parent topic rather than hoisting them to the
  root of `src/`. For example, multipart helpers are a sub-topic of the HTTP
  client, so they live at `src/http/multipart/` — not at `src/multipart/`.

**Bad** (what we'd get if every concept got its own folder):

```
src/
├── interfaces/         (1 file)
├── factories/          (1 file)
├── parsers/            (1 file)
├── serializers/        (1 file)
├── refreshers/         (1 file)
├── clients/            (2 files)
├── errors/             (9 files)
├── storage/            (4 files)
├── wire/               (5 files)
└── index.ts
```

**Good**:

```
src/
├── http/
│   ├── http-client.interface.ts
│   ├── fetch.client.ts
│   ├── authenticated.client.ts
│   ├── http-client.factory.ts
│   ├── http-error.parser.ts
│   ├── query-string.serializer.ts
│   ├── single-flight-token.refresher.ts
│   └── index.ts
├── storage/
│   ├── token-storage.interface.ts
│   ├── memory.storage.ts
│   ├── local.storage.ts
│   ├── cookie.storage.ts
│   └── index.ts
├── errors/             (a real sub-topic — 8 error classes + base)
│   └── ...
├── wire/               (a real sub-topic — 5 wire-contract types)
│   └── ...
└── index.ts
```

## Source file naming

Files follow the shape **`{subject}.{type}.ts`** where:

- **`{type}`** is the single-word role suffix — always simple, never compound.
  Current vocabulary: `client`, `factory`, `parser`, `serializer`, `refresher`,
  `storage`, `provider`, `guard`, `hook`, `error`, `interface`, `type`.
- Use **`.interface.ts`** when the file's main export is a TypeScript
  `interface` (contract to be implemented by a class) and no more specific
  role fits (e.g. prefer `.client.ts` or `.storage.ts` if accurate).
- Use **`.type.ts`** when the file's main export is a pure data `type`
  (union, mapped type, record shape) and no more specific role fits.
- **`{subject}`** is everything before the dot. May contain hyphens for
  multi-word subjects (`http-client`, `local-storage`, `query-string`,
  `single-flight-token`, `auth-session`).

**Examples:**

| File | Subject | Type |
| --- | --- | --- |
| `http-client.interface.ts` | `http-client` | `interface` |
| `fetch.client.ts` | `fetch` | `client` |
| `authenticated.client.ts` | `authenticated` | `client` |
| `http-client.factory.ts` | `http-client` | `factory` |
| `http-error.parser.ts` | `http-error` | `parser` |
| `query-string.serializer.ts` | `query-string` | `serializer` |
| `single-flight-token.refresher.ts` | `single-flight-token` | `refresher` |
| `token-storage.interface.ts` | `token-storage` | `interface` |
| `memory.storage.ts` | `memory` | `storage` |
| `local.storage.ts` | `local` | `storage` |
| `cookie.storage.ts` | `cookie` | `storage` |
| `conflict.error.ts` | `conflict` | `error` |
| `validation.error.ts` | `validation` | `error` |
| `error-envelope.type.ts` | `error-envelope` | `type` |
| `pagination-request.type.ts` | `pagination-request` | `type` |
| `auth-session.type.ts` | `auth-session` | `type` |
| `use-query-base.hook.ts` | `use-query-base` | `hook` |
| `use-post-mutation.hook.ts` | `use-post-mutation` | `hook` |
| `query-client.factory.ts` | `query-client` | `factory` |

**Do not use compound type suffixes.** Never `error-parser`, `token-storage`,
or `query-hook` as the type segment. Flatten to the simple role and let the
subject carry the qualification. Same role gets the same type suffix
everywhere.

**Files that stay single-word** (no subject/type split): every package's
`index.ts`. Reserve this for files whose main export is a class with no
specific role suffix that fits, and that anchors the package's vocabulary
(the base type everything else describes). Pure type or interface files
always take `.type.ts` or `.interface.ts` — even when they are the
package's central concept (prefer `http-client.interface.ts` over
`http-client.ts`, `auth-session.type.ts` over `auth-session.ts`).

**Test files mirror** the source name with `.test.ts` appended:
`fetch.client.ts` → `fetch.client.test.ts`.

## Tests

Tests live in a dedicated `tests/` folder at the package root, mirroring the
`src/` layout. They do **not** co-locate with source.

```
packages/api-client/
├── src/http/fetch.client.ts
└── tests/http/fetch.client.test.ts
```

Each package that has tests needs a `tsconfig.test.json` that extends the
package's `tsconfig.json` with `composite: false`, `noEmit: true`, and
`include: ["src/**/*", "tests/**/*"]`. Wire the script `"typecheck": "tsc -p
tsconfig.test.json"`. Turbo's `typecheck` task runs it; CI runs `pnpm typecheck`
between `pnpm build` and `pnpm test`.

Shared fixtures and helpers go in `tests/helpers/` or `tests/fixtures/`.

## `interface` vs `type`

- Use `interface` **only** when the shape is designed to be implemented by a
  class (`class Foo implements Bar`) or when declaration merging is intended.
- Use `type` for everything else: pure data shapes, `*Props`, `*JSON`,
  `*Options`, unions, mapped types, function aliases.

Examples in this repo:

- `interface HttpClient`, `interface TokenStorage`, `interface ErrorParser`,
  `interface QueryStringSerializer` — all have method signatures that classes
  (or class-shaped factories) implement.
- `type ErrorEnvelope`, `type PaginationRequest`, `type PaginationResponse<T>`,
  `type AuthSession`, `type OCCToken`, `type HttpClientConfig`,
  `type FetchOptions` — pure data.

Module-augmentation declarations (e.g. `@tanstack/react-query`'s `Register`
interface) are a legitimate use of `interface` even when no class implements
them — declaration merging is the explicit intent.

## No `I`-prefix on interface names

TypeScript is structurally typed; `I`-prefix is Hungarian notation that the
type system already encodes. No `IHttpClient` / `ITokenStorage` /
`IErrorParser`. Just `HttpClient`, `TokenStorage`, `ErrorParser`.

Per the [TypeScript team's coding guidelines](https://github.com/microsoft/TypeScript/wiki/Coding-guidelines).

## Scope naming

Use `scopeId` (not `tenantId`). The toolkit is naming-agnostic about what the
scope represents — consumers choose whether it's a tenant, workspace,
organization, project, etc. This matches the BE convention in `@quilla-kit`.

Wire-type field: `AuthSession.scopeId`.

## ESM + `.js` extensions in source

All packages are pure ESM. `tsconfig.base.json` uses `"moduleResolution":
"NodeNext"`, which requires explicit file extensions on relative imports.

Write `.js` extensions in source even though the files are `.ts`:

```ts
import { FetchHttpClient } from './fetch.client.js';   // resolves to ./fetch.client.ts at type-check time
```

This is the official TypeScript + Node ESM convention. Don't fight it.

## Zero `@quilla-kit/*` runtime deps

The FE has **zero import dependency** on any `@quilla-kit/*` package. Wire
contracts live inside `@quilla-fe-kit/api-client` at
`packages/api-client/src/wire/` (`ErrorEnvelope`, `PaginationRequest`,
`PaginationResponse`, `AuthSession`, `OCC_HEADER`, `OCCToken`,
`formatOCCHeaderValue`, `parseETagHeaderValue`) and are re-exported from
the package barrel for consumer ergonomics. Error classes live in
`@quilla-fe-kit/errors` matching the shape of `@quilla-kit/errors`.

Drift between FE and BE is prevented by **docs**, not code dependency: the
BE `@quilla-kit/http` README is the source of truth for the wire format.

Do not propose a shared types package between the two halves. That was
considered and rejected — the cost of separate governance is lower than the
cost of a coupled lifecycle.

## Per-package runtime-dep rules

- **`@quilla-fe-kit/errors`** — zero runtime dependencies. Pure JS classes,
  no platform globals, universal runtime.
- **`@quilla-fe-kit/auth`** — zero runtime dependencies. Auth primitives
  (today: `TokenStorage` interface + 3 adapters). Adapters that touch
  browser-only APIs (`localStorageTokenStorage`, `cookieTokenStorage`)
  guard against missing `localStorage` / `document` and throw a clear
  error at call time.
- **`@quilla-fe-kit/api-client`** — depends on `@quilla-fe-kit/auth` +
  `@quilla-fe-kit/errors` (workspace). Platform-level built-ins on
  `globalThis` (`fetch`, `URL`) are the only externals; they are guarded
  for availability so the package stays browser + Node + edge safe.
  Owns the BE wire-contract types internally at `src/wire/` and
  re-exports them for consumer ergonomics.
- **`@quilla-fe-kit/api-client-react-query`** — depends on
  `@quilla-fe-kit/api-client` + `@quilla-fe-kit/errors` (both workspace).
  `@tanstack/react-query` and `react` are peer dependencies. No
  additional runtime deps.

Future framework adapters (`api-client-swr`, `api-client-vue-query`,
`api-client-solid-query`) follow the same rule: `@quilla-fe-kit/api-client`
as the only required workspace dep, framework as peer. Each adapter is
its own package — bundling them was considered and rejected because they
evolve on independent cadences and have different framework peer deps.

**Why `errors` and `auth` are their own packages:** they're real
toolkit building blocks, useful in FE projects independent of the HTTP
transport. A team using axios or ky could pull just `@quilla-fe-kit/auth`
for its `cookieTokenStorage`. A team that wants a structured error model
without committing to the rest of the toolkit could pull just
`@quilla-fe-kit/errors`. The toolkit's value proposition is precisely
this pick-and-mix.

**Naming note:** the `auth` package is named for its *future scope* (auth
primitives) rather than just its current contents (token storage). The
name reflects what the package will grow into; for now it's specifically
token-storage adapters. `AuthSession` (the BE wire shape `{ scopeId, userId }`)
deliberately lives in `api-client/src/wire/` next to other wire types —
it describes a JSON contract with the BE, not a local auth primitive.

**Why `wire` is *not* its own package:** wire types only have meaning
when speaking to a `@quilla-kit` BE. There's no honest standalone "I want
only the wire types" scenario. They live inside
`packages/api-client/src/wire/` because that's where they're used, and
`api-client` re-exports them so consumers who need them get them without
an extra install.

## Runtime-environment safety

`@quilla-fe-kit/api-client` runs in browser, Node, and edge runtimes. Therefore:

- Read globals via `globalThis` (`globalThis.fetch`, `globalThis.crypto`)
  rather than importing from `node:*` or assuming `window`. Throw a clear
  error at construction time if a required global is missing — never at
  module load.
- **No module-load env reads.** All configuration arrives via
  `createHttpClient(config)` / `createQueryClient(config)` factories. No
  `process.env.X` at the top of any file.
- Storage adapters that touch browser-only APIs (`localStorageTokenStorage`,
  `cookieTokenStorage`) must guard against missing `window` / `document`
  and either no-op or throw a clear error — caller's choice surfaced via
  config.
- `tsconfig.base.json` includes `"DOM"` in `lib` for `fetch` / `URL` /
  `crypto` types. It does **not** auto-inject `@types/node` (`types: []`).
  Tests opt in via `tsconfig.test.json` (`types: ["node"]`).

## Style and formatting

- **Biome** handles lint + format. `pnpm lint` runs `biome check .`,
  `pnpm format` writes fixes.
- **Single quotes** for strings, **semicolons** always, **trailing commas** in
  all positions. Enforced by Biome; don't fight it.
- Default to **no comments**. Only add a comment when the *why* is non-obvious
  (hidden constraint, subtle invariant, workaround for a specific bug). Never
  write multi-paragraph docstrings or narrate what the code does.

## Changesets

Every PR that changes published behavior of a `@quilla-fe-kit/*` package adds
a changeset. Independent versioning per package — adapters evolve
out-of-lockstep with the core client.

Pre-1.0, all real feature releases are `minor` bumps (0.1.0 → 0.2.0).
Patches are patch bumps.

## Commit messages

Conventional-commits-style. Scope with the affected package
(`feat(client):`, `feat(client-react-query):`, `chore:`, `docs:`). Body
explains the *why* and the load-bearing design decisions, not a file list.
