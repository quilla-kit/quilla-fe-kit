---
'@quilla-fe-kit/errors': minor
---

Add `QuerySerializationError` for query-string serialization failures raised
before a request leaves the client.

It extends `QuillaFeError` (not `QuillaFeHttpError`) because it reports a
client-side programming mistake rather than a server response, and carries the
offending `keyPath` in `context`.
