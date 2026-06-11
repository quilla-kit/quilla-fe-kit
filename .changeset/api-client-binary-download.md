---
"@quilla-fe-kit/api-client": minor
---

Add binary/stream response support and a browser file-download helper.

`HttpRequest` now accepts a `responseType` of `'blob' | 'arrayBuffer' | 'stream'` (plus explicit `'json' | 'text'`) so binary payloads such as zip exports are read with the correct decoder instead of being corrupted by the default text decode. Error responses are always parsed as the JSON envelope regardless of `responseType`, so a failing binary request still throws the typed error class — and because the request flows through the normal layers, it keeps the Bearer token and the 401 silent-refresh + retry that a hand-rolled `fetch` would miss.

New `downloadFile(client, { url, filename })` and `saveBlobAsFile(blob, filename)` helpers fetch an authenticated file and trigger a browser "Save as". Both are browser-only and throw a clear error when `document` / `URL.createObjectURL` is unavailable; the binary fetch itself stays environment-agnostic.
