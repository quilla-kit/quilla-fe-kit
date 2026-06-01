---
"@quilla-fe-kit/api-client-react-query": minor
---

Add `queryTransformer` and `mutationTransformer` options to `createHooks` for backend envelope unwrapping.

Backends that wrap responses in a custom envelope (e.g. `{ payload, metadata }`) previously required either leaking envelope fields into DTOs or writing a full `HttpClient` decorator. Both transformers can now be set once in `createHooks` so every hook call normalises responses automatically, with a per-call `transformer` option available for endpoints that differ from the rest.

The previous built-in `{ data, pagination }` auto-detection in `useQueryBase` has been removed in favour of this explicit opt-in — without a transformer, `response.data` is returned as-is.
