# @quilla-fe-kit/api-client

## 0.2.0

### Minor Changes

- 3463bd1: Add binary/stream response support and a browser file-download helper.

  `HttpRequest` now accepts a `responseType` of `'blob' | 'arrayBuffer' | 'stream'` (plus explicit `'json' | 'text'`) so binary payloads such as zip exports are read with the correct decoder instead of being corrupted by the default text decode. Error responses are always parsed as the JSON envelope regardless of `responseType`, so a failing binary request still throws the typed error class — and because the request flows through the normal layers, it keeps the Bearer token and the 401 silent-refresh + retry that a hand-rolled `fetch` would miss.

  New `downloadFile(client, { url, filename })` and `saveBlobAsFile(blob, filename)` helpers fetch an authenticated file and trigger a browser "Save as". Both are browser-only and throw a clear error when `document` / `URL.createObjectURL` is unavailable; the binary fetch itself stays environment-agnostic.

## 0.1.2

### Patch Changes

- Updated dependencies [aeb2a49]
  - @quilla-fe-kit/auth@0.2.0

## 0.1.1

### Patch Changes

- ba25ee0: test: smoke-test CI release via Trusted Publishers (OIDC) across all packages
- Updated dependencies [ba25ee0]
  - @quilla-fe-kit/auth@0.1.1
  - @quilla-fe-kit/errors@0.1.1

## 0.1.0

### Minor Changes

- 4e00828: Initial release of `@quilla-fe-kit/errors`, `@quilla-fe-kit/auth`,
  `@quilla-fe-kit/api-client`, and `@quilla-fe-kit/api-client-react-query`.

### Patch Changes

- Updated dependencies [4e00828]
  - @quilla-fe-kit/errors@0.1.0
  - @quilla-fe-kit/auth@0.1.0
